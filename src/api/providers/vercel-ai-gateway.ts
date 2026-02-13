import { Anthropic } from "@anthropic-ai/sdk"
import { createGateway, streamText, generateText, ToolSet } from "ai"

import {
	vercelAiGatewayDefaultModelId,
	vercelAiGatewayDefaultModelInfo,
	VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE,
	type ModelInfo,
	type ModelRecord,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
	yieldResponseMessage,
} from "../transform/ai-sdk"
import { applyToolCacheOptions } from "../transform/cache-breakpoints"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import type { OpenAiReasoningParams } from "../transform/reasoning"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"
import { sanitizeMessagesForProvider } from "../transform/sanitize-messages"

type ModelSelection = {
	id: string
	info: ModelInfo
	maxTokens?: number
	temperature?: number
	reasoning?: OpenAiReasoningParams
	reasoningBudget?: number
}

/**
 * Vercel AI Gateway provider using the built-in AI SDK gateway support.
 * Uses `createGateway` from the `ai` package to communicate with the
 * Vercel AI Gateway v3 API at https://ai-gateway.vercel.sh/v3/ai.
 */
export class VercelAiGatewayHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createGateway>
	private readonly name = "vercel-ai-gateway" as const
	private models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		this.provider = createGateway({
			apiKey: options.vercelAiGatewayApiKey ?? "not-provided",
			headers: DEFAULT_HEADERS,
		})
	}

	override getModel(): ModelSelection {
		const id = this.options.vercelAiGatewayModelId ?? vercelAiGatewayDefaultModelId
		const resolveModel = (modelInfo: ModelInfo) => ({
			id,
			info: modelInfo,
			...getModelParams({
				format: "openai",
				modelId: id,
				model: modelInfo,
				settings: this.options,
				defaultTemperature: VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE,
			}),
		})

		if (this.models[id]) {
			return resolveModel(this.models[id])
		}

		const cachedModels = getModelsFromCache(this.name)
		if (cachedModels?.[id]) {
			this.models = cachedModels
			return resolveModel(cachedModels[id])
		}

		return {
			id: vercelAiGatewayDefaultModelId,
			info: vercelAiGatewayDefaultModelInfo,
			...getModelParams({
				format: "openai",
				modelId: vercelAiGatewayDefaultModelId,
				model: vercelAiGatewayDefaultModelInfo,
				settings: this.options,
				defaultTemperature: VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE,
			}),
		}
	}

	public async fetchModel() {
		this.models = await getModels({
			provider: this.name,
			apiKey: this.options.vercelAiGatewayApiKey ?? "not-provided",
		})
		return this.getModel()
	}

	protected getLanguageModel(modelId?: string) {
		const id = modelId ?? this.getModel().id
		return this.provider(id)
	}

	protected supportsTemperature(modelId: string): boolean {
		return !modelId.startsWith("openai/o3-mini")
	}

	protected processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
			details?: {
				cachedInputTokens?: number
				reasoningTokens?: number
			}
		},
		providerMetadata?: Record<string, Record<string, unknown>>,
	): ApiStreamUsageChunk {
		const gatewayMeta = providerMetadata?.gateway as Record<string, unknown> | undefined

		const cacheWriteTokens = (gatewayMeta?.cache_creation_input_tokens as number) ?? undefined
		const cacheReadTokens = usage.details?.cachedInputTokens ?? (gatewayMeta?.cached_tokens as number) ?? undefined
		const totalCost = (gatewayMeta?.cost as number) ?? 0

		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			cacheWriteTokens,
			cacheReadTokens,
			totalCost,
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info, temperature, reasoning, reasoningBudget } = await this.fetchModel()
		const languageModel = this.getLanguageModel(modelId)

		const aiSdkMessages = sanitizeMessagesForProvider(messages)

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined
		applyToolCacheOptions(aiSdkTools as Parameters<typeof applyToolCacheOptions>[0], metadata?.toolProviderOptions)

		const resolvedTemperature = this.supportsTemperature(modelId)
			? (this.options.modelTemperature ?? temperature ?? VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE)
			: undefined

		const reasoningConfig = reasoning ? { enabled: true, effort: reasoning.reasoning_effort } : undefined
		const anthropicProviderOptions =
			modelId.startsWith("anthropic/") && reasoningConfig
				? {
						anthropic: {
							thinking: {
								type: "enabled" as const,
								budgetTokens: reasoningBudget ?? Math.floor((info.maxTokens ?? 0) * 0.8),
							},
						},
					}
				: undefined

		const result = streamText({
			model: languageModel,
			system: systemPrompt || undefined,
			messages: aiSdkMessages,
			temperature: resolvedTemperature,
			maxOutputTokens: info.maxTokens ?? undefined,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			...(reasoningConfig ? { reasoning: reasoningConfig } : {}),
			...(anthropicProviderOptions ? { providerOptions: anthropicProviderOptions } : {}),
		})

		try {
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
					yield this.processUsageMetrics(usage, providerMetadata as any)
				}
			} catch (usageError) {
				if (lastStreamError) {
					throw new Error(lastStreamError)
				}
				throw usageError
			}

			yield* yieldResponseMessage(result)
		} catch (error) {
			throw handleAiSdkError(error, "Vercel AI Gateway")
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info, temperature, reasoning, reasoningBudget } = await this.fetchModel()
		const languageModel = this.getLanguageModel(modelId)

		const resolvedTemperature = this.supportsTemperature(modelId)
			? (this.options.modelTemperature ?? temperature ?? VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE)
			: undefined

		const reasoningConfig = reasoning ? { enabled: true, effort: reasoning.reasoning_effort } : undefined
		const anthropicProviderOptions =
			modelId.startsWith("anthropic/") && reasoningConfig
				? {
						anthropic: {
							thinking: {
								type: "enabled" as const,
								budgetTokens: reasoningBudget ?? Math.floor((info.maxTokens ?? 0) * 0.8),
							},
						},
					}
				: undefined

		try {
			const { text } = await generateText({
				model: languageModel,
				prompt,
				maxOutputTokens: info.maxTokens ?? undefined,
				temperature: resolvedTemperature,
				...(reasoningConfig ? { reasoning: reasoningConfig } : {}),
				...(anthropicProviderOptions ? { providerOptions: anthropicProviderOptions } : {}),
			})

			return text
		} catch (error) {
			throw handleAiSdkError(error, "Vercel AI Gateway")
		}
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
