import { Anthropic } from "@anthropic-ai/sdk"
import { createSambaNova } from "sambanova-ai-provider"
import { streamText, generateText, ToolSet, ModelMessage } from "ai"

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
import { applyPromptCacheToMessages, mergeProviderOptions } from "../transform/prompt-cache"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { normalizeProviderUsage } from "./utils/normalize-provider-usage"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

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
		const { chunk } = normalizeProviderUsage({
			provider: "sambanova",
			apiProtocol: "openai",
			usage: usage as any,
			providerMetadata: providerMetadata as Record<string, unknown> | undefined,
			modelInfo: this.getModel().info,
		})
		return chunk
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

		// For models that don't support multi-part content (like DeepSeek), flatten messages to string content
		// SambaNova's DeepSeek models expect string content, not array content
		const castMessages = messages as ModelMessage[]
		const aiSdkMessages = info.supportsImages ? castMessages : flattenAiSdkMessagesToStringContent(castMessages)

		const promptCache = applyPromptCacheToMessages({
			adapter: "ai-sdk",
			overrideKey: "sambanova",
			messages: aiSdkMessages,
			modelInfo: {
				supportsPromptCache: info.supportsPromptCache,
				promptCacheRetention: info.promptCacheRetention,
			},
			settings: this.options,
		})

		// Convert tools to OpenAI format first, then to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools, {
			functionToolProviderOptions: promptCache.toolProviderOptions,
		}) as ToolSet | undefined

		const providerOptions = mergeProviderOptions(undefined, promptCache.providerOptionsPatch)

		// Build the request options
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: promptCache.systemProviderOptions
				? ({ role: "system", content: systemPrompt, providerOptions: promptCache.systemProviderOptions } as any)
				: systemPrompt,
			messages: aiSdkMessages,
			temperature: this.options.modelTemperature ?? temperature ?? SAMBANOVA_DEFAULT_TEMPERATURE,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			...(providerOptions ? ({ providerOptions } as Record<string, unknown>) : {}),
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
