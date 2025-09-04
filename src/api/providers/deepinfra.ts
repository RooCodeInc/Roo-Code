import { type DeepInfraModelId, deepInfraDefaultModelId } from "@roo-code/types"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ApiHandlerOptions } from "../../shared/api"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import type { ModelInfo } from "@roo-code/types"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { calculateApiCostOpenAI } from "../../shared/cost"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

// Enhanced usage interface to support DeepInfra's cached token fields
interface DeepInfraUsage extends OpenAI.CompletionUsage {
	prompt_tokens_details?: {
		cached_tokens?: number
	}
}

export class DeepInfraHandler extends BaseOpenAiCompatibleProvider<DeepInfraModelId> {
	constructor(options: ApiHandlerOptions) {
		// Initialize with empty models, will be populated dynamically
		super({
			...options,
			providerName: "DeepInfra",
			baseURL: "https://api.deepinfra.com/v1/openai",
			apiKey: options.deepInfraApiKey,
			defaultProviderModelId: deepInfraDefaultModelId,
			providerModels: {},
			defaultTemperature: 0.7,
		})
	}

	override getModel() {
		const modelId = this.options.deepInfraModelId || deepInfraDefaultModelId

		// For DeepInfra, we use a default model configuration
		// The actual model info will be fetched dynamically via the fetcher
		const defaultModelInfo: ModelInfo = {
			maxTokens: 4096,
			contextWindow: 32768,
			supportsImages: false,
			supportsPromptCache: true,
			inputPrice: 0.15,
			outputPrice: 0.6,
			cacheReadsPrice: 0.075, // 50% discount for cached tokens
			description: "DeepInfra model",
		}

		return { id: modelId, info: defaultModelInfo }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const stream = await this.createStream(systemPrompt, messages, metadata)

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (chunk.usage) {
				yield* this.yieldUsage(chunk.usage as DeepInfraUsage)
			}
		}
	}

	private async *yieldUsage(usage: DeepInfraUsage | undefined): ApiStream {
		const { info } = this.getModel()
		const inputTokens = usage?.prompt_tokens || 0
		const outputTokens = usage?.completion_tokens || 0

		const cacheReadTokens = usage?.prompt_tokens_details?.cached_tokens || 0

		// DeepInfra does not track cache writes separately
		const cacheWriteTokens = 0

		// Calculate cost using OpenAI-compatible cost calculation
		const totalCost = calculateApiCostOpenAI(info, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)

		// Calculate non-cached input tokens for proper reporting
		const nonCachedInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)

		yield {
			type: "usage",
			inputTokens: nonCachedInputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
			totalCost,
		}
	}
}
