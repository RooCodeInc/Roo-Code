import { Anthropic } from "@anthropic-ai/sdk"
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/streaming"
import { CacheControlEphemeral } from "@anthropic-ai/sdk/resources"
import { AzureOpenAI } from "openai"
import type OpenAI from "openai"

import {
	type ModelInfo,
	type AzureModelId,
	azureDefaultModelId,
	azureModels,
	AZURE_1M_CONTEXT_MODEL_IDS,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { XmlMatcher } from "../../utils/xml-matcher"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { handleOpenAIError } from "./utils/openai-error-handler"

export class AzureHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private claudeClient?: any // AnthropicFoundry - will be dynamically imported
	private openaiClient?: AzureOpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Initialize OpenAI client for GPT models
		const baseURL = this.options.azureBaseUrl || "https://your-endpoint.cognitiveservices.azure.com/"
		const apiKey = this.options.azureApiKey || this.options.apiKey || "not-provided"
		const apiVersion = this.options.azureApiVersion || "2024-12-01-preview"

		this.openaiClient = new AzureOpenAI({
			baseURL,
			apiKey,
			apiVersion,
			defaultHeaders: DEFAULT_HEADERS,
		})
	}

	private async initClaudeClient() {
		if (this.claudeClient) return

		// Dynamically import AnthropicFoundry only when needed
		try {
			const { default: AnthropicFoundry } = await import("@anthropic-ai/foundry-sdk")
			const baseURL = this.options.azureBaseUrl || "https://your-endpoint.services.ai.azure.com/anthropic/"
			const apiKey = this.options.azureApiKey || this.options.apiKey || "not-provided"

			this.claudeClient = new AnthropicFoundry({
				apiKey,
				baseURL,
			})
		} catch (error) {
			throw new Error("Failed to initialize Azure Claude client: " + (error as Error).message)
		}
	}

	private isClaudeModel(modelId: string): boolean {
		return modelId.includes("claude")
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId } = this.getModel()

		if (this.isClaudeModel(modelId)) {
			yield* this.createClaudeMessage(systemPrompt, messages, metadata)
		} else {
			yield* this.createOpenAIMessage(systemPrompt, messages, metadata)
		}
	}

	private async *createClaudeMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.initClaudeClient()

		const { id: modelId, maxTokens, temperature } = this.getModel()
		const deploymentName = this.options.azureDeploymentName || modelId
		const cacheControl: CacheControlEphemeral = { type: "ephemeral" }

		// Prepare beta flags array
		const betas: string[] = []

		// Add 1M context beta flag if enabled for Claude Sonnet 4.5
		if (AZURE_1M_CONTEXT_MODEL_IDS.includes(modelId as any) && this.options.azureBeta1MContext) {
			betas.push("context-1m-2025-08-07")
		}

		// Add prompt caching beta
		betas.push("prompt-caching-2024-07-31")

		// Apply prompt caching to system and last two user messages
		const userMsgIndices = messages.reduce(
			(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[] as number[],
		)

		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

		const stream: AnthropicStream<any> = await this.claudeClient.messages.create(
			{
				model: deploymentName,
				max_tokens: maxTokens ?? 64_000,
				temperature,
				system: [{ text: systemPrompt, type: "text", cache_control: cacheControl }],
				messages: messages.map((message, index) => {
					if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
						return {
							...message,
							content:
								typeof message.content === "string"
									? [{ type: "text", text: message.content, cache_control: cacheControl }]
									: message.content.map((content, contentIndex) =>
											contentIndex === message.content.length - 1
												? { ...content, cache_control: cacheControl }
												: content,
										),
						}
					}
					return message
				}),
				stream: true,
			},
			{
				headers: {
					"anthropic-beta": betas.join(","),
				},
			},
		)

		let inputTokens = 0
		let outputTokens = 0
		let cacheWriteTokens = 0
		let cacheReadTokens = 0

		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start": {
					const {
						input_tokens = 0,
						output_tokens = 0,
						cache_creation_input_tokens,
						cache_read_input_tokens,
					} = chunk.message.usage

					yield {
						type: "usage",
						inputTokens: input_tokens,
						outputTokens: output_tokens,
						cacheWriteTokens: cache_creation_input_tokens || undefined,
						cacheReadTokens: cache_read_input_tokens || undefined,
					}

					inputTokens += input_tokens
					outputTokens += output_tokens
					cacheWriteTokens += cache_creation_input_tokens || 0
					cacheReadTokens += cache_read_input_tokens || 0

					break
				}
				case "message_delta":
					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage.output_tokens || 0,
					}
					break
				case "content_block_start":
					switch (chunk.content_block.type) {
						case "thinking":
							if (chunk.index > 0) {
								yield { type: "reasoning", text: "\n" }
							}
							yield { type: "reasoning", text: chunk.content_block.thinking }
							break
						case "text":
							if (chunk.index > 0) {
								yield { type: "text", text: "\n" }
							}
							yield { type: "text", text: chunk.content_block.text }
							break
					}
					break
				case "content_block_delta":
					switch (chunk.delta.type) {
						case "thinking_delta":
							yield { type: "reasoning", text: chunk.delta.thinking }
							break
						case "text_delta":
							yield { type: "text", text: chunk.delta.text }
							break
					}
					break
			}
		}
	}

	private async *createOpenAIMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		if (!this.openaiClient) {
			throw new Error("Azure OpenAI client not initialized")
		}

		const { id: modelId, info: modelInfo, reasoning } = this.getModel()
		const deploymentName = this.options.azureDeploymentName || modelId
		const temperature = this.options.modelTemperature ?? (modelInfo.supportsTemperature ? 0 : undefined)

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: deploymentName,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true as const,
			stream_options: { include_usage: true },
			...(reasoning && reasoning),
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
		}

		// Add max_completion_tokens if needed
		if (this.options.includeMaxTokens === true) {
			requestOptions.max_completion_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}

		let stream
		try {
			stream = await this.openaiClient.chat.completions.create(requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, "Azure OpenAI")
		}

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
				// Azure OpenAI may include cache usage properties
				const usage = chunk.usage as any
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
					cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
					cacheReadTokens: usage.cache_read_input_tokens || undefined,
				}
			}
		}

		for (const processedChunk of matcher.final()) {
			yield processedChunk
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		const id = modelId && modelId in azureModels ? (modelId as AzureModelId) : azureDefaultModelId
		let info: ModelInfo = azureModels[id]

		// Handle Claude and GPT models separately to maintain type safety
		if (this.isClaudeModel(id)) {
			// If 1M context beta is enabled for Claude Sonnet 4.5, update the model info
			if (AZURE_1M_CONTEXT_MODEL_IDS.includes(id as any) && this.options.azureBeta1MContext) {
				// Use the tier pricing for 1M context
				const tier = info.tiers?.[0]
				if (tier) {
					info = {
						...info,
						contextWindow: tier.contextWindow,
						inputPrice: tier.inputPrice,
						outputPrice: tier.outputPrice,
						cacheWritesPrice: tier.cacheWritesPrice,
						cacheReadsPrice: tier.cacheReadsPrice,
					}
				}
			}

			const params = getModelParams({
				format: "anthropic",
				modelId: id,
				model: info,
				settings: this.options,
			})
			return { id, info, ...params }
		} else {
			const params = getModelParams({
				format: "openai",
				modelId: id,
				model: info,
				settings: this.options,
			})
			return { id, info, ...params }
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId } = this.getModel()

		if (this.isClaudeModel(modelId)) {
			await this.initClaudeClient()
			const deploymentName = this.options.azureDeploymentName || modelId

			const message = await this.claudeClient.messages.create({
				model: deploymentName,
				max_tokens: 8192,
				messages: [{ role: "user", content: prompt }],
				stream: false,
			})

			const content = message.content.find(({ type }: any) => type === "text")
			return content?.type === "text" ? content.text : ""
		} else {
			if (!this.openaiClient) {
				throw new Error("Azure OpenAI client not initialized")
			}

			const deploymentName = this.options.azureDeploymentName || modelId

			const response = await this.openaiClient.chat.completions.create({
				model: deploymentName,
				messages: [{ role: "user", content: prompt }],
			})

			return response.choices?.[0]?.message.content || ""
		}
	}
}
