import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	heliconeDefaultModelId,
	heliconeDefaultModelInfo,
	heliconeModels,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStreamChunk } from "../transform/stream"
import { convertToR1Format } from "../transform/r1-format"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler } from "../index"
import { handleOpenAIError } from "./utils/openai-error-handler"

export class HeliconeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	protected models: ModelRecord = {}
	private readonly providerName = "Helicone"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.heliconeBaseUrl || "https://ai-gateway.helicone.ai/v1"
		const apiKey = this.options.heliconeApiKey ?? "not-provided"

		this.client = new OpenAI({ baseURL, apiKey, defaultHeaders: DEFAULT_HEADERS })
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): AsyncGenerator<ApiStreamChunk> {
		const model = await this.fetchModel()

		let { id: modelId, maxTokens, temperature } = model

		// Convert Anthropic messages to OpenAI format.
		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// DeepSeek and similar reasoning models recommend using user instead of system role.
		if (this.isDeepSeekR1(modelId) || this.isPerplexityReasoning(modelId)) {
			openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
			// DeepSeek recommended default temperature
			temperature = this.options.modelTemperature ?? DEEP_SEEK_DEFAULT_TEMPERATURE
		}

		// TODO [HELICONE]: add automatic gemini/anthropic cache breakpoints

		const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
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

		let lastUsage: any | undefined = undefined

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (
				"reasoning" in (delta || {}) &&
				(delta as any).reasoning &&
				typeof (delta as any).reasoning === "string"
			) {
				yield { type: "reasoning", text: (delta as any).reasoning as string }
			}

			if (delta?.content) {
				yield { type: "text", text: delta.content }
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield {
				type: "usage",
				inputTokens: lastUsage.prompt_tokens || 0,
				outputTokens: lastUsage.completion_tokens || 0,
				cacheReadTokens: lastUsage.prompt_tokens_details?.cached_tokens,
				reasoningTokens: lastUsage.completion_tokens_details?.reasoning_tokens,
			}
		}
	}

	public async fetchModel() {
		this.models = heliconeModels as unknown as ModelRecord
		return this.getModel()
	}

	override getModel() {
		const id = this.options.apiModelId ?? heliconeDefaultModelId
		const info = this.models[id] ?? heliconeDefaultModelInfo

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature:
				this.isDeepSeekR1(id) || this.isPerplexityReasoning(id) ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0,
		})

		// Apply a small topP tweak for DeepSeek-style reasoning models
		const topP = this.isDeepSeekR1(id) || this.isPerplexityReasoning(id) ? 0.95 : undefined
		return { id, info, topP, ...params }
	}

	async completePrompt(prompt: string) {
		let { id: modelId, maxTokens, temperature } = await this.fetchModel()

		const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
			model: modelId,
			...(maxTokens && maxTokens > 0 && { max_tokens: maxTokens }),
			temperature,
			messages: [{ role: "user", content: prompt }],
			stream: false,
		}

		let response
		try {
			response = await this.client.chat.completions.create(completionParams)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}

		if ("error" in (response as any)) {
			const error = (response as any).error as { message?: string; code?: number }
			throw new Error(`Helicone API Error ${error?.code}: ${error?.message}`)
		}

		const completion = response as OpenAI.Chat.ChatCompletion
		return completion.choices[0]?.message?.content || ""
	}

	private isDeepSeekR1(modelId: string): boolean {
		return modelId.includes("deepseek-r1")
	}

	private isPerplexityReasoning(modelId: string): boolean {
		return modelId.includes("sonar-reasoning")
	}
}
