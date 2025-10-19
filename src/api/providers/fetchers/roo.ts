import axios from "axios"

import { RooModelsResponseSchema } from "@roo-code/types"

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

		// Validate response against schema
		const parsed = RooModelsResponseSchema.safeParse(response.data)

		if (!parsed.success) {
			console.error("Error fetching Roo Code Cloud models: Unexpected response format", response.data)
			console.error("Validation errors:", parsed.error.format())
			throw new Error("Failed to fetch Roo Code Cloud models: Unexpected response format.")
		}

		// Process the validated model data
		for (const model of parsed.data.data) {
			const modelId = model.id

			if (!modelId) continue

			// Extract model data from the validated API response
			// All required fields are guaranteed by the schema
			const contextWindow = model.context_window
			const maxTokens = model.max_tokens
			const tags = model.tags || []
			const pricing = model.pricing

			// Determine if the model supports images based on tags
			const supportsImages = tags.includes("vision")

			// Parse pricing (API returns strings, convert to numbers)
			const inputPrice = parseFloat(pricing.input)
			const outputPrice = parseFloat(pricing.output)
			const cacheReadPrice = pricing.input_cache_read ? parseFloat(pricing.input_cache_read) : undefined
			const cacheWritePrice = pricing.input_cache_write ? parseFloat(pricing.input_cache_write) : undefined

			models[modelId] = {
				maxTokens,
				contextWindow,
				supportsImages,
				supportsPromptCache: Boolean(cacheReadPrice !== undefined),
				inputPrice,
				outputPrice,
				cacheWritesPrice: cacheWritePrice,
				cacheReadsPrice: cacheReadPrice,
				description: model.description || model.name,
				deprecated: model.deprecated || false,
			}
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
