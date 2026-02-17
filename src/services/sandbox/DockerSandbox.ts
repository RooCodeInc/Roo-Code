import { execFile } from "child_process"
import * as crypto from "crypto"
import fs from "fs/promises"
import * as path from "path"
import { promisify } from "util"

import { type SandboxConfig, resolveSandboxConfig } from "./SandboxConfig"

const execFileAsync = promisify(execFile)

interface SandboxExecResult {
	stdout: string
	stderr: string
	exitCode: number
	timedOut: boolean
}

type ContainerInspectResult =
	| { exists: false }
	| { exists: true; running: boolean; configHash?: string; image?: string }

const DEFAULT_MASKED_WORKSPACE_DIRS = [
	// Node / JS
	"node_modules",
	".pnpm-store",
	".turbo",
	".cache",
	".next",
	".nuxt",
	".svelte-kit",
	".vite",
	".parcel-cache",
	"dist",
	"build",
	"out",
	".output",
	"coverage",
	"playwright-report",
	"test-results",
	"storybook-static",
] as const

const DEFAULT_SESSION_PORTS = [3000, 5173, 4173, 8000, 8080, 6006] as const

/**
 * Docker-based sandbox for executing commands in an isolated container.
 * Requires Docker to be installed and running on the host.
 *
 * This is behind the `experiments.sandboxExecution` feature flag.
 */
export class DockerSandbox {
	private static readonly ensureLocks = new Map<string, Promise<void>>()
	private static readonly ensureCache = new Map<string, { configHash: string; checkedAt: number }>()

	private readonly config: SandboxConfig
	private readonly workspacePath: string
	private readonly containerName: string
	private readonly workspaceHash: string
	private dockerAvailable?: boolean

	constructor(workspacePath: string, configOverrides?: Partial<SandboxConfig>) {
		this.workspacePath = path.resolve(workspacePath)
		this.config = resolveSandboxConfig(configOverrides)
		this.workspaceHash = this.hashString(this.workspacePath).slice(0, 12)
		this.containerName = `roo-sbx-${this.workspaceHash}`
	}

	/**
	 * Check if Docker is available on the system.
	 */
	async isAvailable(): Promise<boolean> {
		if (this.dockerAvailable !== undefined) {
			return this.dockerAvailable
		}

		try {
			await execFileAsync("docker", ["info"], { timeout: 5000 })
			this.dockerAvailable = true
		} catch {
			this.dockerAvailable = false
		}

		return this.dockerAvailable
	}

	/**
	 * Execute a command inside a Docker container with the configured sandbox settings.
	 *
	 * Uses a warm, workspace-scoped container to keep performance high and allow caching via volumes.
	 */
	async exec(command: string, cwd?: string): Promise<SandboxExecResult> {
		if (!(await this.isAvailable())) {
			throw new Error(
				"Docker is not available. Install Docker and ensure the Docker daemon is running to use sandbox execution.",
			)
		}

		await this.ensureContainerRunning()

		const workdir = this.resolveWorkdir(cwd)
		const envArgs = this.buildExecEnvArgs()

		const args = ["exec", "-i", "-w", workdir, ...envArgs, this.containerName, "sh", "-lc", command]

		try {
			const { stdout, stderr } = await execFileAsync("docker", args, {
				timeout: this.config.maxExecutionTime,
				maxBuffer: 10 * 1024 * 1024, // 10MB
			})

			return { stdout, stderr, exitCode: 0, timedOut: false }
		} catch (error: any) {
			if (error.killed || error.signal === "SIGTERM") {
				return {
					stdout: error.stdout ?? "",
					stderr: error.stderr ?? `Command timed out after ${this.config.maxExecutionTime}ms`,
					exitCode: 124,
					timedOut: true,
				}
			}

			return {
				stdout: error.stdout ?? "",
				stderr: error.stderr ?? error.message,
				exitCode: typeof error.code === "number" ? error.code : 1,
				timedOut: false,
			}
		}
	}

	/**
	 * Starts a long-running command in a dedicated session container (useful for dev servers/watchers).
	 *
	 * The container is created with common dev ports published to random host ports to avoid conflicts.
	 * Use `docker rm -f <containerName>` to stop the session.
	 */
	async startSession(
		command: string,
		options?: { cwd?: string; ports?: number[] },
	): Promise<{
		containerName: string
		publishedPorts: Record<number, string[]>
		initialLogs: string
	}> {
		if (!(await this.isAvailable())) {
			throw new Error(
				"Docker is not available. Install Docker and ensure the Docker daemon is running to use sandbox execution.",
			)
		}

		const sessionName = this.sessionContainerName()
		const ports = this.resolveSessionPorts(command, options?.ports)
		const workdir = this.resolveWorkdir(options?.cwd)

		await this.removeContainerByName(sessionName)

		const args = await this.buildDockerSessionRunArgs(sessionName, command, workdir, ports)
		await this.docker(args, { timeout: 120_000 })

		// Give the process a moment to produce logs and for port mappings to settle.
		await new Promise((r) => setTimeout(r, 350))

		const initialLogs = await this.getContainerLogs(sessionName)
		const publishedPorts: Record<number, string[]> = {}
		for (const port of ports) {
			publishedPorts[port] = await this.getPublishedPortMappings(sessionName, port)
		}

		return { containerName: sessionName, publishedPorts, initialLogs }
	}

