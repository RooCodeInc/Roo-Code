import OpenAI from "openai"

import type { AipingModelId } from "@roo-code/types"
import { aipingDefaultModelId, aipingModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream } from "../transform/stream"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import type { SingleCompletionHandler } from "../index"
import { DEFAULT_HEADERS } from "./constants"

export class AipingHandler extends BaseOpenAiCompatibleProvider<AipingModelId> implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		const baseURL = options.aipingBaseUrl || "https://aiping.cn/api/v1"
		super({
			providerName: "AiPing",
			baseURL,
			defaultProviderModelId: aipingDefaultModelId,
			providerModels: aipingModels,
			defaultTemperature: 1.0,
			apiKey: options.aipingApiKey,
			...options,
		})
	}

	protected override convertToolsForOpenAI(
		tools: OpenAI.Chat.ChatCompletionTool[],
	): OpenAI.Chat.ChatCompletionTool[] {
		return tools
	}
}
