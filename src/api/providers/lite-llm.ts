/**
 * LiteLLM provider handler using Vercel AI SDK.
 *
 * This handler uses @ai-sdk/openai-compatible to communicate with LiteLLM proxy servers.
 * LiteLLM follows the OpenAI API format, making it compatible with the OpenAI-compatible provider.
 * Models are dynamically fetched from the LiteLLM server via /v1/model/info.
 */

import { Anthropic } from "@anthropic-ai/sdk"
import { LanguageModel } from "ai"

import { litellmDefaultModelId, litellmDefaultModelInfo, type ModelInfo, type ModelRecord } from "@roo-code/types"

import { type ApiHandlerOptions, getModelMaxOutputTokens } from "../../shared/api"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"

import { OpenAICompatibleHandler } from "./openai-compatible"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

export class LiteLLMHandler extends OpenAICompatibleHandler implements SingleCompletionHandler {
	private models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		const modelId = options.litellmModelId || litellmDefaultModelId

		super(options, {
			providerName: "LiteLLM",
			baseURL: options.litellmBaseUrl || "http://localhost:4000",
			apiKey: options.litellmApiKey || "dummy-key",
			modelId,
			modelInfo: litellmDefaultModelInfo,
			temperature: options.modelTemperature ?? 0,
			modelMaxTokens: options.modelMaxTokens,
		})
	}

	private async fetchModel() {
		this.models = await getModels({
			provider: "litellm",
			apiKey: this.config.apiKey,
			baseUrl: this.config.baseURL,
		})
		return this.getModel()
	}

	override getModel(): { id: string; info: ModelInfo } {
		const id = this.config.modelId || litellmDefaultModelId

		if (this.models[id]) {
			return { id, info: this.models[id] }
		}

		const cachedModels = getModelsFromCache("litellm")
		if (cachedModels?.[id]) {
			this.models = cachedModels
			return { id, info: cachedModels[id] }
		}

		return { id: this.config.modelId || litellmDefaultModelId, info: litellmDefaultModelInfo }
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

	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.fetchModel()
		yield* super.createMessage(systemPrompt, messages, metadata)
	}

	override async completePrompt(prompt: string): Promise<string> {
		await this.fetchModel()
		return super.completePrompt(prompt)
	}

	protected override processUsageMetrics(usage: {
		inputTokens?: number
		outputTokens?: number
		totalInputTokens?: number
		totalOutputTokens?: number
		cachedInputTokens?: number
		reasoningTokens?: number
		inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number }
		outputTokenDetails?: { reasoningTokens?: number }
		details?: {
			cachedInputTokens?: number
			reasoningTokens?: number
		}
		raw?: Record<string, unknown>
	}): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheReadTokens:
				usage.cachedInputTokens ?? usage.inputTokenDetails?.cacheReadTokens ?? usage.details?.cachedInputTokens,
			reasoningTokens:
				usage.reasoningTokens ?? usage.outputTokenDetails?.reasoningTokens ?? usage.details?.reasoningTokens,
			totalInputTokens: inputTokens,
			totalOutputTokens: outputTokens,
		}
	}
}
