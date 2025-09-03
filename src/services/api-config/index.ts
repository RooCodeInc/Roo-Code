import type { ContextProxy } from "../../core/config/ContextProxy"
import { logger } from "../../utils/logging"
import { ApiConfigService } from "./ApiConfigService"
import { ConfigMapper } from "./ConfigMapper"
import { ConfigApplier } from "./ConfigApplier"
import type { ApiConfigOptions } from "./types"

/**
 * Result of the complete API configuration process
 */
export interface ApiConfigResult {
	success: boolean
	appliedSettings: string[]
	errors: string[]
	skipped?: boolean
}

/**
 * Main API Configuration Manager
 * Orchestrates fetching, mapping, and applying configuration from API endpoint
 */
export class ApiConfigManager {
	private readonly apiService: ApiConfigService
	private readonly configApplier: ConfigApplier

	constructor(
		private readonly contextProxy: ContextProxy,
		options: ApiConfigOptions,
	) {
		this.apiService = new ApiConfigService(options)
		this.configApplier = new ConfigApplier(contextProxy)
	}

	/**
	 * Load and apply configuration from API endpoint
	 */
	async loadAndApplyConfiguration(): Promise<ApiConfigResult> {
		logger.info("[ApiConfigManager] Starting API configuration load process")

		try {
			// Fetch configuration from API
			const apiResult = await this.apiService.fetchConfiguration()

			if (!apiResult.success) {
				return {
					success: false,
					appliedSettings: [],
					errors: [apiResult.error || "Failed to fetch configuration from API"],
					skipped: true,
				}
			}

			if (!apiResult.config) {
				return {
					success: false,
					appliedSettings: [],
					errors: ["API returned empty configuration"],
					skipped: true,
				}
			}

			// Map API response to extension configuration
			const mappedConfig = ConfigMapper.mapConfiguration(apiResult.config)

			// Validate mapped configuration
			const validation = ConfigMapper.validateConfiguration(mappedConfig)
			if (!validation.valid) {
				logger.warn(`[ApiConfigManager] Configuration validation warnings: ${validation.errors.join(", ")}`)
			}

			// Apply configuration to extension
			const applicationResult = await this.configApplier.applyConfiguration(mappedConfig)

			logger.info(
				`[ApiConfigManager] Configuration load completed. Success: ${applicationResult.success}, Applied: ${applicationResult.appliedSettings.length}, Errors: ${applicationResult.errors.length}`,
			)

			return {
				success: applicationResult.success,
				appliedSettings: applicationResult.appliedSettings,
				errors: [...validation.errors, ...applicationResult.errors],
			}
		} catch (error) {
			const errorMessage = `Unexpected error during configuration load: ${error instanceof Error ? error.message : String(error)}`
			logger.error(`[ApiConfigManager] ${errorMessage}`)

			return {
				success: false,
				appliedSettings: [],
				errors: [errorMessage],
			}
		}
	}

	/**
	 * Test API connectivity
	 */
	async testConnection(): Promise<boolean> {
		return this.apiService.testConnection()
	}

	/**
	 * Get current API configuration options
	 */
	getApiOptions(): ApiConfigOptions {
		return this.apiService.getOptions()
	}

	/**
	 * Update API configuration options
	 */
	updateApiOptions(options: Partial<ApiConfigOptions>): void {
		this.apiService.updateOptions(options)
	}

	/**
	 * Create instance with default options
	 */
	static create(contextProxy: ContextProxy, endpoint: string = "http://localhost:6123"): ApiConfigManager {
		const options: ApiConfigOptions = {
			endpoint,
			timeout: 10000,
			retries: 2,
			enabled: process.env.ROOCODE_API_CONFIG_ENABLED !== "false", // Allow disabling via env var
		}

		return new ApiConfigManager(contextProxy, options)
	}
}

// Export all types and classes
export * from "./types"
export * from "./ApiConfigService"
export * from "./ConfigMapper"
export * from "./ConfigApplier"
