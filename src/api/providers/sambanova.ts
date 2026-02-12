import { Anthropic } from "@anthropic-ai/sdk"
import { createSambaNova } from "sambanova-ai-provider"
import { streamText, generateText, ToolSet } from "ai"

import { sambaNovaModels, sambaNovaDefaultModelId, type ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	consumeAiSdkStream,
	mapToolChoice,
	handleAiSdkError,
	flattenAiSdkMessagesToStringContent,
} from "../transform/ai-sdk"
import { applyToolCacheOptions } from "../transform/cache-breakpoints"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"
import { sanitizeMessagesForProvider } from "../transform/sanitize-messages"

const SAMBANOVA_DEFAULT_TEMPERATURE = 0.7

/**
 * SambaNova provider using the dedicated sambanova-ai-provider package.
 * Provides native support for various models including Llama models.
 */
export class SambaNovaHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createSambaNova>

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Create the SambaNova provider using AI SDK
		this.provider = createSambaNova({
			baseURL: "https://api.sambanova.ai/v1",
			apiKey: options.sambaNovaApiKey ?? "not-provided",
			headers: DEFAULT_HEADERS,
		})
	}

	override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number } {
		const id = this.options.apiModelId ?? sambaNovaDefaultModelId
		const info = sambaNovaModels[id as keyof typeof sambaNovaModels] || sambaNovaModels[sambaNovaDefaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: SAMBANOVA_DEFAULT_TEMPERATURE,
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
	 * Process usage metrics from the AI SDK response.
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
			sambanova?: {
				promptCacheHitTokens?: number
				promptCacheMissTokens?: number
			}
		},
	): ApiStreamUsageChunk {
		// Extract cache metrics from SambaNova's providerMetadata, then v6 fields, then legacy
		const cacheReadTokens =
			providerMetadata?.sambanova?.promptCacheHitTokens ??
			usage.cachedInputTokens ??
			usage.inputTokenDetails?.cacheReadTokens ??
			usage.details?.cachedInputTokens
		const cacheWriteTokens =
			providerMetadata?.sambanova?.promptCacheMissTokens ?? usage.inputTokenDetails?.cacheWriteTokens

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
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { temperature, info } = this.getModel()
		const languageModel = this.getLanguageModel()

		// Sanitize messages for the provider API (allowlist: role, content, providerOptions).
		// For models that don't support multi-part content (like DeepSeek), flatten to string content.
		const sanitizedMessages = sanitizeMessagesForProvider(messages)
		const aiSdkMessages = info.supportsImages
			? sanitizedMessages
			: flattenAiSdkMessagesToStringContent(sanitizedMessages)

		// Convert tools to OpenAI format first, then to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined
		applyToolCacheOptions(aiSdkTools as Parameters<typeof applyToolCacheOptions>[0], metadata?.toolProviderOptions)

		// Build the request options
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt || undefined,
			messages: aiSdkMessages,
			temperature: this.options.modelTemperature ?? temperature ?? SAMBANOVA_DEFAULT_TEMPERATURE,
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
			throw handleAiSdkError(error, "SambaNova")
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
			temperature: this.options.modelTemperature ?? temperature ?? SAMBANOVA_DEFAULT_TEMPERATURE,
		})

		return text
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
