import OpenAI from "openai"

import type { AipingModelId, aipingModels, aipingDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream } from "../transform/stream"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import type { SingleCompletionHandler } from "../index"
import { DEFAULT_HEADERS } from "./constants"

/**
 * AiPing Provider Handler
 * API Documentation: https://aiping.cn/api/v1/docs
 *
 * Supported models:
 * - MiniMax-M2.1: 200K context, 200K output
 * - GLM-4.7: 200K context, 200K output
 */
export class AipingHandler extends BaseOpenAiCompatibleProvider<AipingModelId> implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		const baseURL = options.aipingBaseUrl || "https://aiping.cn/api/v1"

		super({
			providerName: "AiPing",
			baseURL,
			defaultProviderModelId: aipingDefaultModelId,
			providerModels: aipingModels,
			defaultTemperature: 1.0,
			...options,
		})
	}

	protected override convertToolsForOpenAI(
		tools: OpenAI.Chat.ChatCompletionTool[],
	): OpenAI.Chat.ChatCompletionTool[] {
		return tools
	}
}
