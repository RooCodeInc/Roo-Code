import type { ContextProxy } from "../../core/config/ContextProxy"
import { logger } from "../../utils/logging"
import type { MappedConfiguration } from "./ConfigMapper"

/**
 * Result of applying configuration
 */
export interface ConfigApplicationResult {
	success: boolean
	appliedSettings: string[]
	errors: string[]
}

/**
 * Applies mapped configuration to the extension state
 */
export class ConfigApplier {
	constructor(private readonly contextProxy: ContextProxy) {}

	/**
	 * Apply the mapped configuration to extension state
	 */
	async applyConfiguration(config: MappedConfiguration): Promise<ConfigApplicationResult> {
		logger.info("[ConfigApplier] Applying configuration to extension")

		const result: ConfigApplicationResult = {
			success: true,
			appliedSettings: [],
			errors: [],
		}

		// Apply provider settings
		await this.applyProviderSettings(config, result)

		// Apply global settings
		await this.applyGlobalSettings(config, result)

		// Apply secrets
		await this.applySecrets(config, result)

		// Apply code index settings
		await this.applyCodeIndexSettings(config, result)

		if (result.errors.length > 0) {
			result.success = false
			logger.error(`[ConfigApplier] Configuration application completed with ${result.errors.length} errors`)
		} else {
			logger.info(`[ConfigApplier] Successfully applied ${result.appliedSettings.length} settings`)
		}

		return result
	}

	/**
	 * Apply provider settings
	 */
	private async applyProviderSettings(config: MappedConfiguration, result: ConfigApplicationResult): Promise<void> {
		if (Object.keys(config.providerSettings).length === 0) {
			return
		}

		try {
			// Get current provider settings and merge with new ones
			const currentProviderSettings = this.contextProxy.getProviderSettings()
			const mergedSettings = {
				...currentProviderSettings,
				...config.providerSettings,
			}

			await this.contextProxy.setProviderSettings(mergedSettings)

			// Track applied settings
			Object.keys(config.providerSettings).forEach((key) => {
				result.appliedSettings.push(`providerSettings.${key}`)
			})

			logger.info("[ConfigApplier] Applied provider settings")
		} catch (error) {
			const errorMessage = `Failed to apply provider settings: ${error instanceof Error ? error.message : String(error)}`
			result.errors.push(errorMessage)
			logger.error(`[ConfigApplier] ${errorMessage}`)
		}
	}

	/**
	 * Apply global settings
	 */
	private async applyGlobalSettings(config: MappedConfiguration, result: ConfigApplicationResult): Promise<void> {
		if (Object.keys(config.globalSettings).length === 0) {
			return
		}

		try {
			// Apply each global setting individually
			for (const [key, value] of Object.entries(config.globalSettings)) {
				if (value !== undefined) {
					await this.contextProxy.setValue(key as any, value)
					result.appliedSettings.push(`globalSettings.${key}`)
				}
			}

			logger.info("[ConfigApplier] Applied global settings")
		} catch (error) {
			const errorMessage = `Failed to apply global settings: ${error instanceof Error ? error.message : String(error)}`
			result.errors.push(errorMessage)
			logger.error(`[ConfigApplier] ${errorMessage}`)
		}
	}

	/**
	 * Apply secrets (API keys and other sensitive data)
	 */
	private async applySecrets(config: MappedConfiguration, result: ConfigApplicationResult): Promise<void> {
		if (Object.keys(config.secrets).length === 0) {
			return
		}

		const secretPromises = Object.entries(config.secrets).map(async ([key, value]) => {
			try {
				if (value && value.trim()) {
					await this.contextProxy.setValue(key as any, value.trim())
					result.appliedSettings.push(`secrets.${key}`)
				}
			} catch (error) {
				const errorMessage = `Failed to set secret ${key}: ${error instanceof Error ? error.message : String(error)}`
				result.errors.push(errorMessage)
				logger.error(`[ConfigApplier] ${errorMessage}`)
			}
		})

		await Promise.all(secretPromises)
		logger.info(`[ConfigApplier] Applied ${Object.keys(config.secrets).length} secrets`)
	}

	/**
	 * Apply code index settings
	 */
	private async applyCodeIndexSettings(config: MappedConfiguration, result: ConfigApplicationResult): Promise<void> {
		if (Object.keys(config.codeIndexSettings).length === 0) {
			return
		}

		try {
			// Get current code index config and merge with new settings
			const currentConfig = this.contextProxy.getGlobalState("codebaseIndexConfig") ?? {}
			const mergedConfig = {
				...currentConfig,
				...config.codeIndexSettings,
			}

			await this.contextProxy.updateGlobalState("codebaseIndexConfig", mergedConfig)

			// Track applied settings
			Object.keys(config.codeIndexSettings).forEach((key) => {
				result.appliedSettings.push(`codeIndexSettings.${key}`)
			})

			logger.info("[ConfigApplier] Applied code index settings")
		} catch (error) {
			const errorMessage = `Failed to apply code index settings: ${error instanceof Error ? error.message : String(error)}`
			result.errors.push(errorMessage)
			logger.error(`[ConfigApplier] ${errorMessage}`)
		}
	}

	/**
	 * Test if we can apply configuration (dry run)
	 */
	async testConfiguration(config: MappedConfiguration): Promise<ConfigApplicationResult> {
		logger.info("[ConfigApplier] Testing configuration (dry run)")

		const result: ConfigApplicationResult = {
			success: true,
			appliedSettings: [],
			errors: [],
		}

		// Check if context proxy is initialized
		if (!this.contextProxy.isInitialized) {
			result.errors.push("ContextProxy is not initialized")
			result.success = false
			return result
		}

		// Validate that we have required permissions/access
		try {
			// Test reading current settings
			this.contextProxy.getProviderSettings()
			this.contextProxy.getGlobalState("customInstructions")

			// Count what would be applied
			result.appliedSettings = [
				...Object.keys(config.providerSettings).map((k) => `providerSettings.${k}`),
				...Object.keys(config.globalSettings).map((k) => `globalSettings.${k}`),
				...Object.keys(config.secrets).map((k) => `secrets.${k}`),
				...Object.keys(config.codeIndexSettings).map((k) => `codeIndexSettings.${k}`),
			]

			logger.info(`[ConfigApplier] Dry run successful, would apply ${result.appliedSettings.length} settings`)
		} catch (error) {
			const errorMessage = `Configuration test failed: ${error instanceof Error ? error.message : String(error)}`
			result.errors.push(errorMessage)
			result.success = false
			logger.error(`[ConfigApplier] ${errorMessage}`)
		}

		return result
	}
}
