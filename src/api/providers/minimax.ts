import { Anthropic } from "@anthropic-ai/sdk"
import { type MinimaxModelId, minimaxDefaultModelId, minimaxModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { XmlMatcher } from "../../utils/xml-matcher"
import { ApiStream } from "../transform/stream"
import type { ApiHandlerCreateMessageMetadata } from "../index"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class MiniMaxHandler extends BaseOpenAiCompatibleProvider<MinimaxModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "MiniMax",
			baseURL: options.minimaxBaseUrl ?? "https://api.minimax.io/v1",
			apiKey: options.minimaxApiKey,
			defaultProviderModelId: minimaxDefaultModelId,
			providerModels: minimaxModels,
			defaultTemperature: 1.0,
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const stream = await this.createStream(systemPrompt, messages, metadata)

		const matcher = new XmlMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				for (const matcherChunk of matcher.update(delta.content)) {
					yield matcherChunk
				}
			}

			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
				}
			}
		}

		for (const chunk of matcher.final()) {
			yield chunk
		}
	}
}
