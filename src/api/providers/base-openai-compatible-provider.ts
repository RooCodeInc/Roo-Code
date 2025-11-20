import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ModelInfo } from "@roo-code/types"

import { type ApiHandlerOptions, getModelMaxOutputTokens } from "../../shared/api"
import { XmlMatcher } from "../../utils/xml-matcher"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import { handleOpenAIError } from "./utils/openai-error-handler"

type BaseOpenAiCompatibleProviderOptions<ModelName extends string> = ApiHandlerOptions & {
	providerName: string
	baseURL: string
	defaultProviderModelId: ModelName
	providerModels: Record<ModelName, ModelInfo>
	defaultTemperature?: number
}

export abstract class BaseOpenAiCompatibleProvider<ModelName extends string>
	extends BaseProvider
	implements SingleCompletionHandler
{
	protected readonly providerName: string
	protected readonly baseURL: string
	protected readonly defaultTemperature: number
	protected readonly defaultProviderModelId: ModelName
	protected readonly providerModels: Record<ModelName, ModelInfo>

	protected readonly options: ApiHandlerOptions

	protected client: OpenAI

	constructor({
		providerName,
		baseURL,
		defaultProviderModelId,
		providerModels,
		defaultTemperature,
		...options
	}: BaseOpenAiCompatibleProviderOptions<ModelName>) {
		super()

		this.providerName = providerName
		this.baseURL = baseURL
		this.defaultProviderModelId = defaultProviderModelId
		this.providerModels = providerModels
		this.defaultTemperature = defaultTemperature ?? 0

		this.options = options

		if (!this.options.apiKey) {
			throw new Error("API key is required")
		}

		this.client = new OpenAI({
			baseURL,
			apiKey: this.options.apiKey,
			defaultHeaders: DEFAULT_HEADERS,
		})
	}

	protected async createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
		retryCount: number = 0,
	): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
		const { id: model, info } = this.getModel()

		// Centralized cap: clamp to 20% of the context window (unless provider-specific exceptions apply)
		const max_tokens =
			getModelMaxOutputTokens({
				modelId: model,
				model: info,
				settings: this.options,
				format: "openai",
			}) ?? undefined

		const temperature = this.options.modelTemperature ?? this.defaultTemperature

		// Convert messages and potentially truncate if we're retrying due to a 400 error
		let convertedMessages = convertToOpenAiMessages(messages)

		// If this is a retry and we have many messages, try truncating older conversation history
		// Keep at least the last 10 messages to maintain context
		if (retryCount > 0 && convertedMessages.length > 10) {
			const truncationRatio = Math.min(0.5 + retryCount * 0.1, 0.8) // Truncate 50%, 60%, 70%, up to 80%
			const messagesToKeep = Math.max(10, Math.floor(convertedMessages.length * (1 - truncationRatio)))
			const truncatedMessages = convertedMessages.slice(-messagesToKeep)

			console.warn(
				`[${this.providerName}] Truncating conversation history due to HTTP 400 error. Keeping last ${messagesToKeep} of ${convertedMessages.length} messages.`,
			)
			convertedMessages = truncatedMessages
		}

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertedMessages],
			stream: true,
			stream_options: { include_usage: true },
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
		}

		try {
			return await this.client.chat.completions.create(params, requestOptions)
		} catch (error: any) {
			// Check if this is a 400 error that might be due to conversation length
			const is400Error =
				error?.status === 400 ||
				error?.response?.status === 400 ||
				(error?.message && error.message.includes("400"))

			// Retry with truncated history if we haven't exceeded max retries
			if (is400Error && retryCount < 3) {
				console.warn(
					`[${this.providerName}] Received HTTP 400 error, retrying with truncated conversation history (attempt ${retryCount + 1}/3)`,
				)
				return this.createStream(systemPrompt, messages, metadata, requestOptions, retryCount + 1)
			}

			throw handleOpenAIError(error, this.providerName)
		}
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

		const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>()

		for await (const chunk of stream) {
			// Check for provider-specific error responses (e.g., MiniMax base_resp)
			const chunkAny = chunk as any
			if (chunkAny.base_resp?.status_code && chunkAny.base_resp.status_code !== 0) {
				throw new Error(
					`${this.providerName} API Error (${chunkAny.base_resp.status_code}): ${chunkAny.base_resp.status_msg || "Unknown error"}`,
				)
			}

			const delta = chunk.choices?.[0]?.delta
			const finishReason = chunk.choices?.[0]?.finish_reason

			if (delta?.content) {
				for (const processedChunk of matcher.update(delta.content)) {
					yield processedChunk
				}
			}

			if (delta && "reasoning_content" in delta) {
				const reasoning_content = (delta.reasoning_content as string | undefined) || ""
				if (reasoning_content?.trim()) {
					yield { type: "reasoning", text: reasoning_content }
				}
			}

			if (delta?.tool_calls) {
				for (const toolCall of delta.tool_calls) {
					const index = toolCall.index
					const existing = toolCallAccumulator.get(index)

					if (existing) {
						if (toolCall.function?.arguments) {
							existing.arguments += toolCall.function.arguments
						}
					} else {
						toolCallAccumulator.set(index, {
							id: toolCall.id || "",
							name: toolCall.function?.name || "",
							arguments: toolCall.function?.arguments || "",
						})
					}
				}
			}

			if (finishReason === "tool_calls") {
				for (const toolCall of toolCallAccumulator.values()) {
					yield {
						type: "tool_call",
						id: toolCall.id,
						name: toolCall.name,
						arguments: toolCall.arguments,
					}
				}
				toolCallAccumulator.clear()
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
	}

	async completePrompt(prompt: string, retryCount: number = 0): Promise<string> {
		const { id: modelId } = this.getModel()

		try {
			const response = await this.client.chat.completions.create({
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			})

			// Check for provider-specific error responses (e.g., MiniMax base_resp)
			const responseAny = response as any
			if (responseAny.base_resp?.status_code && responseAny.base_resp.status_code !== 0) {
				throw new Error(
					`${this.providerName} API Error (${responseAny.base_resp.status_code}): ${responseAny.base_resp.status_msg || "Unknown error"}`,
				)
			}

			return response.choices?.[0]?.message.content || ""
		} catch (error: any) {
			// Check if this is a 400 error that might be due to prompt length
			const is400Error =
				error?.status === 400 ||
				error?.response?.status === 400 ||
				(error?.message && error.message.includes("400"))

			// Retry with truncated prompt if we haven't exceeded max retries
			if (is400Error && retryCount < 3 && prompt.length > 1000) {
				const truncationRatio = Math.min(0.5 + retryCount * 0.1, 0.8)
				const truncatedPrompt = prompt.substring(0, Math.floor(prompt.length * (1 - truncationRatio)))

				console.warn(
					`[${this.providerName}] Received HTTP 400 error in completePrompt, retrying with truncated prompt (attempt ${retryCount + 1}/3)`,
				)
				return this.completePrompt(truncatedPrompt, retryCount + 1)
			}

			throw handleOpenAIError(error, this.providerName)
		}
	}

	override getModel() {
		const id =
			this.options.apiModelId && this.options.apiModelId in this.providerModels
				? (this.options.apiModelId as ModelName)
				: this.defaultProviderModelId

		return { id, info: this.providerModels[id] }
	}
}
