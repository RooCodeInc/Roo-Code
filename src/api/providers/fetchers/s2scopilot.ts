import * as https from "https"
import * as fs from "fs"
import { type ModelInfo, type ModelRecord } from "@roo-code/types"

import { DEFAULT_HEADERS } from "../constants"

/**
 * Fetches available models from the s2sCopilot API Gateway
 *
 * @param baseUrl The base URL of the s2sCopilot API Gateway
 * @param apiKey The API key (bearer token) for the s2sCopilot API Gateway
 * @param caCertPath Optional path to CA certificate bundle
 * @returns A promise that resolves to a record of model IDs to model info
 * @throws Will throw an error if the request fails or the response is not as expected.
 */
export async function getS2sCopilotModels(
	baseUrl: string,
	apiKey?: string,
	caCertPath?: string,
): Promise<ModelRecord> {
	// Construct the models endpoint URL
	const normalizedBase = baseUrl.replace(/\/?v1\/?$/, "")
	const url = `${normalizedBase}/models_info`

	try {
		const headers: Record<string, string> = {
			accept: "application/json",
			"Content-Type": "application/json",
			...DEFAULT_HEADERS,
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		// Create custom HTTPS agent if CA certificate is provided
		let httpsAgent: https.Agent | undefined

		if (caCertPath) {
			try {
				const ca = fs.readFileSync(caCertPath, "utf8")
				httpsAgent = new https.Agent({ ca })
			} catch (error) {
				console.warn(`Failed to load CA certificate from ${caCertPath}:`, error)
				// Continue without custom CA
			}
		}

		// Use fetch with AbortController for better timeout handling
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 10000)

		const fetchOptions: RequestInit = {
			headers,
			signal: controller.signal,
		}

		// Add agent only if available (Node.js environment)
		if (httpsAgent && typeof global !== "undefined") {
			;(fetchOptions as any).agent = httpsAgent
		}

		try {
			const response = await fetch(url, fetchOptions)

			clearTimeout(timeoutId)

			if (!response.ok) {
				let errorBody = ""
				try {
					errorBody = await response.text()
				} catch {
					errorBody = "(unable to read response body)"
				}

				console.error(`[getS2sCopilotModels] HTTP error:`, {
					status: response.status,
					statusText: response.statusText,
					url,
					body: errorBody,
				})

				throw new Error(`HTTP ${response.status}: ${response.statusText}`)
			}

			const data = await response.json()

			if (!data || typeof data !== "object") {
				throw new Error("Invalid response format: Expected JSON object")
			}

			if (!data.data || !Array.isArray(data.data)) {
				throw new Error("Invalid response format: Missing or invalid 'data' array")
			}

			const models: ModelRecord = {}

			// Process model data according to the s2sCopilot API response schema
			for (const model of data.data) {
				// Use openai_approach_name as the model ID
				const modelId = model.openai_approach_name

				if (!modelId) continue

				// Only include models that are online and user has access to
				if (model.status !== "online" || !model.user_access) continue

				// Only include generative models (skip embedding models)
				if (model.typ !== "generative") continue

				// Extract model info from the first entry in the info array
				const modelInfo = model.info?.[0]

				if (!modelInfo) continue

				// Map s2sCopilot model info to our ModelInfo type
				const info: ModelInfo = {
					maxTokens: modelInfo.max_response_token || 4096,
					contextWindow: modelInfo.input_context_window || 128000,
					supportsImages: false, // s2sCopilot API doesn't provide this info
					supportsPromptCache: false, // s2sCopilot API doesn't provide this info
					inputPrice: 0, // Price info not available in API response
					outputPrice: 0, // Price info not available in API response
					description: `${model.api_approach_name} (${modelInfo.hosting_location}, ${modelInfo.parameters_in_billion ? modelInfo.parameters_in_billion + "B params" : "unknown size"})`,
				}

				models[modelId] = info
			}

			if (Object.keys(models).length === 0) {
				console.warn("[getS2sCopilotModels] No models found or all models are offline/restricted")
			}

			return models
		} finally {
			clearTimeout(timeoutId)
		}
	} catch (error) {
		console.error("[getS2sCopilotModels] Error fetching models:", error)

		// Return a minimal fallback model so the provider can still be configured
		return {
			"claudesonnet4.5": {
				maxTokens: 64000,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: false,
				inputPrice: 3.0,
				outputPrice: 15.0,
				description: "Claude Sonnet 4.5 (fallback)",
			},
		}
	}
}
