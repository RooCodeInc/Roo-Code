import axios, { AxiosError } from "axios"
import { logger } from "../../utils/logging"
import type { ApiConfigResponse, ApiConfigResult, ApiConfigOptions } from "./types"

/**
 * Service to fetch configuration from external API endpoint
 */
export class ApiConfigService {
	private readonly options: Required<ApiConfigOptions>

	constructor(options: ApiConfigOptions) {
		this.options = {
			timeout: 10000, // 10 seconds default
			retries: 2,
			enabled: true,
			...options,
		}
	}

	/**
	 * Fetch configuration from the API endpoint
	 */
	async fetchConfiguration(): Promise<ApiConfigResult> {
		if (!this.options.enabled) {
			logger.info("[ApiConfig] API configuration loading is disabled")
			return { success: false, error: "API configuration loading is disabled" }
		}

		logger.info(`[ApiConfig] Fetching configuration from ${this.options.endpoint}`)

		let lastError: string | undefined

		for (let attempt = 1; attempt <= this.options.retries + 1; attempt++) {
			try {
				const response = await axios.get<ApiConfigResponse>(this.options.endpoint, {
					timeout: this.options.timeout,
					headers: {
						"Content-Type": "application/json",
						"User-Agent": "Charles-Extension/1.0",
					},
					validateStatus: (status) => status >= 200 && status < 300,
				})

				logger.info("[ApiConfig] Successfully fetched configuration from API")
				return {
					success: true,
					config: response.data,
				}
			} catch (error) {
				const errorMessage = this.formatError(error)
				lastError = errorMessage

				if (attempt <= this.options.retries) {
					logger.warn(`[ApiConfig] Attempt ${attempt} failed: ${errorMessage}. Retrying...`)
					// Simple exponential backoff
					await this.delay(1000 * attempt)
				} else {
					logger.error(
						`[ApiConfig] All ${this.options.retries + 1} attempts failed. Last error: ${errorMessage}`,
					)
				}
			}
		}

		return {
			success: false,
			error: lastError || "Unknown error occurred",
		}
	}

	/**
	 * Test connectivity to the API endpoint
	 */
	async testConnection(): Promise<boolean> {
		try {
			const response = await axios.head(this.options.endpoint, {
				timeout: 5000,
			})
			return response.status >= 200 && response.status < 300
		} catch (error) {
			logger.warn(`[ApiConfig] Connection test failed: ${this.formatError(error)}`)
			return false
		}
	}

	/**
	 * Format error for logging
	 */
	private formatError(error: unknown): string {
		if (axios.isAxiosError(error)) {
			const axiosError = error as AxiosError

			if (axiosError.code === "ECONNREFUSED") {
				return `Connection refused to ${this.options.endpoint}`
			}

			if (axiosError.code === "ECONNABORTED") {
				return `Request timeout after ${this.options.timeout}ms`
			}

			if (axiosError.response) {
				return `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`
			}

			if (axiosError.request) {
				return `No response received from ${this.options.endpoint}`
			}

			return axiosError.message
		}

		if (error instanceof Error) {
			return error.message
		}

		return String(error)
	}

	/**
	 * Simple delay utility
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Get current options
	 */
	getOptions(): ApiConfigOptions {
		return { ...this.options }
	}

	/**
	 * Update options
	 */
	updateOptions(newOptions: Partial<ApiConfigOptions>): void {
		Object.assign(this.options, newOptions)
	}
}
