import { DEEP_SEEK_DEFAULT_TEMPERATURE, type ChutesModelId, chutesDefaultModelId, chutesModels } from "@roo-code/types"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ApiHandlerOptions } from "../../shared/api"
import { shouldUseReasoningEffort } from "../../shared/api"
import { XmlMatcher } from "../../utils/xml-matcher"
import { convertToR1Format } from "../transform/r1-format"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class ChutesHandler extends BaseOpenAiCompatibleProvider<ChutesModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Chutes",
			baseURL: "https://llm.chutes.ai/v1",
			apiKey: options.chutesApiKey,
			defaultProviderModelId: chutesDefaultModelId,
			providerModels: chutesModels,
			defaultTemperature: 0.5,
		})
	}

	private getCompletionParams(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		enableReasoning: boolean = false,
	): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
		const {
			id: model,
			info: { maxTokens: max_tokens },
		} = this.getModel()

		const temperature = this.options.modelTemperature ?? this.getModel().info.temperature

		const params: any = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
		}

		// Add reasoning support for DeepSeek V3.1, GLM-4.5, and GLM-4.6 models
		if (enableReasoning) {
			params.chat_template_kwargs = {
				thinking: true,
			}
		}

		return params
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const model = this.getModel()

		// Handle DeepSeek R1 models with XML tag parsing
		if (model.id.includes("DeepSeek-R1")) {
			const stream = await this.client.chat.completions.create({
				...this.getCompletionParams(systemPrompt, messages),
				messages: convertToR1Format([{ role: "user", content: systemPrompt }, ...messages]),
			})

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
					for (const processedChunk of matcher.update(delta.content)) {
						yield processedChunk
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

			// Process any remaining content
			for (const processedChunk of matcher.final()) {
				yield processedChunk
			}
			return
		}

		// Handle DeepSeek V3.1, GLM-4.5, and GLM-4.6 models with reasoning_content parsing
		const isHybridReasoningModel =
			model.id.includes("DeepSeek-V3.1") || model.id.includes("GLM-4.5") || model.id.includes("GLM-4.6")
		const reasoningEnabled = this.options.enableReasoningEffort === true

		if (isHybridReasoningModel && reasoningEnabled) {
			const stream = await this.client.chat.completions.create(
				this.getCompletionParams(systemPrompt, messages, true),
			)

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta

				// Handle reasoning content from the response
				if ((delta as any)?.reasoning_content) {
					yield {
						type: "reasoning",
						text: (delta as any).reasoning_content,
					}
				}

				// Handle regular text content
				if (delta?.content) {
					yield {
						type: "text",
						text: delta.content,
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
		} else {
			// For non-reasoning models or when reasoning is disabled, use the base implementation
			yield* super.createMessage(systemPrompt, messages)
		}
	}

	override getModel() {
		const model = super.getModel()
		const isDeepSeekR1 = model.id.includes("DeepSeek-R1")
		return {
			...model,
			info: {
				...model.info,
				temperature: isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : this.defaultTemperature,
			},
		}
	}
}
