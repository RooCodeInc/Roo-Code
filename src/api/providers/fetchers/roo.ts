import axios from "axios"

import type { ModelRecord } from "../../../shared/api"

import { DEFAULT_HEADERS } from "../constants"

/**
 * Fetches available models from the Roo Code Cloud provider
 *
 * @param baseUrl The base URL of the Roo Code Cloud provider
 * @param apiKey The API key (session token) for the Roo Code Cloud provider
 * @returns A promise that resolves to a record of model IDs to model info
 * @throws Will throw an error if the request fails or the response is not as expected.
 */
export async function getRooModels(baseUrl: string, apiKey?: string): Promise<ModelRecord> {
	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...DEFAULT_HEADERS,
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		// Normalize the URL to ensure proper /v1/models endpoint construction
		// Remove any trailing /v1 to avoid duplication
		const urlObj = new URL(baseUrl)
		let pathname = urlObj.pathname.replace(/\/+$/, "").replace(/\/+/g, "/")
		// Remove trailing /v1 if present to avoid /v1/v1/models
		if (pathname.endsWith("/v1")) {
			pathname = pathname.slice(0, -3)
		}
		urlObj.pathname = pathname + "/v1/models"
		const url = urlObj.href

		// Added timeout to prevent indefinite hanging
		const response = await axios.get(url, { headers, timeout: 10000 })
		const models: ModelRecord = {}
		// Process the model info from the response
		// Expected format: { object: "list", data: [{ id, name, description, context_window, max_tokens, tags, pricing }] }
		if (response.data && response.data.data && Array.isArray(response.data.data)) {
			for (const model of response.data.data) {
				const modelId = model.id

				if (!modelId) continue

				// Extract model data from the API response
				const contextWindow = model.context_window || 262_144
				const maxTokens = model.max_tokens || 16_384
				const tags = model.tags || []
				const pricing = model.pricing || {}

				// Determine if the model supports images based on tags
				const supportsImages = tags.includes("vision") || tags.includes("image")

				// Parse pricing (API returns strings, convert to numbers)
				// Handle both direct pricing and cache pricing if available
				const inputPrice = pricing.input ? parseFloat(pricing.input) : 0
				const outputPrice = pricing.output ? parseFloat(pricing.output) : 0
				const cacheReadPrice = pricing.input_cache_read ? parseFloat(pricing.input_cache_read) : undefined
				const cacheWritePrice = pricing.input_cache_write ? parseFloat(pricing.input_cache_write) : undefined

				models[modelId] = {
					maxTokens,
					contextWindow,
					supportsImages,
					supportsPromptCache: Boolean(cacheReadPrice !== undefined || cacheWritePrice !== undefined),
					inputPrice,
					outputPrice,
					cacheWritesPrice: cacheWritePrice,
					cacheReadsPrice: cacheReadPrice,
					description: model.description || model.name || `Model available through Roo Code Cloud`,
					deprecated: model.deprecated || false,
				}
			}
		} else {
			// If response.data.data is not in the expected format, consider it an error.
			console.error("Error fetching Roo Code Cloud models: Unexpected response format", response.data)
			throw new Error("Failed to fetch Roo Code Cloud models: Unexpected response format.")
		}

		return models
	} catch (error: any) {
		console.error("Error fetching Roo Code Cloud models:", error.message ? error.message : error)
		if (axios.isAxiosError(error) && error.response) {
			throw new Error(
				`Failed to fetch Roo Code Cloud models: ${error.response.status} ${error.response.statusText}. Check base URL and API key.`,
			)
		} else if (axios.isAxiosError(error) && error.request) {
			throw new Error(
				"Failed to fetch Roo Code Cloud models: No response from server. Check Roo Code Cloud server status and base URL.",
			)
		} else {
			throw new Error(`Failed to fetch Roo Code Cloud models: ${error.message || "An unknown error occurred."}`)
		}
	}
}