	private async ensureContainerRunning(): Promise<void> {
		const desiredHash = this.computeConfigHash()
		const now = Date.now()
		const cached = DockerSandbox.ensureCache.get(this.containerName)

		if (cached && cached.configHash === desiredHash && now - cached.checkedAt < 3_000) {
			return
		}

		const existingLock = DockerSandbox.ensureLocks.get(this.containerName)
		if (existingLock) {
			await existingLock
			return
		}

		const lock = (async () => {
			const inspected = await this.inspectContainer()

			if (!inspected.exists) {
				await this.createContainer(desiredHash)
				await this.initializeContainer()
				return
			}

			if (inspected.configHash && inspected.configHash !== desiredHash) {
				await this.removeContainer()
				await this.createContainer(desiredHash)
				await this.initializeContainer()
				return
			}

			if (!inspected.running) {
				await this.docker(["start", this.containerName], { timeout: 15_000 })
				await this.initializeContainer()
			}
		})()

		DockerSandbox.ensureLocks.set(this.containerName, lock)
		try {
			await lock
			DockerSandbox.ensureCache.set(this.containerName, { configHash: desiredHash, checkedAt: Date.now() })
		} finally {
			DockerSandbox.ensureLocks.delete(this.containerName)
		}
	}

	private async inspectContainer(): Promise<ContainerInspectResult> {
		try {
			const { stdout } = await this.docker(
				[
					"inspect",
					"--format",
					'{{.State.Running}}|{{.Config.Image}}|{{ index .Config.Labels "roo.sandbox.configHash" }}',
					this.containerName,
				],
				{ timeout: 10_000 },
			)

			const [runningRaw, imageRaw, hashRaw] = stdout.trim().split("|")
			return {
				exists: true,
				running: runningRaw === "true",
				image: imageRaw || undefined,
				configHash: hashRaw || undefined,
			}
		} catch {
			return { exists: false }
		}
	}

	private async removeContainer(): Promise<void> {
		try {
			await this.docker(["rm", "-f", this.containerName], { timeout: 30_000 })
		} catch {
			// Best-effort cleanup
		}
	}

	private async removeContainerByName(name: string): Promise<void> {
		try {
			await this.docker(["rm", "-f", name], { timeout: 30_000 })
		} catch {
			// Best-effort cleanup
		}
	}

	private async createContainer(configHash: string): Promise<void> {
		const args = await this.buildDockerRunArgs(configHash)
		await this.docker(args, { timeout: 120_000 })
	}

	private async initializeContainer(): Promise<void> {
		// Best-effort one-time-ish setup for common JS workflows.
		// This keeps subsequent commands fast (pnpm via corepack) without requiring a custom image.
		try {
			await this.docker(
				[
					"exec",
					"-i",
					...this.buildExecEnvArgs(),
					this.containerName,
					"sh",
					"-lc",
					"corepack enable >/dev/null 2>&1 || true",
				],
				{ timeout: 30_000 },
			)
		} catch {
			// Initialization is best-effort
		}
	}

	private resolveWorkdir(cwd?: string): string {
		if (!cwd) {
			return "/workspace"
		}

		let relative = cwd
		if (path.isAbsolute(cwd)) {
			relative = path.relative(this.workspacePath, cwd)
		}

		const normalized = relative.replace(/\\/g, "/").replace(/^\/+/, "")
		if (!normalized || normalized === ".") {
			return "/workspace"
		}

		return `/workspace/${normalized}`
	}

	private buildExecEnvArgs(): string[] {
		// Global caches (works across common stacks; harmless when unused)
		const env: Record<string, string> = {
			XDG_CACHE_HOME: "/cache/xdg",
			PNPM_STORE_DIR: "/cache/pnpm-store",
			NPM_CONFIG_CACHE: "/cache/npm",
			YARN_CACHE_FOLDER: "/cache/yarn",
			TURBO_CACHE_DIR: "/cache/turbo",
			PIP_CACHE_DIR: "/cache/pip",
			CARGO_HOME: "/cache/cargo",
			GOMODCACHE: "/cache/gomod",
			GOCACHE: "/cache/gobuild",
			GRADLE_USER_HOME: "/cache/gradle",
			MAVEN_USER_HOME: "/cache/m2",
		}

		const args: string[] = []
		for (const [key, value] of Object.entries(env)) {
			args.push("-e", `${key}=${value}`)
		}
		return args
	}

