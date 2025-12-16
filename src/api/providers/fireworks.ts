import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type FireworksModelId, fireworksDefaultModelId, fireworksModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { getModelParams } from "../transform/model-params"
import { getModelMaxOutputTokens } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"

import type { ApiHandlerCreateMessageMetadata } from "../index"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import { handleOpenAIError } from "./utils/openai-error-handler"

export class FireworksHandler extends BaseOpenAiCompatibleProvider<FireworksModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Fireworks",
			baseURL: "https://api.fireworks.ai/inference/v1",
			apiKey: options.fireworksApiKey,
			defaultProviderModelId: fireworksDefaultModelId,
			providerModels: fireworksModels,
			defaultTemperature: 0.5,
		})
	}

	override getModel() {
		const id =
			this.options.apiModelId && this.options.apiModelId in this.providerModels
				? (this.options.apiModelId as FireworksModelId)
				: this.defaultProviderModelId

		const info = this.providerModels[id]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	protected override createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	) {
		const { id: model, info, reasoning } = this.getModel()

		// Centralized cap: clamp to 20% of the context window (unless provider-specific exceptions apply)
		const max_tokens =
			getModelMaxOutputTokens({
				modelId: model,
				model: info,
				settings: this.options,
				format: "openai",
			}) ?? undefined

		const temperature = this.options.modelTemperature ?? this.defaultTemperature

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
			...(metadata?.toolProtocol === "native" && {
				parallel_tool_calls: metadata.parallelToolCalls ?? false,
			}),
			// Use Fireworks-style reasoning_effort parameter instead of Anthropic-style "thinking"
			...(reasoning && reasoning),
		}

		try {
			return this.client.chat.completions.create(params, requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, "Fireworks")
		}
	}
}
