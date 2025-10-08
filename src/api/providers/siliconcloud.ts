import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { siliconCloudDefaultModelId, siliconCloudApiLineConfigs, siliconCloudModels, ModelInfo } from "@roo-code/types"

import { type ApiHandlerOptions } from "../../shared/api"
import { type ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { getModelParams } from "../transform/model-params"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { OpenAiHandler } from "./openai"
import { ApiHandlerCreateMessageMetadata } from ".."

const SILICON_CLOUD_PROVIDER_NAME = "siliconcloud" as const

export class SiliconCloudHandler extends OpenAiHandler {
	constructor(options: ApiHandlerOptions) {
		const apiLine = options.siliconCloudApiLine || "china"

		super({
			...options,
			openAiApiKey: options.siliconCloudApiKey,
			openAiBaseUrl: siliconCloudApiLineConfigs[apiLine].baseUrl,
			openAiModelId: options.apiModelId || siliconCloudDefaultModelId,
		})
	}

	override getModel() {
		const id = this.options.apiModelId || siliconCloudDefaultModelId
		const info =
			siliconCloudModels[id as keyof typeof siliconCloudModels] ?? siliconCloudModels[siliconCloudDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: model, info } = this.getModel()

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			max_tokens: info.maxTokens,
			temperature: this.options.modelTemperature ?? 0,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
		}

		if (info.supportsReasoningBudget) {
			if (this.options.enableReasoningEffort) {
				// @ts-ignore
				params.enable_thinking = true
			}

			if (this.options.modelMaxThinkingTokens) {
				// @ts-ignore
				params.thinking_budget = this.options.modelMaxThinkingTokens
			}
		}

		let stream
		try {
			stream = await this.client.chat.completions.create(params)
		} catch (error) {
			throw handleOpenAIError(error, SILICON_CLOUD_PROVIDER_NAME)
		}

		let lastUsage: OpenAI.CompletionUsage | undefined

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta ?? {}

			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if ("reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: (delta.reasoning_content as string | undefined) || "",
				}
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield super.processUsageMetrics(lastUsage)
		}
	}
}
