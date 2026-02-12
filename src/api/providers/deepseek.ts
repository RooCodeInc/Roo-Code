import { Anthropic } from "@anthropic-ai/sdk"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { streamText, generateText, ToolSet } from "ai"

import { deepSeekModels, deepSeekDefaultModelId, DEEP_SEEK_DEFAULT_TEMPERATURE, type ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	consumeAiSdkStream,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { applyToolCacheOptions } from "../transform/cache-breakpoints"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"
import { sanitizeMessagesForProvider } from "../transform/sanitize-messages"

/**
 * DeepSeek provider using the dedicated @ai-sdk/deepseek package.
 * Provides native support for reasoning (deepseek-reasoner) and prompt caching.
 */
export class DeepSeekHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createDeepSeek>

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Create the DeepSeek provider using AI SDK
		this.provider = createDeepSeek({
			baseURL: options.deepSeekBaseUrl || "https://api.deepseek.com/v1",
			apiKey: options.deepSeekApiKey ?? "not-provided",
			headers: DEFAULT_HEADERS,
		})
	}

	override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number } {
		const id = this.options.apiModelId ?? deepSeekDefaultModelId
		const info = deepSeekModels[id as keyof typeof deepSeekModels] || deepSeekModels[deepSeekDefaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: DEEP_SEEK_DEFAULT_TEMPERATURE,
		})
		return { id, info, ...params }
	}

	/**
	 * Get the language model for the configured model ID.
	 */
	protected getLanguageModel() {
		const { id } = this.getModel()
		return this.provider(id)
	}

	/**
	 * Process usage metrics from the AI SDK response, including DeepSeek's cache metrics.
	 * DeepSeek provides cache hit/miss info via providerMetadata.
	 */
	protected processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
			totalInputTokens?: number
			totalOutputTokens?: number
			cachedInputTokens?: number
			reasoningTokens?: number
			inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number }
			outputTokenDetails?: { reasoningTokens?: number }
			details?: {
				cachedInputTokens?: number
				reasoningTokens?: number
			}
		},
		providerMetadata?: {
			deepseek?: {
				promptCacheHitTokens?: number
				promptCacheMissTokens?: number
			}
		},
	): ApiStreamUsageChunk {
		// Extract cache metrics from DeepSeek's providerMetadata, then v6 fields, then legacy
		const cacheReadTokens =
			providerMetadata?.deepseek?.promptCacheHitTokens ??
			usage.cachedInputTokens ??
			usage.inputTokenDetails?.cacheReadTokens ??
			usage.details?.cachedInputTokens
		const cacheWriteTokens =
			providerMetadata?.deepseek?.promptCacheMissTokens ?? usage.inputTokenDetails?.cacheWriteTokens

		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheReadTokens,
			cacheWriteTokens,
			reasoningTokens:
				usage.reasoningTokens ?? usage.outputTokenDetails?.reasoningTokens ?? usage.details?.reasoningTokens,
			totalInputTokens: inputTokens,
			totalOutputTokens: outputTokens,
		}
	}

	/**
	 * Get the max tokens parameter to include in the request.
	 */
	protected getMaxOutputTokens(): number | undefined {
		const { info } = this.getModel()
		return this.options.modelMaxTokens || info.maxTokens || undefined
	}

	/**
	 * Create a message stream using the AI SDK.
	 * The AI SDK automatically handles reasoning for deepseek-reasoner model.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { temperature } = this.getModel()
		const languageModel = this.getLanguageModel()

		// Sanitize messages for the provider API (allowlist: role, content, providerOptions).
		const aiSdkMessages = sanitizeMessagesForProvider(messages)

		// Convert tools to OpenAI format first, then to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined
		applyToolCacheOptions(aiSdkTools as Parameters<typeof applyToolCacheOptions>[0], metadata?.toolProviderOptions)

		// Build the request options
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt || undefined,
			messages: aiSdkMessages,
			temperature: this.options.modelTemperature ?? temperature ?? DEEP_SEEK_DEFAULT_TEMPERATURE,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
		}

		// Use streamText for streaming responses
		const result = streamText(requestOptions)

		try {
			const processUsage = this.processUsageMetrics.bind(this)
			yield* consumeAiSdkStream(result, async function* () {
				const [usage, providerMetadata] = await Promise.all([result.usage, result.providerMetadata])
				yield processUsage(usage, providerMetadata as Parameters<typeof processUsage>[1])
			})
		} catch (error) {
			throw handleAiSdkError(error, "DeepSeek")
		}
	}

	/**
	 * Complete a prompt using the AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		const { temperature } = this.getModel()
		const languageModel = this.getLanguageModel()

		const { text } = await generateText({
			model: languageModel,
			prompt,
			maxOutputTokens: this.getMaxOutputTokens(),
			temperature: this.options.modelTemperature ?? temperature ?? DEEP_SEEK_DEFAULT_TEMPERATURE,
		})

		return text
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
