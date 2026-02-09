import { minimaxModels, minimaxDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { OpenAICompatibleHandler, type OpenAICompatibleConfig } from "./openai-compatible"

export class MiniMaxHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		const modelId = options.apiModelId ?? minimaxDefaultModelId
		const modelInfo = minimaxModels[modelId as keyof typeof minimaxModels] || minimaxModels[minimaxDefaultModelId]

		// MiniMax exposes an OpenAI-compatible API at /v1.
		// International: https://api.minimax.io/v1
		// China: https://api.minimaxi.com/v1
		const rawBase = options.minimaxBaseUrl || "https://api.minimax.io"
		const baseURL = rawBase
			? `${rawBase
					.replace(/\/+$/, "")
					.replace(/\/v1$/, "")
					.replace(/\/anthropic$/, "")}/v1`
			: "https://api.minimax.io/v1"

		const config: OpenAICompatibleConfig = {
			providerName: "minimax",
			baseURL,
			apiKey: options.minimaxApiKey || "not-provided",
			modelId,
			modelInfo,
			modelMaxTokens: options.modelMaxTokens ?? undefined,
			temperature: options.modelTemperature ?? undefined,
		}

		super(options, config)
	}

	override getModel() {
		const id = this.options.apiModelId ?? minimaxDefaultModelId
		const info = minimaxModels[id as keyof typeof minimaxModels] || minimaxModels[minimaxDefaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})
		return { id, info, ...params }
	}
}
