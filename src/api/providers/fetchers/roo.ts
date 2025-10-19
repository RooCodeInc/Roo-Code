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
		const urlObj = new URL(baseUrl)
		urlObj.pathname = urlObj.pathname.replace(/\/+$/, "").replace(/\/+/g, "/") + "/v1/models"
		const url = urlObj.href

		// Added timeout to prevent indefinite hanging
		const response = await axios.get(url, { headers, timeout: 10000 })
		const models: ModelRecord = {}

		// Process the model info from the response
		// Expected format: { object: "list", data: [{ id: string, object: "model", created: number, owned_by: string }] }
		if (response.data && response.data.data && Array.isArray(response.data.data)) {
			for (const model of response.data.data) {
				const modelId = model.id

				if (!modelId) continue

				// For Roo Code Cloud, we provide basic model info
				// The actual detailed model info is stored in the static rooModels definition
				// This just confirms which models are available
				models[modelId] = {
					maxTokens: 16_384, // Default fallback
					contextWindow: 262_144, // Default fallback
					supportsImages: false,
					supportsPromptCache: true,
					inputPrice: 0,
					outputPrice: 0,
					description: `Model available through Roo Code Cloud`,
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
