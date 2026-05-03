/**
 * FIM Service - Orchestrates the FIM inline completion lifecycle.
 *
 * Manages the registration and disposal of the FimCompletionProvider
 * based on user settings. Listens for configuration changes to
 * enable/disable the provider dynamically.
 */

import * as vscode from "vscode"

import type { GlobalSettings } from "@roo-code/types"

import { FimCompletionProvider, type FimProviderConfig } from "./FimCompletionProvider"

/**
 * Extract FIM configuration from global settings.
 */
function extractFimConfig(settings: GlobalSettings, apiKey?: string): FimProviderConfig {
	return {
		enabled: settings.fimEnabled ?? false,
		provider: settings.fimProvider ?? "openai-compatible",
		modelId: settings.fimModelId ?? "",
		baseUrl: settings.fimBaseUrl,
		apiKey,
		debounceMs: settings.fimDebounceMs,
		maxTokens: settings.fimMaxTokens,
	}
}

export class FimService implements vscode.Disposable {
	private provider: FimCompletionProvider | null = null
	private registration: vscode.Disposable | null = null
	private outputChannel: vscode.OutputChannel

	constructor(outputChannel: vscode.OutputChannel) {
		this.outputChannel = outputChannel
	}

	/**
	 * Initialize or update the FIM service based on current settings.
	 */
	updateSettings(settings: GlobalSettings, apiKey?: string): void {
		const config = extractFimConfig(settings, apiKey)

		if (!config.enabled || !config.modelId) {
			this.deactivate()
			return
		}

		if (this.provider) {
			// Update existing provider config
			this.provider.updateConfig(config)
			this.outputChannel.appendLine(
				`[FIM] Updated configuration: provider=${config.provider}, model=${config.modelId}`,
			)
		} else {
			// Create and register new provider
			this.activate(config)
		}
	}

	/**
	 * Activate the FIM completion provider.
	 */
	private activate(config: FimProviderConfig): void {
		this.provider = new FimCompletionProvider(config)

		this.registration = vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, this.provider)

		this.outputChannel.appendLine(`[FIM] Activated: provider=${config.provider}, model=${config.modelId}`)
	}

	/**
	 * Deactivate the FIM completion provider.
	 */
	private deactivate(): void {
		if (this.registration) {
			this.registration.dispose()
			this.registration = null
		}

		if (this.provider) {
			this.provider.dispose()
			this.provider = null
			this.outputChannel.appendLine("[FIM] Deactivated")
		}
	}

	/**
	 * Check if the FIM service is currently active.
	 */
	isActive(): boolean {
		return this.provider !== null
	}

	/**
	 * Dispose of the FIM service and all resources.
	 */
	dispose(): void {
		this.deactivate()
	}
}
