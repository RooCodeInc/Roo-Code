import { execFile } from "child_process"
import * as crypto from "crypto"
import * as path from "path"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

const DEFAULT_BROWSER_IMAGE = "ghcr.io/puppeteer/puppeteer:latest"
const CONTAINER_PORT = 9222

type InspectResult = { exists: false } | { exists: true; running: boolean; configHash?: string }

export class DockerBrowser {
	private static readonly ensureLocks = new Map<string, Promise<{ browserUrl: string; containerName: string }>>()

	static async isAvailable(): Promise<boolean> {
		try {
			await execFileAsync("docker", ["info"], { timeout: 5000 })
			return true
		} catch {
			return false
		}
	}

	static async ensureRunning(
		workspacePath: string,
		options?: { image?: string; networkAccess?: "full" | "restricted" | "none" },
	): Promise<{ browserUrl: string; containerName: string }> {
		const resolved = path.resolve(workspacePath)
		const workspaceHash = this.hashString(resolved).slice(0, 12)
		const containerName = `roo-browser-${workspaceHash}`
		const image = options?.image ?? DEFAULT_BROWSER_IMAGE
		const networkAccess = options?.networkAccess ?? "restricted"
		const configHash = this.hashString(JSON.stringify({ v: 1, image, networkAccess }))

		if (!(await this.isAvailable())) {
			throw new Error("Docker is not available.")
		}

		const existingLock = this.ensureLocks.get(containerName)
		if (existingLock) {
			return existingLock
		}

		const lock = (async () => {
			const inspected = await this.inspect(containerName)
			if (!inspected.exists) {
				await this.create(containerName, { image, networkAccess, configHash, workspaceHash })
			} else if (inspected.configHash && inspected.configHash !== configHash) {
				await this.remove(containerName)
				await this.create(containerName, { image, networkAccess, configHash, workspaceHash })
			} else if (!inspected.running) {
				await this.docker(["start", containerName], { timeout: 15_000 })
			}

			const browserUrl = await this.resolveBrowserUrl(containerName)
			return { browserUrl, containerName }
		})()

		this.ensureLocks.set(containerName, lock)
		try {
			return await lock
		} finally {
			this.ensureLocks.delete(containerName)
		}
	}

	static async stop(workspacePath: string): Promise<void> {
		const resolved = path.resolve(workspacePath)
		const workspaceHash = this.hashString(resolved).slice(0, 12)
		await this.remove(`roo-browser-${workspaceHash}`)
	}

	private static async inspect(containerName: string): Promise<InspectResult> {
		try {
			const { stdout } = await this.docker(
				[
					"inspect",
					"--format",
					'{{.State.Running}}|{{ index .Config.Labels "roo.browser.configHash" }}',
					containerName,
				],
				{ timeout: 10_000 },
			)
			const [runningRaw, hashRaw] = stdout.trim().split("|")
			return { exists: true, running: runningRaw === "true", configHash: hashRaw || undefined }
		} catch {
			return { exists: false }
		}
	}

	private static async create(
		containerName: string,
		options: {
			image: string
			networkAccess: "full" | "restricted" | "none"
			configHash: string
			workspaceHash: string
		},
	): Promise<void> {
		const args: string[] = ["run", "-d", "--rm", "--name", containerName]

		args.push("--label", "roo.browser=1")
		args.push("--label", `roo.browser.workspaceHash=${options.workspaceHash}`)
		args.push("--label", `roo.browser.configHash=${options.configHash}`)

		// Chrome needs shared memory; keep it modest but workable.
		args.push("--shm-size=1g")

		if (options.networkAccess === "none") {
			args.push("--network=none")
		} else if (options.networkAccess === "restricted") {
			args.push("--cap-drop=ALL", "--cap-add=NET_RAW")
		}

		args.push("--security-opt=no-new-privileges")

		// Publish CDP port to a random host port (avoid collisions).
		args.push("-p", `0:${CONTAINER_PORT}`)

		// Persist browser profile for login/auth flows.
		args.push("-v", `roo_browser_data_${options.workspaceHash}:/data:rw`)

		args.push(options.image)

		// Start headless Chrome with remote debugging enabled.
		args.push(
			"sh",
			"-lc",
			[
				'BROWSER_BIN="$(command -v google-chrome-stable || command -v google-chrome || command -v chromium || command -v chromium-browser || true)"',
				'[ -n "$BROWSER_BIN" ] || { echo "No Chrome/Chromium binary found in image."; exit 1; }',
				'exec "$BROWSER_BIN" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage ' +
					`--remote-debugging-address=0.0.0.0 --remote-debugging-port=${CONTAINER_PORT} ` +
					"--user-data-dir=/data about:blank",
			].join(" && "),
		)

		await this.docker(args, { timeout: 120_000 })
	}

	private static async remove(containerName: string): Promise<void> {
		try {
			await this.docker(["rm", "-f", containerName], { timeout: 30_000 })
		} catch {
			// Best-effort cleanup
		}
	}

	private static async resolveBrowserUrl(containerName: string): Promise<string> {
		const mappings = await this.getPublishedPortMappings(containerName, CONTAINER_PORT)
		// mapping is e.g. "0.0.0.0:49153" or "[::]:49153"
		const first = mappings[0]
		const hostPort = first?.split(":").pop()
		if (!hostPort) {
			throw new Error("Failed to resolve Docker browser port mapping.")
		}
		return `http://127.0.0.1:${hostPort}`
	}

	private static async getPublishedPortMappings(containerName: string, containerPort: number): Promise<string[]> {
		try {
			const { stdout } = await this.docker(["port", containerName, String(containerPort)], { timeout: 10_000 })
			return stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
		} catch {
			return []
		}
	}

	private static hashString(input: string): string {
		return crypto.createHash("sha256").update(input).digest("hex")
	}

	private static async docker(
		args: string[],
		options?: { timeout?: number },
	): Promise<{ stdout: string; stderr: string }> {
		const { stdout, stderr } = await execFileAsync("docker", args, {
			timeout: options?.timeout,
			maxBuffer: 10 * 1024 * 1024,
		})
		return { stdout, stderr }
	}
}
