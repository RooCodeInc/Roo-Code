import { type HarmonyModelId, harmonyDefaultModelId, harmonyModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

/**
 * Harmony Compatible API provider for GPT-OSS open-weight models
 *
 * Harmony is a response format specification designed specifically for GPT-OSS models,
 * enabling structured output with separate reasoning (chain-of-thought) and final answer channels.
 *
 * Supported Models:
 * - gpt-oss-20b: 20 billion parameter model, fast inference
 * - gpt-oss-120b: 120 billion parameter model, higher quality
 *
 * Features:
 * - 128,000 token context window
 * - Reasoning effort levels: low, medium, high
 * - Streaming support
 * - Function/tool calling
 * - Separate reasoning and final answer outputs
 *
 * Configuration:
 * - API Key: Required for authentication
 * - Base URL: Defaults to https://ai.mezzanineapps.com/v1 (configurable for self-hosted)
 *
 * @see https://developers.openai.com/cookbook/articles/openai-harmony
 * @see https://github.com/openai/harmony
 */
export class HarmonyHandler extends BaseOpenAiCompatibleProvider<HarmonyModelId> {
	/**
	 * Creates a new Harmony provider handler
	 *
	 * @param options - API handler configuration
	 * @param options.harmonyApiKey - Harmony API key for authentication
	 * @param options.harmonyBaseUrl - Custom Harmony endpoint base URL (optional)
	 * @param options.apiModelId - Model ID to use (gpt-oss-20b or gpt-oss-120b)
	 * @param options.modelTemperature - Temperature override for model (0-2)
	 * @param options.reasoningEffort - Reasoning effort level: 'low', 'medium', or 'high'
	 */
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Harmony",
			baseURL: options.harmonyBaseUrl ?? "https://ai.mezzanineapps.com/v1",
			apiKey: options.harmonyApiKey || "sk-placeholder", // Allow testing with empty keys
			defaultProviderModelId: harmonyDefaultModelId,
			providerModels: harmonyModels,
			defaultTemperature: 0.7,
		})
	}
}
