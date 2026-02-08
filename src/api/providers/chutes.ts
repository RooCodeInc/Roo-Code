import { Anthropic } from "@anthropic-ai/sdk"
import { streamText, generateText, LanguageModel, ToolSet } from "ai"

import {
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	chutesDefaultModelId,
	chutesDefaultModelInfo,
	type ModelInfo,
	type ModelRecord,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { getModelMaxOutputTokens } from "../../shared/api"
import { TagMatcher } from "../../utils/tag-matcher"
import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream } from "../transform/stream"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

import { OpenAICompatibleHandler, OpenAICompatibleConfig } from "./openai-compatible"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"

export class ChutesHandler extends OpenAICompatibleHandler implements SingleCompletionHandler {
	private models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		const modelId = options.apiModelId ?? chutesDefaultModelId

		const config: OpenAICompatibleConfig = {
			providerName: "chutes",
			baseURL: "https://llm.chutes.ai/v1",
			apiKey: options.chutesApiKey ?? "not-provided",
			modelId,
			modelInfo: chutesDefaultModelInfo,
		}

		super(options, config)
	}

	async fetchModel() {
		this.models = await getModels({ provider: "chutes", apiKey: this.config.apiKey, baseUrl: this.config.baseURL })
		return this.getModel()
	}

	override getModel(): { id: string; info: ModelInfo; temperature?: number } {
		const id = this.options.apiModelId ?? chutesDefaultModelId

		let info: ModelInfo | undefined = this.models[id]

		if (!info) {
			const cachedModels = getModelsFromCache("chutes")
			if (cachedModels?.[id]) {
				this.models = cachedModels
				info = cachedModels[id]
			}
		}

		if (!info) {
			const isDeepSeekR1 = chutesDefaultModelId.includes("DeepSeek-R1")
			const defaultTemp = isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0.5
			return {
				id: chutesDefaultModelId,
				info: {
					...chutesDefaultModelInfo,
					defaultTemperature: defaultTemp,
				},
				temperature: this.options.modelTemperature ?? defaultTemp,
			}
		}

		const isDeepSeekR1 = id.includes("DeepSeek-R1")
		const defaultTemp = isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0.5

		return {
			id,
			info: {
				...info,
				defaultTemperature: defaultTemp,
			},
			temperature: this.supportsTemperature(id) ? (this.options.modelTemperature ?? defaultTemp) : undefined,
		}
	}

	protected override getLanguageModel(): LanguageModel {
		const { id } = this.getModel()
		return this.provider(id)
	}

	protected override getMaxOutputTokens(): number | undefined {
		const { id, info } = this.getModel()
		return (
			getModelMaxOutputTokens({
				modelId: id,
				model: info,
				settings: this.options,
				format: "openai",
			}) ?? undefined
		)
	}

	private supportsTemperature(modelId: string): boolean {
		return !modelId.startsWith("openai/o3-mini")
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = await this.fetchModel()

		if (model.id.includes("DeepSeek-R1")) {
			yield* this.createR1Message(systemPrompt, messages, model, metadata)
		} else {
			yield* super.createMessage(systemPrompt, messages, metadata)
		}
	}

	private async *createR1Message(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		model: { id: string; info: ModelInfo },
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const languageModel = this.getLanguageModel()

		const modifiedMessages = [...messages] as Anthropic.Messages.MessageParam[]

		if (modifiedMessages.length > 0 && modifiedMessages[0].role === "user") {
			const first = modifiedMessages[0]
			if (typeof first.content === "string") {
				modifiedMessages[0] = { role: "user", content: `${systemPrompt}\n\n${first.content}` }
			} else {
				modifiedMessages[0] = {
					role: "user",
					content: [{ type: "text", text: systemPrompt }, ...first.content],
				}
			}
		} else {
			modifiedMessages.unshift({ role: "user", content: systemPrompt })
		}

		const aiSdkMessages = convertToAiSdkMessages(modifiedMessages)

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const maxOutputTokens =
			getModelMaxOutputTokens({
				modelId: model.id,
				model: model.info,
				settings: this.options,
				format: "openai",
			}) ?? undefined

		const temperature = this.supportsTemperature(model.id)
			? (this.options.modelTemperature ?? model.info.defaultTemperature)
			: undefined

		const result = streamText({
			model: languageModel,
			messages: aiSdkMessages,
			temperature,
			maxOutputTokens,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
		})

		const matcher = new TagMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		try {
			for await (const part of result.fullStream) {
				if (part.type === "text-delta") {
					for (const processedChunk of matcher.update(part.text)) {
						yield processedChunk
					}
				} else {
					for (const chunk of processAiSdkStreamPart(part)) {
						yield chunk
					}
				}
			}

			for (const processedChunk of matcher.final()) {
				yield processedChunk
			}

			const usage = await result.usage
			if (usage) {
				yield this.processUsageMetrics(usage)
			}
		} catch (error) {
			throw handleAiSdkError(error, "chutes")
		}
	}

	override async completePrompt(prompt: string): Promise<string> {
		const model = await this.fetchModel()
		const languageModel = this.getLanguageModel()

		const maxOutputTokens =
			getModelMaxOutputTokens({
				modelId: model.id,
				model: model.info,
				settings: this.options,
				format: "openai",
			}) ?? undefined

		const isDeepSeekR1 = model.id.includes("DeepSeek-R1")
		const defaultTemperature = isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0.5
		const temperature = this.supportsTemperature(model.id)
			? (this.options.modelTemperature ?? defaultTemperature)
			: undefined

		try {
			const { text } = await generateText({
				model: languageModel,
				prompt,
				maxOutputTokens,
				temperature,
			})
			return text
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Chutes completion error: ${error.message}`)
			}
			throw error
		}
	}
}
