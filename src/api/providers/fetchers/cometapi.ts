import { ModelRecord } from "../../../shared/api"
import { COMETAPI_MODELS } from "@roo-code/types"

/**
 * Fetch CometAPI models from the API
 * @param apiKey - The API key for CometAPI
 * @param baseUrl - The base URL for CometAPI (optional)
 * @returns The models from CometAPI
 */
export async function getCometAPIModels(apiKey?: string, baseUrl?: string): Promise<ModelRecord> {
	const url = `${baseUrl || "https://api.cometapi.com/v1"}/models`

	try {
		if (!apiKey) {
			// Return fallback models if no API key is provided
			return COMETAPI_MODELS
		}

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				Accept: "application/json",
			},
		})

		if (!response.ok) {
			console.warn(`Failed to fetch CometAPI models: ${response.status} ${response.statusText}`)
			// Return fallback models on error
			return COMETAPI_MODELS
		}

		const data = await response.json()

		// Transform the API response to match our ModelRecord format
		const models: ModelRecord = {}

		if (data.data && Array.isArray(data.data)) {
			for (const model of data.data) {
				// Use fallback model info if available, otherwise create basic info
				const fallbackInfo = COMETAPI_MODELS[model.id]
				models[model.id] = fallbackInfo || {
					maxTokens: model.max_tokens || 8192,
					contextWindow: model.context_length || 128000,
					supportsImages: model.supports_images || false,
					supportsPromptCache: false,
					inputPrice: model.pricing?.prompt || 0,
					outputPrice: model.pricing?.completion || 0,
					description: model.description || model.id,
				}
			}
		}

		// If no models were returned, use fallback models
		return Object.keys(models).length > 0 ? models : COMETAPI_MODELS
	} catch (error) {
		console.error("Error fetching CometAPI models:", error)
		// Return fallback models on error
		return COMETAPI_MODELS
	}
}
