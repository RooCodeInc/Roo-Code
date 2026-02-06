import { Anthropic } from "@anthropic-ai/sdk"
import { streamText } from "ai"

import { DEEP_SEEK_DEFAULT_TEMPERATURE, featherlessDefaultModelId, featherlessModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { TagMatcher } from "../../utils/tag-matcher"
import { convertToAiSdkMessages, handleAiSdkError } from "../transform/ai-sdk"
import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import type { ApiHandlerCreateMessageMetadata } from "../index"
import { OpenAICompatibleHandler, OpenAICompatibleConfig } from "./openai-compatible"

export class FeatherlessHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		const modelId = options.apiModelId ?? featherlessDefaultModelId
		const modelInfo =
			featherlessModels[modelId as keyof typeof featherlessModels] || featherlessModels[featherlessDefaultModelId]

		const config: OpenAICompatibleConfig = {
			providerName: "Featherless",
			baseURL: "https://api.featherless.ai/v1",
			apiKey: options.featherlessApiKey ?? "not-provided",
			modelId,
			modelInfo,
			modelMaxTokens: options.modelMaxTokens ?? undefined,
			temperature: options.modelTemperature ?? undefined,
		}

		super(options, config)
	}

	override getModel() {
		const id = this.options.apiModelId ?? featherlessDefaultModelId
		const info =
			featherlessModels[id as keyof typeof featherlessModels] || featherlessModels[featherlessDefaultModelId]
		const isDeepSeekR1 = id.includes("DeepSeek-R1")
		const defaultTemp = isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0.5
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: defaultTemp,
		})
		return { id, info, ...params }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()

		if (model.id.includes("DeepSeek-R1")) {
			// R1 path: merge system prompt into user messages, use TagMatcher for <think> tags
			const r1Messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: systemPrompt }, ...messages]
			const aiSdkMessages = convertToAiSdkMessages(r1Messages)

			const result = streamText({
				model: this.getLanguageModel(),
				messages: aiSdkMessages,
				temperature: model.temperature ?? 0,
				maxOutputTokens: this.getMaxOutputTokens(),
			})

			const matcher = new TagMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)

			try {
				for await (const part of result.fullStream) {
					if (part.type === "text-delta") {
						for (const processedChunk of matcher.update(part.text)) {
							yield processedChunk
						}
					}
				}

				for (const processedChunk of matcher.final()) {
					yield processedChunk
				}

				const usage = await result.usage
				if (usage) {
					yield this.processUsageMetrics(usage)
				}
			} catch (error) {
				throw handleAiSdkError(error, "Featherless")
			}
		} else {
			yield* super.createMessage(systemPrompt, messages, metadata)
		}
	}
}
