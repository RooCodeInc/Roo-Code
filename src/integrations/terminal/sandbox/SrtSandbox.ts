import { execa } from "execa"

import type { CommandSandbox, SandboxConfig } from "./types"

/**
 * Sandbox implementation using the `srt` CLI tool from Anthropic's sandbox-runtime.
 *
 * The `srt` tool wraps commands to run them in a sandboxed environment with
 * configurable network and filesystem isolation. This approach works with both
 * VSCode shell integration terminals and execa terminals since it wraps
 * commands at the string level.
 *
 * @see https://github.com/anthropic-experimental/sandbox-runtime
 */
export class SrtSandbox implements CommandSandbox {
	private config: SandboxConfig
	private availabilityChecked = false
	private available = false

	constructor(config: SandboxConfig) {
		this.config = config
	}

	/**
	 * Check if the `srt` CLI tool is available on the system.
	 * Caches the result after the first check.
	 */
	async isAvailable(): Promise<boolean> {
		if (this.availabilityChecked) {
			return this.available
		}

		try {
			await execa("srt", ["--version"])
			this.available = true
		} catch {
			this.available = false
		}

		this.availabilityChecked = true
		return this.available
	}

	/**
	 * Wrap a command with `srt exec` to run it in a sandboxed environment.
	 *
	 * The srt tool uses Linux namespaces (via bubblewrap) to provide:
	 * - Network isolation (--net=none)
	 * - Filesystem isolation (read-only bind mounts, allowed paths)
	 * - Process isolation
	 *
	 * @param command The command to sandbox
	 * @param cwd The working directory for the command
	 * @returns The wrapped command string ready for terminal execution
	 */
	wrapCommand(command: string, cwd: string): string {
		const args: string[] = ["srt", "exec"]

		// Network policy
		if (this.config.networkPolicy === "deny") {
			args.push("--net=none")
		}

		// Filesystem write policy
		if (this.config.writePolicy === "deny") {
			args.push("--readonly")
		}

		// Allowed paths: bind-mount them read-write
		const allowedPaths = this.config.allowedPaths.length > 0 ? this.config.allowedPaths : [cwd]

		for (const allowedPath of allowedPaths) {
			args.push(`--bind=${allowedPath}`)
		}

		// Denied paths
		for (const deniedPath of this.config.deniedPaths) {
			args.push(`--deny=${deniedPath}`)
		}

		// Set the working directory
		args.push(`--chdir=${cwd}`)

		// Add the separator and the actual command
		args.push("--")
		args.push("sh", "-c", escapeShellArg(command))

		return args.join(" ")
	}
}

/**
 * Escape a string for safe use as a single-quoted shell argument.
 * Wraps the value in single quotes, escaping any embedded single quotes.
 */
function escapeShellArg(arg: string): string {
	// Replace each single quote with: end quote, escaped quote, start quote
	return "'" + arg.replace(/'/g, "'\\''") + "'"
}
