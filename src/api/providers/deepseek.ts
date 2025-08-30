import { deepSeekModels, deepSeekDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import type { ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { OpenAiHandler } from "./openai"

export class DeepSeekHandler extends OpenAiHandler {
	constructor(options: ApiHandlerOptions) {
		// Validate API key before passing to parent constructor
		const apiKey = options.deepSeekApiKey ?? "not-provided"
		DeepSeekHandler.validateApiKey(apiKey)

		super({
			...options,
			openAiApiKey: apiKey,
			openAiModelId: options.apiModelId ?? deepSeekDefaultModelId,
			openAiBaseUrl: options.deepSeekBaseUrl ?? "https://api.deepseek.com",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	/**
	 * Validates that the API key contains only ASCII characters.
	 * Non-ASCII characters in API keys cause ByteString conversion errors.
	 */
	private static validateApiKey(apiKey: string): void {
		if (apiKey && apiKey !== "not-provided") {
			// Check for non-ASCII characters
			for (let i = 0; i < apiKey.length; i++) {
				const charCode = apiKey.charCodeAt(i)
				if (charCode > 255) {
					throw new Error(
						`Invalid DeepSeek API key: contains non-ASCII character at position ${i + 1}. ` +
							`API keys must contain only ASCII characters (letters, numbers, and standard symbols). ` +
							`Please check your API key for any accidental non-ASCII characters or spaces.`,
					)
				}
			}
		}
	}

	override getModel() {
		const id = this.options.apiModelId ?? deepSeekDefaultModelId
		const info = deepSeekModels[id as keyof typeof deepSeekModels] || deepSeekModels[deepSeekDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	// Override to handle DeepSeek's usage metrics, including caching.
	protected override processUsageMetrics(usage: any): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.prompt_tokens_details?.cache_miss_tokens,
			cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens,
		}
	}
}
