import { Anthropic } from "@anthropic-ai/sdk"
import {
	streamText,
	generateText,
	ToolSet,
	wrapLanguageModel,
	extractReasoningMiddleware,
	LanguageModel,
	ModelMessage,
} from "ai"

import { type ModelInfo, openAiModelInfoSaneDefaults, LMSTUDIO_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	consumeAiSdkStream,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream } from "../transform/stream"

import { OpenAICompatibleHandler, OpenAICompatibleConfig } from "./openai-compatible"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getModelsFromCache } from "./fetchers/modelCache"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

export class LmStudioHandler extends OpenAICompatibleHandler implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		const modelId = options.lmStudioModelId || ""
		const baseURL = (options.lmStudioBaseUrl || "http://localhost:1234") + "/v1"

		const models = getModelsFromCache("lmstudio")
		const modelInfo = (models && modelId && models[modelId]) || openAiModelInfoSaneDefaults

		const config: OpenAICompatibleConfig = {
			providerName: "lmstudio",
			baseURL,
			apiKey: "noop",
			modelId,
			modelInfo,
			temperature: options.modelTemperature ?? LMSTUDIO_DEFAULT_TEMPERATURE,
			modelMaxTokens: options.modelMaxTokens ?? undefined,
		}

		super(options, config)
	}

	protected override getLanguageModel(): LanguageModel {
		const baseModel = this.provider(this.config.modelId)
		return wrapLanguageModel({
			model: baseModel,
			middleware: extractReasoningMiddleware({ tagName: "think" }),
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()
		const languageModel = this.getLanguageModel()

		const aiSdkMessages = messages as ModelMessage[]

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature: model.temperature ?? this.config.temperature ?? LMSTUDIO_DEFAULT_TEMPERATURE,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
		}

		if (this.options.lmStudioSpeculativeDecodingEnabled && this.options.lmStudioDraftModelId) {
			requestOptions.providerOptions = {
				lmstudio: { draft_model: this.options.lmStudioDraftModelId },
			}
		}

		const result = streamText(requestOptions)

		try {
			const processUsage = this.processUsageMetrics.bind(this)
			yield* consumeAiSdkStream(result, async function* () {
				const usage = await result.usage
				yield processUsage(usage)
			})
		} catch (error) {
			throw handleAiSdkError(error, "LM Studio")
		}
	}

	override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number } {
		const models = getModelsFromCache("lmstudio")
		const modelId = this.options.lmStudioModelId || ""

		const info = (models && modelId && models[modelId]) || openAiModelInfoSaneDefaults

		return {
			id: modelId,
			info,
			temperature: this.options.modelTemperature ?? LMSTUDIO_DEFAULT_TEMPERATURE,
			maxTokens: this.options.modelMaxTokens ?? undefined,
		}
	}

	override async completePrompt(prompt: string): Promise<string> {
		const languageModel = this.getLanguageModel()

		const options: Parameters<typeof generateText>[0] = {
			model: languageModel,
			prompt,
			maxOutputTokens: this.getMaxOutputTokens(),
			temperature: this.options.modelTemperature ?? LMSTUDIO_DEFAULT_TEMPERATURE,
		}

		if (this.options.lmStudioSpeculativeDecodingEnabled && this.options.lmStudioDraftModelId) {
			options.providerOptions = {
				lmstudio: { draft_model: this.options.lmStudioDraftModelId },
			}
		}

		try {
			const { text } = await generateText(options)
			return text
		} catch (error) {
			throw handleAiSdkError(error, "LM Studio")
		}
	}
}