	private async buildDockerRunArgs(configHash: string): Promise<string[]> {
		const args: string[] = ["run", "-d", "--rm", "--name", this.containerName]

		// Labels (used to detect drift and recreate containers as needed)
		args.push("--label", "roo.sandbox=1")
		args.push("--label", `roo.sandbox.workspaceHash=${this.workspaceHash}`)
		args.push("--label", `roo.sandbox.configHash=${configHash}`)

		// Memory limit
		args.push(`--memory=${this.config.memoryLimit}`)

		// Network access
		if (this.config.networkAccess === "none") {
			args.push("--network=none")
		} else if (this.config.networkAccess === "restricted") {
			args.push("--cap-drop=ALL", "--cap-add=NET_RAW")
		}

		// Security options
		args.push("--security-opt=no-new-privileges")

		// Cache volume (shared by common toolchains)
		args.push("-v", `${this.cacheVolumeName()}:/cache:rw`)

		// Mount workspace
		if (this.config.mountWorkspace) {
			const normalizedPath = this.workspacePath.replace(/\\/g, "/")
			const mountMode = this.config.workspaceMountMode === "rw" ? "rw" : "ro"
			args.push("-v", `${normalizedPath}:/workspace:${mountMode}`)
		}

		// Mask workspace dirs with named volumes to keep host clean.
		const maskedDirs = await this.getMaskedWorkspaceDirs()
		for (const rel of maskedDirs) {
			const target = `/workspace/${rel}`
			args.push("-v", `${this.maskVolumeName(rel)}:${target}:rw`)
		}

		// Additional allowed mounts
		for (const mount of this.config.allowedMounts) {
			const normalizedMount = mount.replace(/\\/g, "/")
			const base = normalizedMount.split("/").filter(Boolean).pop() ?? "mount"
			args.push("-v", `${normalizedMount}:/mnt/${base}:rw`)
		}

		// Working directory
		args.push("-w", "/workspace")

		// Environment (caches)
		args.push(...this.buildExecEnvArgs())

		// Image
		args.push(this.config.image)

		// Keep container alive for warm execs
		args.push("sh", "-lc", "while true; do sleep 3600; done")

		return args
	}

	private async buildDockerSessionRunArgs(
		name: string,
		command: string,
		workdir: string,
		ports: number[],
	): Promise<string[]> {
		const args: string[] = ["run", "-d", "--rm", "--name", name]

		args.push("--label", "roo.sandbox=1")
		args.push("--label", "roo.sandbox.session=1")
		args.push("--label", `roo.sandbox.workspaceHash=${this.workspaceHash}`)

		// Memory limit
		args.push(`--memory=${this.config.memoryLimit}`)

		// Network access
		if (this.config.networkAccess === "none") {
			args.push("--network=none")
		} else if (this.config.networkAccess === "restricted") {
			args.push("--cap-drop=ALL", "--cap-add=NET_RAW")
		}

		// Security options
		args.push("--security-opt=no-new-privileges")

		// Publish common dev ports to random host ports to avoid collisions.
		for (const port of ports) {
			args.push("-p", `0:${port}`)
		}

		// Cache volume
		args.push("-v", `${this.cacheVolumeName()}:/cache:rw`)

		// Mount workspace
		if (this.config.mountWorkspace) {
			const normalizedPath = this.workspacePath.replace(/\\/g, "/")
			const mountMode = this.config.workspaceMountMode === "rw" ? "rw" : "ro"
			args.push("-v", `${normalizedPath}:/workspace:${mountMode}`)
		}

		// Mask workspace dirs
		const maskedDirs = await this.getMaskedWorkspaceDirs()
		for (const rel of maskedDirs) {
			const target = `/workspace/${rel}`
			args.push("-v", `${this.maskVolumeName(rel)}:${target}:rw`)
		}

		// Additional allowed mounts
		for (const mount of this.config.allowedMounts) {
			const normalizedMount = mount.replace(/\\/g, "/")
			const base = normalizedMount.split("/").filter(Boolean).pop() ?? "mount"
			args.push("-v", `${normalizedMount}:/mnt/${base}:rw`)
		}

		args.push("-w", workdir)
		args.push(...this.buildExecEnvArgs())
		args.push(this.config.image)
		args.push("sh", "-lc", command)

		return args
	}

