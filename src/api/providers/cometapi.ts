import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { cometApiDefaultModelId, cometApiDefaultModelInfo, cometApiModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { getModelParams } from "../transform/model-params"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { RouterProvider } from "./router-provider"

export class CometAPIHandler extends RouterProvider implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			options: {
				...options,
				// Add custom headers for CometAPI
				openAiHeaders: {
					"HTTP-Referer": "https://github.com/RooVetGit/Roo-Code",
					"X-Title": "Roo Code",
					...(options.openAiHeaders || {}),
				},
			},
			name: "cometapi",
			baseURL: options.cometApiBaseUrl || "https://api.cometapi.com/v1",
			apiKey: options.cometApiKey || "not-provided",
			modelId: options.cometApiModelId,
			defaultModelId: cometApiDefaultModelId,
			defaultModelInfo: cometApiDefaultModelInfo,
		})

		// Initialize with fallback models to ensure we always have models available
		this.models = { ...cometApiModels }
	}

	public override async fetchModel() {
		// Fetch dynamic models from API, but keep fallback models if API fails
		try {
			const apiModels = await super.fetchModel()
			// Merge API models with fallback models
			this.models = { ...cometApiModels, ...this.models }
			return apiModels
		} catch (error) {
			console.warn("CometAPI: Failed to fetch models from API, using fallback models", error)
			// Return default model using fallback models
			return this.getModel()
		}
	}

	override getModel() {
		const id = this.options.cometApiModelId ?? cometApiDefaultModelId
		const info = this.models[id] ?? cometApiDefaultModelInfo

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
		})

		return { id, info, ...params }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		_metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Ensure we have up-to-date model metadata
		await this.fetchModel()
		const { id: modelId, info, reasoningEffort } = this.getModel()

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
			reasoning_effort: reasoningEffort,
		} as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming

		if (this.supportsTemperature(modelId)) {
			requestOptions.temperature = this.options.modelTemperature ?? 0
		}

		if (this.options.includeMaxTokens === true && info.maxTokens) {
			;(requestOptions as any).max_completion_tokens = this.options.modelMaxTokens || info.maxTokens
		}

		const { data: stream } = await this.client.chat.completions.create(requestOptions).withResponse()

		let lastUsage: OpenAI.CompletionUsage | undefined
		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				yield { type: "text", text: delta.content }
			}

			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield { type: "reasoning", text: (delta.reasoning_content as string | undefined) || "" }
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			const inputTokens = lastUsage.prompt_tokens || 0
			const outputTokens = lastUsage.completion_tokens || 0
			const cacheWriteTokens = lastUsage.prompt_tokens_details?.cached_tokens || 0
			const cacheReadTokens = 0

			const totalCost = calculateApiCostOpenAI(info, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)

			const usage: ApiStreamUsageChunk = {
				type: "usage",
				inputTokens,
				outputTokens,
				cacheWriteTokens: cacheWriteTokens || undefined,
				cacheReadTokens: cacheReadTokens || undefined,
				totalCost,
			}

			yield usage
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId } = this.getModel()

		try {
			const response = await this.client.chat.completions.create({
				model: modelId,
				messages: [{ role: "user", content: prompt }],
				stream: false,
			})

			return response.choices[0]?.message?.content || ""
		} catch (error) {
			throw new Error(`CometAPI completion error: ${error}`)
		}
	}
}
