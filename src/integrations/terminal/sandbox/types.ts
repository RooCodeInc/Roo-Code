/**
 * Configuration for command sandboxing.
 */
export interface SandboxConfig {
	/** Whether sandboxing is enabled */
	enabled: boolean
	/** Network access policy */
	networkPolicy: "allow" | "deny"
	/** Filesystem write policy */
	writePolicy: "allow" | "deny"
	/** Paths that sandboxed commands can access */
	allowedPaths: string[]
	/** Paths that sandboxed commands are denied access to */
	deniedPaths: string[]
}

/**
 * Interface for command sandbox implementations.
 * A sandbox wraps commands to execute them in an isolated environment.
 */
export interface CommandSandbox {
	/**
	 * Check if the sandbox provider is available on the system.
	 */
	isAvailable(): Promise<boolean>

	/**
	 * Wrap a command string with sandbox isolation.
	 * @param command The original command to wrap
	 * @param cwd The working directory for the command
	 * @returns The wrapped command string
	 */
	wrapCommand(command: string, cwd: string): string
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
	enabled: false,
	networkPolicy: "deny",
	writePolicy: "allow",
	allowedPaths: [],
	deniedPaths: [],
}
