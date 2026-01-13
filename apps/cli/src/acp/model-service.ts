/**
 * Model Service for ACP
 *
 * Fetches and caches available models from the Roo Code API.
 */

import type { ModelInfo } from "@agentclientprotocol/sdk"

import { DEFAULT_MODELS } from "./types.js"
import { acpLog } from "./logger.js"

const DEFAULT_API_URL = "https://api.roocode.com"
const DEFAULT_TIMEOUT = 5_000

interface RooModel {
	id: string
	name: string
	description?: string
	object?: string
	created?: number
	owned_by?: string
}

export interface ModelServiceOptions {
	/** Base URL for the API (defaults to DEFAULT_API_URL) */
	apiUrl?: string
	/** API key for authentication */
	apiKey?: string
	/** Request timeout in milliseconds (defaults to DEFAULT_TIMEOUT) */
	timeout?: number
}

/**
 * Service for fetching and managing available models.
 */
export class ModelService {
	private readonly apiUrl: string
	private readonly apiKey?: string
	private readonly timeout: number
	private cachedModels: ModelInfo[] | null = null

	constructor(options: ModelServiceOptions = {}) {
		this.apiUrl = options.apiUrl || DEFAULT_API_URL
		this.apiKey = options.apiKey
		this.timeout = options.timeout || DEFAULT_TIMEOUT
	}

	/**
	 * Fetch available models from the API.
	 * Returns cached models if available, otherwise fetches from API.
	 * Falls back to default models on error.
	 */
	async fetchAvailableModels(): Promise<ModelInfo[]> {
		if (this.cachedModels) {
			return this.cachedModels
		}

		try {
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), this.timeout)

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			}

			if (this.apiKey) {
				headers["Authorization"] = `Bearer ${this.apiKey}`
			}

			const response = await fetch(`${this.apiUrl}/proxy/v1/models`, {
				method: "GET",
				headers,
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			if (!response.ok) {
				acpLog.warn("ModelService", `API returned ${response.status}, using default models`)
				this.cachedModels = DEFAULT_MODELS
				return this.cachedModels
			}

			const data = await response.json()

			if (!data.data || !Array.isArray(data.data)) {
				acpLog.warn("ModelService", "Invalid API response format, using default models")
				this.cachedModels = DEFAULT_MODELS
				return this.cachedModels
			}

			this.cachedModels = this.translateModels(data.data)
			return this.cachedModels
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				acpLog.warn("ModelService", "Request timed out, using default models")
			} else {
				acpLog.warn(
					"ModelService",
					`Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`,
				)
			}

			this.cachedModels = DEFAULT_MODELS
			return this.cachedModels
		}
	}

	/**
	 * Clear the cached models, forcing a refresh on next fetch.
	 */
	clearCache(): void {
		this.cachedModels = null
	}

	private translateModels(data: RooModel[]): ModelInfo[] {
		const models: ModelInfo[] = data
			.map(({ id, name, description }) => ({ modelId: id, name, description }))
			.sort((a, b) => a.modelId.localeCompare(b.modelId))

		return models.length === 0 ? DEFAULT_MODELS : models
	}
}

/**
 * Create a new ModelService instance.
 */
export function createModelService(options?: ModelServiceOptions): ModelService {
	return new ModelService(options)
}
