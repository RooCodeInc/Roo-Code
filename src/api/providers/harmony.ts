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
 * - Base URL: Required - must be provided explicitly (no default endpoint)
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
	 * @param options.harmonyBaseUrl - Harmony endpoint base URL (required, no default)
	 * @param options.apiModelId - Model ID to use (gpt-oss-20b or gpt-oss-120b)
	 * @param options.modelTemperature - Temperature override for model (0-2)
	 * @param options.reasoningEffort - Reasoning effort level: 'low', 'medium', or 'high'
	 * @throws Error if harmonyBaseUrl is not provided
	 */
	constructor(options: ApiHandlerOptions) {
		if (!options.harmonyBaseUrl) {
			throw new Error(
				"Harmony API base URL is required. Please configure 'harmonyBaseUrl' in your settings or set the HARMONY_BASE_URL environment variable.",
			)
		}
		super({
			...options,
			providerName: "Harmony",
			baseURL: options.harmonyBaseUrl,
			apiKey: options.harmonyApiKey || "sk-placeholder", // Allow testing with empty keys
			defaultProviderModelId: harmonyDefaultModelId,
			providerModels: harmonyModels,
			defaultTemperature: 0.7,
		})
	}

	/**
	 * Override convertToolsForOpenAI to remove the `strict` parameter.
	 * vLLM's tool-call-parser (openai) does not support the `strict` field yet,
	 * causing protocol warnings. This removes `strict` while preserving all other
	 * tool properties and schema transformations.
	 *
	 * Note: The underlying tool schema validation (additionalProperties, required fields)
	 * is still applied by the parent class for OpenAI compatibility.
	 */
	protected override convertToolsForOpenAI(tools: any[] | undefined): any[] | undefined {
		const convertedTools = super.convertToolsForOpenAI(tools)

		if (!convertedTools) {
			return convertedTools
		}

		// Remove `strict` parameter from all tools as vLLM doesn't support it
		return convertedTools.map((tool) => {
			if (tool.type === "function" && tool.function) {
				const { strict, ...functionWithoutStrict } = tool.function
				return {
					...tool,
					function: functionWithoutStrict,
				}
			}
			return tool
		})
	}
}
