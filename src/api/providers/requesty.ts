import { streamText, ToolSet } from "ai"

import { type ModelInfo, type ModelRecord, requestyDefaultModelId, requestyDefaultModelInfo } from "@roo-code/types"

import type { NeutralMessageParam } from "../../core/task-persistence"
import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { OpenAICompatibleHandler, type OpenAICompatibleConfig } from "./openai-compatible"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import { toRequestyServiceUrl } from "../../shared/utils/requesty"
import { applyRouterToolPreferences } from "./utils/router-tool-preferences"

export class RequestyHandler extends OpenAICompatibleHandler {
	private models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		const modelId = options.requestyModelId ?? requestyDefaultModelId
		const cached = getModelsFromCache("requesty")
		const modelInfo = (cached && modelId && cached[modelId]) || requestyDefaultModelInfo

		const config: OpenAICompatibleConfig = {
			providerName: "requesty",
			baseURL: toRequestyServiceUrl(options.requestyBaseUrl),
			apiKey: options.requestyApiKey ?? "not-provided",
			modelId,
			modelInfo,
			modelMaxTokens: options.modelMaxTokens ?? undefined,
			temperature: options.modelTemperature ?? undefined,
		}

		super(options, config)
	}

	public async fetchModel() {
		this.models = await getModels({
			provider: "requesty",
			baseUrl: toRequestyServiceUrl(this.options.requestyBaseUrl),
		})
		const model = this.getModel()
		this.config.modelInfo = model.info
		return model
	}

	override getModel() {
		const id = this.options.requestyModelId ?? requestyDefaultModelId
		const cached = getModelsFromCache("requesty")
		let info: ModelInfo = applyRouterToolPreferences(
			id,
			(cached && id && cached[id]) || this.models[id] || requestyDefaultModelInfo,
		)

		const params = getModelParams({
			format: "anthropic",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		return { id, info, ...params }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.fetchModel()
		const model = this.getModel()
		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const result = streamText({
			model: this.getLanguageModel(),
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature: model.temperature ?? 0,
			maxOutputTokens: model.maxTokens,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			providerOptions: {
				requesty: { trace_id: metadata?.taskId, extra: { mode: metadata?.mode } },
			} as any,
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
		await this.fetchModel()
		return super.completePrompt(prompt)
	}

	protected override processUsageMetrics(usage: {
		inputTokens?: number
		outputTokens?: number
		details?: { cachedInputTokens?: number; reasoningTokens?: number }
		raw?: Record<string, unknown>
	}): ApiStreamUsageChunk {
		const rawUsage = usage.raw as
			| { prompt_tokens_details?: { caching_tokens?: number; cached_tokens?: number } }
			| undefined

		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		const cacheWriteTokens = rawUsage?.prompt_tokens_details?.caching_tokens || 0
		const cacheReadTokens = rawUsage?.prompt_tokens_details?.cached_tokens ?? usage.details?.cachedInputTokens ?? 0

		const modelInfo = this.getModel().info
		const { totalCost } = calculateApiCostOpenAI(
			modelInfo,
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
		)

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
			totalCost,
		}
	}
}
