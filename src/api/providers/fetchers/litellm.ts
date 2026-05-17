import axios from "axios"

import type { ModelRecord } from "@roo-code/types"

import { DEFAULT_HEADERS } from "../constants"

/**
 * Builds the standard headers for LiteLLM requests.
 */
function buildHeaders(apiKey: string): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...DEFAULT_HEADERS,
	}

	if (apiKey) {
		headers["Authorization"] = `Bearer ${apiKey}`
	}

	return headers
}

/**
 * Builds a URL by appending the given path to the base URL,
 * normalizing slashes along the way.
 */
function buildUrl(baseUrl: string, path: string): string {
	const urlObj = new URL(baseUrl)
	urlObj.pathname = urlObj.pathname.replace(/\/+$/, "").replace(/\/+/g, "/") + path
	return urlObj.href
}

/**
 * Parses the response from `/v1/model/info` into a ModelRecord.
 *
 * This endpoint returns richer metadata (token limits, pricing, capabilities).
 */
export function parseModelInfoResponse(data: any): ModelRecord {
	const models: ModelRecord = {}

	if (!data || !data.data || !Array.isArray(data.data)) {
		throw new Error("Failed to fetch LiteLLM models: Unexpected response format.")
	}

	for (const model of data.data) {
		const modelName = model.model_name
		const modelInfo = model.model_info
		const litellmModelName = model?.litellm_params?.model as string | undefined

		if (!modelName || !modelInfo || !litellmModelName) continue

		models[modelName] = {
			maxTokens: modelInfo.max_output_tokens || modelInfo.max_tokens || 8192,
			contextWindow: modelInfo.max_input_tokens || 200000,
			supportsImages: Boolean(modelInfo.supports_vision),
			supportsPromptCache: Boolean(modelInfo.supports_prompt_caching),
			inputPrice: modelInfo.input_cost_per_token ? modelInfo.input_cost_per_token * 1000000 : undefined,
			outputPrice: modelInfo.output_cost_per_token ? modelInfo.output_cost_per_token * 1000000 : undefined,
			cacheWritesPrice: modelInfo.cache_creation_input_token_cost
				? modelInfo.cache_creation_input_token_cost * 1000000
				: undefined,
			cacheReadsPrice: modelInfo.cache_read_input_token_cost
				? modelInfo.cache_read_input_token_cost * 1000000
				: undefined,
			description: `${modelName} via LiteLLM proxy`,
		}
	}

	return models
}

/**
 * Parses the response from `/v1/models` (OpenAI-compatible) into a ModelRecord.
 *
 * This endpoint returns a simpler list of models with only IDs, so we use
 * sensible defaults for fields not available from this endpoint.
 */
export function parseModelsListResponse(data: any): ModelRecord {
	const models: ModelRecord = {}

	if (!data || !data.data || !Array.isArray(data.data)) {
		throw new Error("Failed to fetch LiteLLM models: Unexpected response format from /v1/models.")
	}

	for (const model of data.data) {
		const modelId = model.id
		if (!modelId || typeof modelId !== "string") continue

		models[modelId] = {
			maxTokens: 8192,
			contextWindow: 200000,
			supportsImages: false,
			supportsPromptCache: false,
			inputPrice: undefined,
			outputPrice: undefined,
			cacheWritesPrice: undefined,
			cacheReadsPrice: undefined,
			description: `${modelId} via LiteLLM proxy`,
		}
	}

	return models
}

/**
 * Fetches available models from a LiteLLM server.
 *
 * First attempts `/v1/model/info` which provides rich metadata. If that
 * endpoint is inaccessible (e.g. 403 Forbidden), falls back to `/v1/models`
 * which returns a simpler OpenAI-compatible model list.
 *
 * @param apiKey The API key for the LiteLLM server
 * @param baseUrl The base URL of the LiteLLM server
 * @returns A promise that resolves to a record of model IDs to model info
 * @throws Will throw an error if both endpoints fail.
 */
export async function getLiteLLMModels(apiKey: string, baseUrl: string): Promise<ModelRecord> {
	const headers = buildHeaders(apiKey)

	// First, try the richer /v1/model/info endpoint
	try {
		const modelInfoUrl = buildUrl(baseUrl, "/v1/model/info")
		const response = await axios.get(modelInfoUrl, { headers, timeout: 5000 })
		return parseModelInfoResponse(response.data)
	} catch (modelInfoError: any) {
		// Log the failure and attempt fallback
		console.error(
			"LiteLLM /v1/model/info failed, attempting /v1/models fallback:",
			modelInfoError.message || modelInfoError,
		)
	}

	// Fallback: try /v1/models (OpenAI-compatible endpoint)
	try {
		const modelsUrl = buildUrl(baseUrl, "/v1/models")
		const response = await axios.get(modelsUrl, { headers, timeout: 5000 })
		return parseModelsListResponse(response.data)
	} catch (fallbackError: any) {
		console.error("Error fetching LiteLLM models from /v1/models fallback:", fallbackError.message || fallbackError)
		if (axios.isAxiosError(fallbackError) && fallbackError.response) {
			throw new Error(
				`Failed to fetch LiteLLM models: Both /v1/model/info and /v1/models failed. Last error: ${fallbackError.response.status} ${fallbackError.response.statusText}. Check base URL and API key.`,
			)
		} else if (axios.isAxiosError(fallbackError) && fallbackError.request) {
			throw new Error(
				"Failed to fetch LiteLLM models: No response from server. Check LiteLLM server status and base URL.",
			)
		} else {
			throw new Error(`Failed to fetch LiteLLM models: ${fallbackError.message || "An unknown error occurred."}`)
		}
	}
}
