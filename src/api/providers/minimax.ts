import type { Anthropic } from "@anthropic-ai/sdk"
import { createAnthropic } from "@ai-sdk/anthropic"
import { streamText, generateText, ToolSet } from "ai"

import { type ModelInfo, minimaxDefaultModelId, minimaxModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import type { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { mergeEnvironmentDetailsForMiniMax } from "../transform/minimax-format"
import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
	yieldResponseMessage,
} from "../transform/ai-sdk"
import { applyToolCacheOptions } from "../transform/cache-breakpoints"
import { calculateApiCostAnthropic } from "../../shared/cost"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"
import { sanitizeMessagesForProvider } from "../transform/sanitize-messages"

export class MiniMaxHandler extends BaseProvider implements SingleCompletionHandler {
	private client: ReturnType<typeof createAnthropic>
	private options: ApiHandlerOptions
	private readonly providerName = "MiniMax"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const rawBaseUrl = this.options.minimaxBaseUrl
		let resolvedBaseUrl: string | undefined

		if (rawBaseUrl) {
			if (rawBaseUrl.endsWith("/anthropic/v1")) {
				resolvedBaseUrl = rawBaseUrl
			} else if (rawBaseUrl.endsWith("/v1")) {
				resolvedBaseUrl = rawBaseUrl.slice(0, -3) + "/anthropic/v1"
			} else if (rawBaseUrl.endsWith("/anthropic")) {
				resolvedBaseUrl = rawBaseUrl + "/v1"
			} else {
				resolvedBaseUrl = rawBaseUrl + "/anthropic/v1"
			}
		} else {
			resolvedBaseUrl = "https://api.minimax.io/anthropic/v1"
		}

		this.client = createAnthropic({
			baseURL: resolvedBaseUrl,
			apiKey: this.options.minimaxApiKey ?? "",
			headers: DEFAULT_HEADERS,
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const modelConfig = this.getModel()

		const modelParams = getModelParams({
			format: "anthropic",
			modelId: modelConfig.id,
			model: modelConfig.info,
			settings: this.options,
			defaultTemperature: 1.0,
		})

		const mergedMessages = mergeEnvironmentDetailsForMiniMax(messages as any)
		const aiSdkMessages = sanitizeMessagesForProvider(mergedMessages as RooMessage[])
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined
		applyToolCacheOptions(aiSdkTools as Parameters<typeof applyToolCacheOptions>[0], metadata?.toolProviderOptions)

		const anthropicProviderOptions: Record<string, unknown> = {}

		if (modelParams.reasoning && modelParams.reasoningBudget) {
			anthropicProviderOptions.thinking = {
				type: "enabled",
				budgetTokens: modelParams.reasoningBudget,
			}
		}

		if (metadata?.parallelToolCalls === false) {
			anthropicProviderOptions.disableParallelToolUse = true
		}

		const requestOptions = {
			model: this.client(modelConfig.id),
			system: systemPrompt || undefined,
			messages: aiSdkMessages,
			temperature: modelParams.temperature,
			maxOutputTokens: modelParams.maxTokens ?? modelConfig.info.maxTokens,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			...(Object.keys(anthropicProviderOptions).length > 0 && {
				providerOptions: { anthropic: anthropicProviderOptions } as Record<string, Record<string, unknown>>,
			}),
		}

		try {
			const result = streamText(requestOptions as Parameters<typeof streamText>[0])

			let lastStreamError: string | undefined

			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					if (chunk.type === "error") {
						lastStreamError = chunk.message
					}
					yield chunk
				}
			}

			try {
				const usage = await result.usage
				const providerMetadata = await result.providerMetadata
				if (usage) {
					yield this.processUsageMetrics(usage, modelConfig.info, providerMetadata)
				}
			} catch (usageError) {
				if (lastStreamError) {
					throw new Error(lastStreamError)
				}
				throw usageError
			}

			yield* yieldResponseMessage(result)
		} catch (error) {
			throw handleAiSdkError(error, this.providerName)
		}
	}

	private processUsageMetrics(
		usage: { inputTokens?: number; outputTokens?: number },
		info: ModelInfo,
		providerMetadata?: Record<string, Record<string, unknown>>,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens ?? 0
		const outputTokens = usage.outputTokens ?? 0

		const anthropicMeta = providerMetadata?.anthropic as
			| { cacheCreationInputTokens?: number; cacheReadInputTokens?: number }
			| undefined
		const cacheWriteTokens = anthropicMeta?.cacheCreationInputTokens ?? 0
		const cacheReadTokens = anthropicMeta?.cacheReadInputTokens ?? 0

		const { totalCost } = calculateApiCostAnthropic(
			info,
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
		)

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens: cacheWriteTokens > 0 ? cacheWriteTokens : undefined,
			cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : undefined,
			totalCost,
			// MiniMax uses Anthropic SDK: inputTokens is non-cached only
			totalInputTokens: inputTokens + (cacheWriteTokens ?? 0) + (cacheReadTokens ?? 0),
			totalOutputTokens: outputTokens,
		}
	}

	getModel() {
		const modelId = this.options.apiModelId

		const id = modelId && modelId in minimaxModels ? (modelId as keyof typeof minimaxModels) : minimaxDefaultModelId
		const info = minimaxModels[id]

		const params = getModelParams({
			format: "anthropic",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 1.0,
		})

		return {
			id,
			info,
			...params,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id, maxTokens, temperature } = this.getModel()

		try {
			const { text } = await generateText({
				model: this.client(id),
				prompt,
				maxOutputTokens: maxTokens ?? minimaxModels[minimaxDefaultModelId].maxTokens,
				temperature,
			})

			return text
		} catch (error) {
			throw handleAiSdkError(error, this.providerName)
		}
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
