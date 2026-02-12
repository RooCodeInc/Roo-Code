import { Anthropic } from "@anthropic-ai/sdk"
import { createBaseten } from "@ai-sdk/baseten"
import { streamText, generateText, ToolSet, ModelMessage } from "ai"

import { basetenModels, basetenDefaultModelId, type ModelInfo } from "@roo-code/types"

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

const BASETEN_DEFAULT_TEMPERATURE = 0.5

/**
 * Baseten provider using the dedicated @ai-sdk/baseten package.
 * Provides native support for Baseten's inference API.
 */
export class BasetenHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createBaseten>

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		this.provider = createBaseten({
			baseURL: "https://inference.baseten.co/v1",
			apiKey: options.basetenApiKey ?? "not-provided",
			headers: DEFAULT_HEADERS,
		})
	}

	override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number } {
		const id = this.options.apiModelId ?? basetenDefaultModelId
		const info = basetenModels[id as keyof typeof basetenModels] || basetenModels[basetenDefaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: BASETEN_DEFAULT_TEMPERATURE,
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
	protected processUsageMetrics(usage: {
		inputTokens?: number
		outputTokens?: number
		details?: {
			cachedInputTokens?: number
			reasoningTokens?: number
		}
	}): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			reasoningTokens: usage.details?.reasoningTokens,
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
		const { temperature } = this.getModel()
		const languageModel = this.getLanguageModel()

		const aiSdkMessages = messages as ModelMessage[]

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined
		applyToolCacheOptions(aiSdkTools as Parameters<typeof applyToolCacheOptions>[0], metadata?.toolProviderOptions)

		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt || undefined,
			messages: aiSdkMessages,
			temperature: this.options.modelTemperature ?? temperature ?? BASETEN_DEFAULT_TEMPERATURE,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
		}

		const result = streamText(requestOptions)

		try {
			const processUsage = this.processUsageMetrics.bind(this)
			yield* consumeAiSdkStream(result, async function* () {
				const usage = await result.usage
				yield processUsage(usage)
			})
		} catch (error) {
			throw handleAiSdkError(error, "Baseten")
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
			temperature: this.options.modelTemperature ?? temperature ?? BASETEN_DEFAULT_TEMPERATURE,
		})

		return text
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
