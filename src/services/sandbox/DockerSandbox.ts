import { execFile } from "child_process"
import { promisify } from "util"

import { type SandboxConfig, resolveSandboxConfig } from "./SandboxConfig"

const execFileAsync = promisify(execFile)

interface SandboxExecResult {
	stdout: string
	stderr: string
	exitCode: number
	timedOut: boolean
}

/**
 * Docker-based sandbox for executing commands in an isolated container.
 * Requires Docker to be installed and running on the host.
 *
 * This is behind the `experiments.sandboxExecution` feature flag.
 */
export class DockerSandbox {
	private readonly config: SandboxConfig
	private dockerAvailable?: boolean

	constructor(
		private readonly workspacePath: string,
		configOverrides?: Partial<SandboxConfig>,
	) {
		this.config = resolveSandboxConfig(configOverrides)
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
	 */
	async exec(command: string, cwd?: string): Promise<SandboxExecResult> {
		if (!(await this.isAvailable())) {
			throw new Error(
				"Docker is not available. Install Docker and ensure the Docker daemon is running to use sandbox execution.",
			)
		}

		const args = this.buildDockerArgs(command, cwd)

		try {
			const { stdout, stderr } = await execFileAsync("docker", args, {
				timeout: this.config.maxExecutionTime,
				maxBuffer: 10 * 1024 * 1024, // 10MB
			})

			return {
				stdout,
				stderr,
				exitCode: 0,
				timedOut: false,
			}
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
				exitCode: error.code ?? 1,
				timedOut: false,
			}
		}
	}

	private buildDockerArgs(command: string, cwd?: string): string[] {
		const args: string[] = ["run", "--rm"]

		// Memory limit
		args.push(`--memory=${this.config.memoryLimit}`)

		// Network access
		if (this.config.networkAccess === "none") {
			args.push("--network=none")
		} else if (this.config.networkAccess === "restricted") {
			// Use default bridge network but limit capabilities
			args.push("--cap-drop=ALL")
			args.push("--cap-add=NET_RAW")
		}

		// Security options
		args.push("--security-opt=no-new-privileges")

		// Mount workspace read-only
		if (this.config.mountWorkspace) {
			const normalizedPath = this.workspacePath.replace(/\\/g, "/")
			args.push(`-v`, `${normalizedPath}:/workspace:ro`)
		}

		// Additional allowed mounts
		for (const mount of this.config.allowedMounts) {
			const normalizedMount = mount.replace(/\\/g, "/")
			args.push(`-v`, `${normalizedMount}:/mnt/${normalizedMount.split("/").pop()}:rw`)
		}

		// Working directory
		const workdir = cwd ? `/workspace/${cwd}` : "/workspace"
		args.push(`-w`, workdir)

		// Image
		args.push(this.config.image)

		// Command - use sh -c to support pipes and redirects
		args.push("sh", "-c", command)

		return args
	}
}
