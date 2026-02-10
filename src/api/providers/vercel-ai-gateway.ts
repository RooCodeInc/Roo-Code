import { Anthropic } from "@anthropic-ai/sdk"
import { createGateway, streamText, generateText, ToolSet, ModelMessage } from "ai"

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
} from "../transform/ai-sdk"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

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

	override getModel(): { id: string; info: ModelInfo } {
		const id = this.options.vercelAiGatewayModelId ?? vercelAiGatewayDefaultModelId

		if (this.models[id]) {
			return { id, info: this.models[id] }
		}

		const cachedModels = getModelsFromCache(this.name)
		if (cachedModels?.[id]) {
			this.models = cachedModels
			return { id, info: cachedModels[id] }
		}

		return { id: vercelAiGatewayDefaultModelId, info: vercelAiGatewayDefaultModelInfo }
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
		const { id: modelId, info } = await this.fetchModel()
		const languageModel = this.getLanguageModel(modelId)

		const aiSdkMessages = messages as ModelMessage[]

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const temperature = this.supportsTemperature(modelId)
			? (this.options.modelTemperature ?? VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE)
			: undefined

		const result = streamText({
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature,
			maxOutputTokens: info.maxTokens ?? undefined,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
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
		} catch (error) {
			throw handleAiSdkError(error, "Vercel AI Gateway")
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info } = await this.fetchModel()
		const languageModel = this.getLanguageModel(modelId)

		const temperature = this.supportsTemperature(modelId)
			? (this.options.modelTemperature ?? VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE)
			: undefined

		try {
			const { text } = await generateText({
				model: languageModel,
				prompt,
				maxOutputTokens: info.maxTokens ?? undefined,
				temperature,
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