	private async getMaskedWorkspaceDirs(): Promise<string[]> {
		const masked = new Set<string>(DEFAULT_MASKED_WORKSPACE_DIRS)

		// If this looks like a JS workspace/monorepo, also mask common package node_modules paths.
		const hasPnpmWorkspace = await this.pathExists(path.join(this.workspacePath, "pnpm-workspace.yaml"))
		const hasRootPackageJson = await this.pathExists(path.join(this.workspacePath, "package.json"))

		if (hasPnpmWorkspace || hasRootPackageJson) {
			const extra = await this.detectNodePackageNodeModules(["packages", "apps"])
			for (const rel of extra) {
				masked.add(rel)
			}
		}

		return [...masked]
			.map((p) => p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, ""))
			.filter((p) => p.length > 0 && !p.includes(".."))
	}

	private async detectNodePackageNodeModules(topLevelDirs: string[]): Promise<string[]> {
		const results: string[] = []

		for (const dir of topLevelDirs) {
			const abs = path.join(this.workspacePath, dir)
			if (!(await this.pathExists(abs))) {
				continue
			}

			let entries: Array<{ name: string; isDir: boolean }> = []
			try {
				const dirents = await fs.readdir(abs, { withFileTypes: true })
				entries = dirents.map((d) => ({ name: d.name, isDir: d.isDirectory() }))
			} catch {
				continue
			}

			for (const entry of entries) {
				if (!entry.isDir) {
					continue
				}
				if (entry.name === "node_modules" || entry.name.startsWith(".")) {
					continue
				}

				const packageJsonPath = path.join(abs, entry.name, "package.json")
				if (await this.pathExists(packageJsonPath)) {
					results.push(`${dir}/${entry.name}/node_modules`)
				}
			}
		}

		return results
	}

	private cacheVolumeName(): string {
		return `roo_sbx_cache_${this.workspaceHash}`
	}

	private sessionContainerName(): string {
		return `roo-sbx-sess-${this.workspaceHash}`
	}

	private maskVolumeName(relativePath: string): string {
		const suffix = this.hashString(relativePath).slice(0, 10)
		return `roo_sbx_mask_${this.workspaceHash}_${suffix}`
	}

	private computeConfigHash(): string {
		const stableConfig = {
			version: 1,
			image: this.config.image,
			mountWorkspace: this.config.mountWorkspace,
			workspaceMountMode: this.config.workspaceMountMode,
			networkAccess: this.config.networkAccess,
			memoryLimit: this.config.memoryLimit,
			allowedMounts: this.config.allowedMounts,
			maskedPreset: DEFAULT_MASKED_WORKSPACE_DIRS,
			cache: { mount: "/cache" },
		}

		return this.hashString(JSON.stringify(stableConfig))
	}

	private hashString(input: string): string {
		return crypto.createHash("sha256").update(input).digest("hex")
	}

	private async docker(args: string[], options?: { timeout?: number }): Promise<{ stdout: string; stderr: string }> {
		const { stdout, stderr } = await execFileAsync("docker", args, {
			timeout: options?.timeout,
			maxBuffer: 10 * 1024 * 1024,
		})
		return { stdout, stderr }
	}

	private async getContainerLogs(name: string): Promise<string> {
		try {
			const { stdout, stderr } = await this.docker(["logs", "--tail", "200", name], { timeout: 10_000 })
			const combined = [stdout?.trim(), stderr?.trim()].filter(Boolean).join("\n")
			return combined
		} catch {
			return ""
		}
	}

	private async getPublishedPortMappings(name: string, containerPort: number): Promise<string[]> {
		try {
			const { stdout } = await this.docker(["port", name, String(containerPort)], { timeout: 10_000 })
			const lines = stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
			return lines
		} catch {
			return []
		}
	}

	private resolveSessionPorts(command: string, configuredPorts?: number[]): number[] {
		const ports = new Set<number>(configuredPorts?.length ? configuredPorts : DEFAULT_SESSION_PORTS)
		for (const extracted of this.extractPortsFromCommand(command)) {
			ports.add(extracted)
		}
		return [...ports].filter((p) => Number.isInteger(p) && p > 0 && p <= 65535)
	}

	private extractPortsFromCommand(command: string): number[] {
		const ports: number[] = []

		const patterns = [
			/(?:^|\s)PORT=(\d{2,5})(?:\s|$)/g,
			/(?:^|\s)--port(?:=|\s+)(\d{2,5})(?:\s|$)/g,
			/(?:^|\s)-p(?:=|\s+)(\d{2,5})(?:\s|$)/g,
		]

		for (const pattern of patterns) {
			let match: RegExpExecArray | null
			while ((match = pattern.exec(command)) !== null) {
				const port = Number(match[1])
				if (Number.isInteger(port) && port > 0 && port <= 65535) {
					ports.push(port)
				}
			}
		}

		return ports
	}

	private async pathExists(p: string): Promise<boolean> {
		try {
			await fs.access(p)
			return true
		} catch {
			return false
		}
	}
}
