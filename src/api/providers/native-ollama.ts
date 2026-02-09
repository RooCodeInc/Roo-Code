import { streamText, generateText, ToolSet } from "ai"

import { ollamaDefaultModelInfo } from "@roo-code/types"

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

export class NativeOllamaHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		const baseUrl = options.ollamaBaseUrl || "http://localhost:11434"
		const modelId = options.ollamaModelId || ""
		const models = getModelsFromCache("ollama")
		const modelInfo = (models && modelId && models[modelId]) || ollamaDefaultModelInfo

		const config: OpenAICompatibleConfig = {
			providerName: "ollama",
			baseURL: `${baseUrl.replace(/\/+$/, "")}/v1`,
			apiKey: options.ollamaApiKey || "ollama",
			modelId,
			modelInfo,
		}

		super(options, config)
	}

	override getModel() {
		const models = getModelsFromCache("ollama")
		const id = this.options.ollamaModelId || ""
		const info = (models && id && models[id]) || ollamaDefaultModelInfo
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})
		return { id, info, ...params }
	}

	private get numCtxProviderOptions(): Record<string, unknown> | undefined {
		if (this.options.ollamaNumCtx !== undefined) {
			return { ollama: { num_ctx: this.options.ollamaNumCtx } } as Record<string, unknown>
		}
		return undefined
	}

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const providerOptions = this.numCtxProviderOptions
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
		const providerOptions = this.numCtxProviderOptions
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
