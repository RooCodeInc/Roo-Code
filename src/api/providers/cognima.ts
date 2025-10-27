import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type CognimaModelId, cognimaDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStreamChunk } from "../transform/stream"
import { RouterProvider } from "./router-provider"
import { handleOpenAIError } from "./utils/openai-error-handler"

export class CognimaHandler extends RouterProvider {
	private readonly providerName = "Cognima"

	constructor(options: ApiHandlerOptions) {
		super({
			options,
			name: "cognima",
			baseURL: "https://cog2.cognima.com.br/openai/v1",
			apiKey: options.cognimaApiKey,
			modelId: options.cognimaModelId,
			defaultModelId: cognimaDefaultModelId,
			defaultModelInfo: {
				maxTokens: 16384,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: false,
				inputPrice: 2.5,
				outputPrice: 10,
				supportsTemperature: true,
			},
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): AsyncGenerator<ApiStreamChunk> {
		const model = await this.fetchModel()
		const modelId = model.id
		const maxTokens = model.info.maxTokens
		const temperature = 0 // Default temperature

		// Convert Anthropic messages to OpenAI format
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const completionParams: OpenAI.Chat.ChatCompletionCreateParams = {
			model: modelId,
			...(maxTokens && maxTokens > 0 && { max_tokens: maxTokens }),
			temperature,
			messages: openAiMessages,
			stream: true,
			stream_options: { include_usage: true },
		}

		let stream
		try {
			stream = await this.client.chat.completions.create(completionParams)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}

		for await (const chunk of stream) {
			// Handle OpenAI error responses
			if ("error" in chunk) {
				const error = chunk.error as { message?: string; code?: number }
				console.error(`Cognima API Error: ${error?.code} - ${error?.message}`)
				throw new Error(`Cognima API Error ${error?.code}: ${error?.message}`)
			}

			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				yield { type: "text", text: delta.content }
			}

			if (chunk.usage) {
				const usage = chunk.usage
				yield {
					type: "usage",
					inputTokens: usage.prompt_tokens || 0,
					outputTokens: usage.completion_tokens || 0,
					totalCost: 0, // Cognima doesn't provide cost info in usage
				}
			}
		}
	}
}