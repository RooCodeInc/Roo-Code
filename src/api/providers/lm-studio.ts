import { streamText, generateText, ToolSet } from "ai"
import axios from "axios"

import { type ModelInfo, openAiModelInfoSaneDefaults, LMSTUDIO_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { NeutralMessageParam } from "../../core/task-persistence"
import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { OpenAICompatibleHandler, type OpenAICompatibleConfig } from "./openai-compatible"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { getModelsFromCache } from "./fetchers/modelCache"

export class LmStudioHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		const modelId = options.lmStudioModelId || ""
		const models = getModelsFromCache("lmstudio")
		const modelInfo = (models && modelId && models[modelId]) || openAiModelInfoSaneDefaults

		const config: OpenAICompatibleConfig = {
			providerName: "lmstudio",
			baseURL: (options.lmStudioBaseUrl || "http://localhost:1234") + "/v1",
			apiKey: "noop",
			modelId,
			modelInfo,
		}

		super(options, config)
	}

	override getModel() {
		const models = getModelsFromCache("lmstudio")
		const id = this.options.lmStudioModelId || ""
		const info = (models && id && models[id]) || openAiModelInfoSaneDefaults
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: LMSTUDIO_DEFAULT_TEMPERATURE,
		})
		return { id, info, ...params }
	}

	private get speculativeDecodingProviderOptions() {
		if (this.options.lmStudioSpeculativeDecodingEnabled && this.options.lmStudioDraftModelId) {
			return { lmstudio: { draft_model: this.options.lmStudioDraftModelId } } as Record<string, unknown>
		}
		return undefined
	}

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const providerOptions = this.speculativeDecodingProviderOptions
		if (!providerOptions) {
			yield* super.createMessage(systemPrompt, messages, metadata)
			return
		}

		const model = this.getModel()
		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const result = streamText({
			model: this.getLanguageModel(),
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature: model.temperature ?? 0,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			providerOptions: providerOptions as any,
		})

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}
			const usage = await result.usage
			if (usage) {
				yield this.processUsageMetrics(usage)
			}
		} catch (error) {
			throw handleAiSdkError(error, this.config.providerName)
		}
	}

	override async completePrompt(prompt: string): Promise<string> {
		const providerOptions = this.speculativeDecodingProviderOptions
		if (!providerOptions) {
			return super.completePrompt(prompt)
		}

		const { text } = await generateText({
			model: this.getLanguageModel(),
			prompt,
			maxOutputTokens: this.getMaxOutputTokens(),
			temperature: this.config.temperature ?? 0,
			providerOptions: providerOptions as any,
		})
		return text
	}
}

export async function getLmStudioModels(baseUrl = "http://localhost:1234") {
	try {
		if (!URL.canParse(baseUrl)) {
			return []
		}

		const response = await axios.get(`${baseUrl}/v1/models`)
		const modelsArray = response.data?.data?.map((model: any) => model.id) || []
		return [...new Set<string>(modelsArray)]
	} catch (error) {
		return []
	}
}
