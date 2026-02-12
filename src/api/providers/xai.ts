import { Anthropic } from "@anthropic-ai/sdk"
import { createXai } from "@ai-sdk/xai"
import { streamText, generateText, ToolSet, ModelMessage } from "ai"

import { type XAIModelId, xaiDefaultModelId, xaiModels, type ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	consumeAiSdkStream,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { applyPromptCacheToMessages, mergeProviderOptions } from "../transform/prompt-cache"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { normalizeProviderUsage } from "./utils/normalize-provider-usage"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

const XAI_DEFAULT_TEMPERATURE = 0

/**
 * xAI provider using the dedicated @ai-sdk/xai package.
 * Provides native support for Grok models including reasoning models.
 */
export class XAIHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createXai>

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Create the xAI provider using AI SDK
		this.provider = createXai({
			baseURL: "https://api.x.ai/v1",
			apiKey: options.xaiApiKey ?? "not-provided",
			headers: DEFAULT_HEADERS,
		})
	}

	override getModel(): {
		id: XAIModelId
		info: ModelInfo
		maxTokens?: number
		temperature?: number
		reasoning?: any
	} {
		const id =
			this.options.apiModelId && this.options.apiModelId in xaiModels
				? (this.options.apiModelId as XAIModelId)
				: xaiDefaultModelId

		const info = xaiModels[id]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: XAI_DEFAULT_TEMPERATURE,
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
			xai?: {
				cachedPromptTokens?: number
			}
		},
	): ApiStreamUsageChunk {
		const { chunk } = normalizeProviderUsage({
			provider: "xai",
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
		const { temperature, reasoning, info } = this.getModel()
		const languageModel = this.getLanguageModel()

		// Convert messages to AI SDK format
		const aiSdkMessages = messages as ModelMessage[]

		const promptCache = applyPromptCacheToMessages({
			adapter: "ai-sdk",
			overrideKey: "xai",
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

		const providerOptions = mergeProviderOptions(
			reasoning ? ({ xai: reasoning } as Record<string, unknown>) : undefined,
			promptCache.providerOptionsPatch,
		)

		// Build the request options
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: promptCache.systemProviderOptions
				? ({ role: "system", content: systemPrompt, providerOptions: promptCache.systemProviderOptions } as any)
				: systemPrompt,
			messages: aiSdkMessages,
			temperature: this.options.modelTemperature ?? temperature ?? XAI_DEFAULT_TEMPERATURE,
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
			throw handleAiSdkError(error, "xAI")
		}
	}

	/**
	 * Complete a prompt using the AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		const { temperature, reasoning } = this.getModel()
		const languageModel = this.getLanguageModel()

		try {
			const { text } = await generateText({
				model: languageModel,
				prompt,
				maxOutputTokens: this.getMaxOutputTokens(),
				temperature: this.options.modelTemperature ?? temperature ?? XAI_DEFAULT_TEMPERATURE,
				...(reasoning && { providerOptions: { xai: reasoning } }),
			})

			return text
		} catch (error) {
			throw handleAiSdkError(error, "xAI")
		}
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
