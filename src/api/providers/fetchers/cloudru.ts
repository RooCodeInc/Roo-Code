import axios from "axios"

import type { ModelRecord } from "../../../shared/api"

import { DEFAULT_HEADERS } from "../constants"

/**
 * Fetches available models from Cloud.ru Foundation Models API
 *
 * @param apiKey The API key for the Cloud.ru API
 * @param baseUrl The base URL of the Cloud.ru API (defaults to https://foundation-models.api.cloud.ru/v1)
 * @returns A promise that resolves to a record of model IDs to model info
 * @throws Will throw an error if the request fails or the response is not as expected.
 */
export async function getCloudRuModels(apiKey: string, baseUrl?: string): Promise<ModelRecord> {
	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...DEFAULT_HEADERS,
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const url = baseUrl
			? `${baseUrl.replace(/\/$/, "")}/models`
			: "https://foundation-models.api.cloud.ru/v1/models"

		console.log("[getCloudRuModels] Request details:", {
			url,
			headers: { ...headers, Authorization: headers.Authorization ? "Bearer ***" : undefined },
			apiKeyLength: apiKey?.length,
		})

		// Added timeout to prevent indefinite hanging
		const response = await axios.get(url, { headers, timeout: 10000 })

		const models: ModelRecord = {}

		// Process the models from the response (OpenAI-compatible format)
		if (response.data && response.data.data && Array.isArray(response.data.data)) {
			for (const model of response.data.data) {
				const modelId = model.id

				if (!modelId) continue

				// Only include LLM models. Skip embeddings or other types.
				if (model.metadata?.type !== "llm") {
					continue
				}

				// Extract model information with defaults
				models[modelId] = {
					maxTokens: model.max_completion_tokens || 32768,
					contextWindow: model.context_length || 128000,
					supportsImages: Boolean(model.capabilities?.vision || model.capabilities?.image_generation),
					supportsPromptCache: Boolean(model.capabilities?.prompt_caching),
					supportsTemperature: true,
					defaultTemperature: 0.7,
					description: model.description || `${modelId} via Cloud.ru Foundation Models`,
				}
			}
		} else {
			// If response.data.data is not in the expected format, consider it an error.
			console.error("Error fetching Cloud.ru models: Unexpected response format", response.data)
			throw new Error("Failed to fetch Cloud.ru models: Unexpected response format.")
		}

		return models
	} catch (error: any) {
		console.error("Error fetching Cloud.ru models:", error.message ? error.message : error)
		if (axios.isAxiosError(error) && error.response) {
			console.error("Cloud.ru API Response:", {
				status: error.response.status,
				statusText: error.response.statusText,
				data: error.response.data,
				headers: error.response.headers,
			})
			throw new Error(
				`Failed to fetch Cloud.ru models: ${error.response.status} ${error.response.statusText}. ${JSON.stringify(error.response.data)}`,
			)
		} else if (axios.isAxiosError(error) && error.request) {
			throw new Error(
				"Failed to fetch Cloud.ru models: No response from server. Check Cloud.ru server status and base URL.",
			)
		} else {
			throw new Error(`Failed to fetch Cloud.ru models: ${error.message || "An unknown error occurred."}`)
		}
	}
}
