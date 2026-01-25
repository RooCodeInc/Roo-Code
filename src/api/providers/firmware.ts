import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { openAiModelInfoSaneDefaults, type ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { getModelParams } from "../transform/model-params"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { RouterProvider } from "./router-provider"
import { getModels } from "./fetchers/modelCache"

const FIRMWARE_BASE_URL = "https://app.firmware.ai/api/v1"
const FIRMWARE_DEFAULT_MODEL_ID = "anthropic/claude-sonnet-4-5-20250929"

export class FirmwareHandler extends RouterProvider implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			options,
			name: "firmware",
			baseURL: FIRMWARE_BASE_URL,
			apiKey: options.firmwareApiKey || "not-provided",
			modelId: options.firmwareModelId,
			defaultModelId: FIRMWARE_DEFAULT_MODEL_ID,
			defaultModelInfo: openAiModelInfoSaneDefaults,
		})
	}

	public override async fetchModel() {
		this.models = await getModels({ provider: this.name, apiKey: this.client.apiKey, baseUrl: this.client.baseURL })
		return this.getModel()
	}

	override getModel() {
		const id = this.options.firmwareModelId ?? FIRMWARE_DEFAULT_MODEL_ID
		const info = this.models[id] ?? openAiModelInfoSaneDefaults

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
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.fetchModel()
		const { id: modelId, info, reasoningEffort: reasoning_effort } = this.getModel()

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
			reasoning_effort,
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? false,
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

			if (delta?.tool_calls) {
				for (const toolCall of delta.tool_calls) {
					yield {
						type: "tool_call_partial",
						index: toolCall.index,
						id: toolCall.id,
						name: toolCall.function?.name,
						arguments: toolCall.function?.arguments,
					}
				}
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, info)
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		await this.fetchModel()
		const { id: modelId, info } = this.getModel()

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
			model: modelId,
			messages: [{ role: "user", content: prompt }],
		}

		if (this.supportsTemperature(modelId)) {
			requestOptions.temperature = this.options.modelTemperature ?? 0
		}

		if (this.options.includeMaxTokens === true && info.maxTokens) {
			;(requestOptions as any).max_completion_tokens = this.options.modelMaxTokens || info.maxTokens
		}

		const resp = await this.client.chat.completions.create(requestOptions)
		return resp.choices[0]?.message?.content || ""
	}

	protected processUsageMetrics(usage: any, modelInfo?: ModelInfo): ApiStreamUsageChunk {
		const inputTokens = usage?.prompt_tokens || 0
		const outputTokens = usage?.completion_tokens || 0
		const cacheWriteTokens = usage?.prompt_tokens_details?.cache_write_tokens || 0
		const cacheReadTokens = usage?.prompt_tokens_details?.cached_tokens || 0

		const { totalCost } = modelInfo
			? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
			: { totalCost: 0 }

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens: cacheWriteTokens || undefined,
			cacheReadTokens: cacheReadTokens || undefined,
			totalCost,
		}
	}
}
