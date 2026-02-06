import { Anthropic } from "@anthropic-ai/sdk"
import { createZhipu } from "zhipu-ai-provider"
import { streamText, generateText, ToolSet } from "ai"

import {
	internationalZAiModels,
	mainlandZAiModels,
	internationalZAiDefaultModelId,
	mainlandZAiDefaultModelId,
	type ModelInfo,
	ZAI_DEFAULT_TEMPERATURE,
	zaiApiLineConfigs,
} from "@roo-code/types"

import { type ApiHandlerOptions, shouldUseReasoningEffort } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

/**
 * Z.ai provider using the dedicated zhipu-ai-provider package.
 * Provides native support for GLM-4.7 thinking mode and region-based model selection.
 */
export class ZAiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createZhipu>
	private isChina: boolean

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.isChina = zaiApiLineConfigs[options.zaiApiLine ?? "international_coding"].isChina

		this.provider = createZhipu({
			baseURL: zaiApiLineConfigs[options.zaiApiLine ?? "international_coding"].baseUrl,
			apiKey: options.zaiApiKey ?? "not-provided",
			headers: DEFAULT_HEADERS,
		})
	}

	override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number } {
		const models = (this.isChina ? mainlandZAiModels : internationalZAiModels) as unknown as Record<
			string,
			ModelInfo
		>
		const defaultModelId = (this.isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId) as string

		const id = this.options.apiModelId ?? defaultModelId
		const info = models[id] || models[defaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: ZAI_DEFAULT_TEMPERATURE,
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
	 * Get the max tokens parameter to include in the request.
	 */
	protected getMaxOutputTokens(): number | undefined {
		const { info } = this.getModel()
		return this.options.modelMaxTokens || info.maxTokens || undefined
	}

	/**
	 * Create a message stream using the AI SDK.
	 * For GLM-4.7, passes the thinking parameter via providerOptions.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info, temperature } = this.getModel()
		const languageModel = this.getLanguageModel()

		const aiSdkMessages = convertToAiSdkMessages(messages)

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature: this.options.modelTemperature ?? temperature ?? ZAI_DEFAULT_TEMPERATURE,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
		}

		// GLM-4.7 thinking mode: pass thinking parameter via providerOptions
		const isThinkingModel = modelId === "glm-4.7" && Array.isArray(info.supportsReasoningEffort)

		if (isThinkingModel) {
			const useReasoning = shouldUseReasoningEffort({ model: info, settings: this.options })
			requestOptions.providerOptions = {
				zhipu: {
					thinking: useReasoning ? { type: "enabled" } : { type: "disabled" },
				},
			}
		}

		const result = streamText(requestOptions)

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			const usage = await result.usage
			if (usage) {
				yield {
					type: "usage" as const,
					inputTokens: usage.inputTokens || 0,
					outputTokens: usage.outputTokens || 0,
				}
			}
		} catch (error) {
			throw handleAiSdkError(error, "Z.ai")
		}
	}

	/**
	 * Complete a prompt using the AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		const { temperature } = this.getModel()
		const languageModel = this.getLanguageModel()

		try {
			const { text } = await generateText({
				model: languageModel,
				prompt,
				maxOutputTokens: this.getMaxOutputTokens(),
				temperature: this.options.modelTemperature ?? temperature ?? ZAI_DEFAULT_TEMPERATURE,
			})

			return text
		} catch (error) {
			throw handleAiSdkError(error, "Z.ai")
		}
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
