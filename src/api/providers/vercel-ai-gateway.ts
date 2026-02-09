import {
	vercelAiGatewayDefaultModelId,
	vercelAiGatewayDefaultModelInfo,
	VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import type { ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { OpenAICompatibleHandler, type OpenAICompatibleConfig } from "./openai-compatible"
import { getModelsFromCache } from "./fetchers/modelCache"

export class VercelAiGatewayHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		const modelId = options.vercelAiGatewayModelId ?? vercelAiGatewayDefaultModelId
		const models = getModelsFromCache("vercel-ai-gateway")
		const modelInfo = (models && models[modelId]) || vercelAiGatewayDefaultModelInfo

		const config: OpenAICompatibleConfig = {
			providerName: "vercel-ai-gateway",
			baseURL: "https://ai-gateway.vercel.sh/v1",
			apiKey: options.vercelAiGatewayApiKey ?? "not-provided",
			modelId,
			modelInfo,
			temperature: options.modelTemperature ?? undefined,
		}

		super(options, config)
	}

	override getModel() {
		const id = this.options.vercelAiGatewayModelId ?? vercelAiGatewayDefaultModelId
		const models = getModelsFromCache("vercel-ai-gateway")
		const info = (models && models[id]) || vercelAiGatewayDefaultModelInfo
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE,
		})
		return { id, info, ...params }
	}

	/**
	 * Override to handle Vercel AI Gateway's usage metrics, including caching and cost.
	 * The gateway returns cache_creation_input_tokens and cost in raw usage data.
	 */
	protected override processUsageMetrics(usage: {
		inputTokens?: number
		outputTokens?: number
		details?: {
			cachedInputTokens?: number
			reasoningTokens?: number
		}
		raw?: Record<string, unknown>
	}): ApiStreamUsageChunk {
		const rawUsage = usage.raw as
			| {
					cache_creation_input_tokens?: number
					cost?: number
			  }
			| undefined

		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			cacheWriteTokens: rawUsage?.cache_creation_input_tokens || undefined,
			cacheReadTokens: usage.details?.cachedInputTokens,
			totalCost: rawUsage?.cost ?? 0,
		}
	}
}
