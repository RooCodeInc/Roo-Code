import { Anthropic } from "@anthropic-ai/sdk"
import { createRequesty, type RequestyProviderMetadata } from "@requesty/ai-sdk"
import { streamText, generateText, ToolSet, ModelMessage } from "ai"

import { type ModelInfo, type ModelRecord, requestyDefaultModelId, requestyDefaultModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	consumeAiSdkStream,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { getModels } from "./fetchers/modelCache"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { toRequestyServiceUrl } from "../../shared/utils/requesty"
import { applyRouterToolPreferences } from "./utils/router-tool-preferences"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

/**
 * Requesty provider using the dedicated @requesty/ai-sdk package.
 * Requesty is a unified LLM gateway providing access to 300+ models.
 * This handler uses the Vercel AI SDK for streaming and tool support.
 */
export class RequestyHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected models: ModelRecord = {}
	protected provider: ReturnType<typeof createRequesty>
	private baseURL: string

	constructor(options: ApiHandlerOptions) {
		super()

		this.options = options
		this.baseURL = toRequestyServiceUrl(options.requestyBaseUrl)

		const apiKey = this.options.requestyApiKey ?? "not-provided"

		this.provider = createRequesty({
			baseURL: this.baseURL,
			apiKey: apiKey,
			headers: DEFAULT_HEADERS,
			compatibility: "compatible",
		})
	}

	public async fetchModel() {
		this.models = await getModels({ provider: "requesty", baseUrl: this.baseURL })
		return this.getModel()
	}

	override getModel() {
		const id = this.options.requestyModelId ?? requestyDefaultModelId
		const cachedInfo = this.models[id] ?? requestyDefaultModelInfo
		let info: ModelInfo = cachedInfo

		info = applyRouterToolPreferences(id, info)

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		return { id, info, ...params }
	}

	/**
	 * Get the language model for the configured model ID, including reasoning settings.
	 *
	 * Reasoning settings (includeReasoning, reasoningEffort) must be passed as model
	 * settings — NOT as providerOptions — because the SDK reads them from this.settings
	 * to populate the top-level `include_reasoning` and `reasoning_effort` request fields.
	 */
	protected getLanguageModel() {
		const { id, reasoningEffort, reasoningBudget } = this.getModel()

		let resolvedEffort: string | undefined
		if (reasoningBudget) {
			resolvedEffort = String(reasoningBudget)
		} else if (reasoningEffort) {
			resolvedEffort = reasoningEffort
		}

		const needsReasoning = !!resolvedEffort

		return this.provider(id, {
			...(needsReasoning ? { includeReasoning: true, reasoningEffort: resolvedEffort } : {}),
		})
	}

	/**
	 * Get the max output tokens parameter to include in the request.
	 */
	protected getMaxOutputTokens(): number | undefined {
		const { info } = this.getModel()
		return this.options.modelMaxTokens || info.maxTokens || undefined
	}

	/**
	 * Build the Requesty provider options for tracing metadata.
	 *
	 * Note: providerOptions.requesty gets placed into body.requesty (the Requesty
	 * metadata field), NOT into top-level body fields. Only tracing/metadata should
	 * go here — reasoning settings go through model settings in getLanguageModel().
	 */
	private getRequestyProviderOptions(metadata?: ApiHandlerCreateMessageMetadata) {
		if (!metadata?.taskId && !metadata?.mode) {
			return undefined
		}

		return {
			extraBody: {
				requesty: {
					trace_id: metadata?.taskId ?? null,
					extra: { mode: metadata?.mode ?? null },
				},
			},
		}
	}

	/**
	 * Process usage metrics from the AI SDK response, including Requesty's cache metrics.
	 *
	 * Requesty provides cache hit/miss info via providerMetadata, but only when both
	 * cachingTokens and cachedTokens are non-zero (SDK limitation). We fall back to
	 * usage.details.cachedInputTokens when providerMetadata is empty.
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
		modelInfo?: ModelInfo,
		providerMetadata?: RequestyProviderMetadata,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		const cacheWriteTokens = providerMetadata?.requesty?.usage?.cachingTokens ?? 0
		const cacheReadTokens = providerMetadata?.requesty?.usage?.cachedTokens ?? usage.details?.cachedInputTokens ?? 0

		const { totalCost } = modelInfo
			? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
			: { totalCost: 0 }

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
			reasoningTokens: usage.details?.reasoningTokens,
			totalCost,
		}
	}

	/**
	 * Create a message stream using the AI SDK.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { info, temperature } = await this.fetchModel()
		const languageModel = this.getLanguageModel()

		const aiSdkMessages = messages as ModelMessage[]

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const requestyOptions = this.getRequestyProviderOptions(metadata)

		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature: this.options.modelTemperature ?? temperature ?? 0,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			...(requestyOptions ? { providerOptions: { requesty: requestyOptions } } : {}),
		}

		const result = streamText(requestOptions)

		try {
			const processUsage = this.processUsageMetrics.bind(this)
			yield* consumeAiSdkStream(result, async function* () {
				const [usage, providerMetadata] = await Promise.all([result.usage, result.providerMetadata])
				yield processUsage(usage, info, providerMetadata as RequestyProviderMetadata)
			})
		} catch (error) {
			throw handleAiSdkError(error, "Requesty")
		}
	}

	/**
	 * Complete a prompt using the AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		const { temperature } = await this.fetchModel()
		const languageModel = this.getLanguageModel()

		try {
			const { text } = await generateText({
				model: languageModel,
				prompt,
				maxOutputTokens: this.getMaxOutputTokens(),
				temperature: this.options.modelTemperature ?? temperature ?? 0,
			})

			return text
		} catch (error) {
			throw handleAiSdkError(error, "Requesty")
		}
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
