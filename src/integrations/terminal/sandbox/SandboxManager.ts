import * as vscode from "vscode"

import { Package } from "../../../shared/package"

import type { CommandSandbox, SandboxConfig } from "./types"
import { DEFAULT_SANDBOX_CONFIG } from "./types"
import { SrtSandbox } from "./SrtSandbox"
import { NoOpSandbox } from "./NoOpSandbox"

/**
 * Manages command sandbox configuration and provides the appropriate
 * sandbox implementation based on user settings.
 *
 * The SandboxManager reads VS Code configuration to determine whether
 * sandboxing is enabled and which policies to apply, then returns either
 * an SrtSandbox (for real isolation) or a NoOpSandbox (passthrough).
 */
export class SandboxManager {
	private static instance: SandboxManager | undefined
	private sandbox: CommandSandbox | undefined
	private lastConfig: SandboxConfig | undefined

	/**
	 * Get the singleton SandboxManager instance.
	 */
	static getInstance(): SandboxManager {
		if (!SandboxManager.instance) {
			SandboxManager.instance = new SandboxManager()
		}
		return SandboxManager.instance
	}

	/**
	 * Read sandbox configuration from VS Code settings.
	 */
	getConfig(): SandboxConfig {
		const config = vscode.workspace.getConfiguration(Package.name)

		return {
			enabled: config.get<boolean>("commandSandboxEnabled", DEFAULT_SANDBOX_CONFIG.enabled),
			networkPolicy: config.get<"allow" | "deny">(
				"commandSandboxNetworkPolicy",
				DEFAULT_SANDBOX_CONFIG.networkPolicy,
			),
			writePolicy: config.get<"allow" | "deny">("commandSandboxWritePolicy", DEFAULT_SANDBOX_CONFIG.writePolicy),
			allowedPaths: config.get<string[]>("commandSandboxAllowedPaths", DEFAULT_SANDBOX_CONFIG.allowedPaths),
			deniedPaths: config.get<string[]>("commandSandboxDeniedPaths", DEFAULT_SANDBOX_CONFIG.deniedPaths),
		}
	}

	/**
	 * Get the appropriate sandbox implementation based on current configuration.
	 * Returns a NoOpSandbox if sandboxing is disabled, or an SrtSandbox if enabled.
	 *
	 * The sandbox instance is cached and reused as long as the configuration
	 * hasn't changed.
	 */
	getSandbox(): CommandSandbox {
		const config = this.getConfig()

		// Return cached sandbox if config hasn't changed
		if (this.sandbox && this.lastConfig && configsEqual(this.lastConfig, config)) {
			return this.sandbox
		}

		this.lastConfig = config

		if (!config.enabled) {
			this.sandbox = new NoOpSandbox()
		} else {
			this.sandbox = new SrtSandbox(config)
		}

		return this.sandbox
	}

	/**
	 * Wrap a command using the current sandbox configuration.
	 *
	 * @param command The command to potentially wrap
	 * @param cwd The working directory for the command
	 * @returns The (possibly wrapped) command string
	 */
	wrapCommand(command: string, cwd: string): string {
		return this.getSandbox().wrapCommand(command, cwd)
	}

	/**
	 * Check if the current sandbox provider is available.
	 */
	async isAvailable(): Promise<boolean> {
		return this.getSandbox().isAvailable()
	}

	/**
	 * Reset the singleton instance (for testing).
	 */
	static resetInstance(): void {
		SandboxManager.instance = undefined
	}
}

/**
 * Deep-compare two SandboxConfig objects for equality.
 */
function configsEqual(a: SandboxConfig, b: SandboxConfig): boolean {
	return (
		a.enabled === b.enabled &&
		a.networkPolicy === b.networkPolicy &&
		a.writePolicy === b.writePolicy &&
		arraysEqual(a.allowedPaths, b.allowedPaths) &&
		arraysEqual(a.deniedPaths, b.deniedPaths)
	)
}

function arraysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false
		}
	}

	return true
}
