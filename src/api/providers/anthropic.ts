import { Anthropic } from "@anthropic-ai/sdk"
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/streaming"
import { CacheControlEphemeral } from "@anthropic-ai/sdk/resources"

import {
	type ModelInfo,
	type AnthropicModelId,
	anthropicDefaultModelId,
	anthropicModels,
	ANTHROPIC_DEFAULT_MAX_TOKENS,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { calculateApiCostAnthropic, applyBatchApiDiscount } from "../../shared/cost"

// Batch API polling configuration
const BATCH_POLL_INTERVAL_MS = 5000 // Poll every 5 seconds
const BATCH_MAX_POLL_TIME_MS = 600000 // Max 10 minutes polling

export class AnthropicHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private client: Anthropic

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const apiKeyFieldName =
			this.options.anthropicBaseUrl && this.options.anthropicUseAuthToken ? "authToken" : "apiKey"

		this.client = new Anthropic({
			baseURL: this.options.anthropicBaseUrl || undefined,
			[apiKeyFieldName]: this.options.apiKey,
		})
	}

	/**
	 * Models that support prompt caching
	 */
	private supportsPromptCaching(modelId: string): boolean {
		return [
			"claude-sonnet-4-5",
			"claude-sonnet-4-20250514",
			"claude-opus-4-1-20250805",
			"claude-opus-4-20250514",
			"claude-3-7-sonnet-20250219",
			"claude-3-5-sonnet-20241022",
			"claude-3-5-haiku-20241022",
			"claude-3-opus-20240229",
			"claude-3-haiku-20240307",
		].includes(modelId)
	}

	/**
	 * Applies cache control to messages for prompt caching
	 */
	private applyCacheBreakpoints(
		messages: Anthropic.Messages.MessageParam[],
		cacheControl: CacheControlEphemeral,
	): Anthropic.Messages.MessageParam[] {
		const userMsgIndices = messages.reduce(
			(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[] as number[],
		)

		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

		return messages.map((message, index) => {
			if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
				return {
					...message,
					content:
						typeof message.content === "string"
							? [{ type: "text" as const, text: message.content, cache_control: cacheControl }]
							: message.content.map((content, contentIndex) =>
									contentIndex === message.content.length - 1
										? { ...content, cache_control: cacheControl }
										: content,
								),
				}
			}
			return message
		})
	}

	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Use batch API if enabled (50% cost savings, async processing)
		if (this.options.anthropicUseBatchApi) {
			yield* this.createBatchMessage(systemPrompt, messages, metadata)
			return
		}

		const cacheControl: CacheControlEphemeral = { type: "ephemeral" }
		let { id: modelId, betas = [], maxTokens, temperature, reasoning: thinking } = this.getModel()

		// Add 1M context beta flag if enabled for Claude Sonnet 4 and 4.5
		if (
			(modelId === "claude-sonnet-4-20250514" || modelId === "claude-sonnet-4-5") &&
			this.options.anthropicBeta1MContext
		) {
			betas.push("context-1m-2025-08-07")
		}

		let stream: AnthropicStream<Anthropic.Messages.RawMessageStreamEvent>

		if (this.supportsPromptCaching(modelId)) {
			/**
			 * The latest message will be the new user message, one before
			 * will be the assistant message from a previous request, and
			 * the user message before that will be a previously cached user
			 * message. So we need to mark the latest user message as
			 * ephemeral to cache it for the next request, and mark the
			 * second to last user message as ephemeral to let the server
			 * know the last message to retrieve from the cache for the
			 * current request.
			 */
			betas.push("prompt-caching-2024-07-31")

			stream = await this.client.messages.create(
				{
					model: modelId,
					max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
					temperature,
					thinking,
					system: [{ text: systemPrompt, type: "text", cache_control: cacheControl }],
					messages: this.applyCacheBreakpoints(messages, cacheControl),
					stream: true,
				},
				{ headers: { "anthropic-beta": betas.join(",") } },
			)
		} else {
			stream = (await this.client.messages.create({
				model: modelId,
				max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
				temperature,
				system: [{ text: systemPrompt, type: "text" }],
				messages,
				stream: true,
			})) as any
		}

		let inputTokens = 0
		let outputTokens = 0
		let cacheWriteTokens = 0
		let cacheReadTokens = 0

		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start": {
					// Tells us cache reads/writes/input/output.
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
					// Tells us stop_reason, stop_sequence, and output tokens
					// along the way and at the end of the message.
					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage.output_tokens || 0,
					}

					break
				case "message_stop":
					// No usage data, just an indicator that the message is done.
					break
				case "content_block_start":
					switch (chunk.content_block.type) {
						case "thinking":
							// We may receive multiple text blocks, in which
							// case just insert a line break between them.
							if (chunk.index > 0) {
								yield { type: "reasoning", text: "\n" }
							}

							yield { type: "reasoning", text: chunk.content_block.thinking }
							break
						case "text":
							// We may receive multiple text blocks, in which
							// case just insert a line break between them.
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
				case "content_block_stop":
					break
			}
		}

		if (inputTokens > 0 || outputTokens > 0 || cacheWriteTokens > 0 || cacheReadTokens > 0) {
			yield {
				type: "usage",
				inputTokens: 0,
				outputTokens: 0,
				totalCost: calculateApiCostAnthropic(
					this.getModel().info,
					inputTokens,
					outputTokens,
					cacheWriteTokens,
					cacheReadTokens,
				),
			}
		}
	}

	getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in anthropicModels ? (modelId as AnthropicModelId) : anthropicDefaultModelId
		let info: ModelInfo = anthropicModels[id]

		// If 1M context beta is enabled for Claude Sonnet 4 or 4.5, update the model info
		if ((id === "claude-sonnet-4-20250514" || id === "claude-sonnet-4-5") && this.options.anthropicBeta1MContext) {
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

		// Apply 50% discount for Batch API (applies after 1M context pricing if both enabled)
		if (this.options.anthropicUseBatchApi) {
			info = applyBatchApiDiscount(info)
		}

		const params = getModelParams({
			format: "anthropic",
			modelId: id,
			model: info,
			settings: this.options,
		})

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Anthropic's API does not have this
		// suffix.
		return {
			id: id === "claude-3-7-sonnet-20250219:thinking" ? "claude-3-7-sonnet-20250219" : id,
			info,
			betas: id === "claude-3-7-sonnet-20250219:thinking" ? ["output-128k-2025-02-19"] : undefined,
			...params,
		}
	}

	async completePrompt(prompt: string) {
		let { id: model, temperature } = this.getModel()

		const message = await this.client.messages.create({
			model,
			max_tokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
			thinking: undefined,
			temperature,
			messages: [{ role: "user", content: prompt }],
			stream: false,
		})

		const content = message.content.find(({ type }) => type === "text")
		return content?.type === "text" ? content.text : ""
	}

	/**
	 * Creates a message using the Batch API for 50% cost savings.
	 * This method handles the async batch job lifecycle: create, poll, and retrieve results.
	 */
	private async *createBatchMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const cacheControl: CacheControlEphemeral = { type: "ephemeral" }
		let { id: modelId, betas = [], maxTokens, temperature, reasoning: thinking } = this.getModel()

		// Add 1M context beta flag if enabled for Claude Sonnet 4 and 4.5
		if (
			(modelId === "claude-sonnet-4-20250514" || modelId === "claude-sonnet-4-5") &&
			this.options.anthropicBeta1MContext
		) {
			betas.push("context-1m-2025-08-07")
		}

		// Add prompt caching beta if model supports it
		if (this.supportsPromptCaching(modelId)) {
			betas.push("prompt-caching-2024-07-31")
		}

		// Notify user about batch processing
		yield {
			type: "text",
			text: "⏳ **Using Batch API (50% cost savings)** - Processing request asynchronously, this may take a moment...\n\n",
		}

		// Prepare request with cache breakpoints if supported
		const processedMessages = this.supportsPromptCaching(modelId)
			? this.applyCacheBreakpoints(messages, cacheControl)
			: messages

		const batchRequest: Anthropic.Messages.MessageCreateParamsNonStreaming = {
			model: modelId,
			max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
			temperature,
			thinking,
			system: this.supportsPromptCaching(modelId)
				? [{ text: systemPrompt, type: "text", cache_control: cacheControl }]
				: [{ text: systemPrompt, type: "text" }],
			messages: processedMessages,
		}

		// Create batch job with beta headers if needed
		const batchOptions = betas.length > 0 ? { headers: { "anthropic-beta": betas.join(",") } } : undefined
		const batch = await this.client.messages.batches.create(
			{
				requests: [
					{
						// Using Date.now() is sufficient since we only send one request per batch
						// If we support multiple requests per batch in the future, consider using crypto.randomUUID()
						custom_id: `req_${Date.now()}`,
						params: batchRequest,
					},
				],
			},
			batchOptions,
		)

		// Poll for batch completion (silently)
		const startTime = Date.now()
		let completedBatch: Anthropic.Beta.Messages.Batches.BetaMessageBatch | null = null

		while (Date.now() - startTime < BATCH_MAX_POLL_TIME_MS) {
			const status = await this.client.messages.batches.retrieve(batch.id)

			if (status.processing_status === "ended") {
				completedBatch = status
				break
			}

			// Only fail on truly failed states; continue polling for all valid transitional states
			// Note: SDK types may not include all possible states, so we check the actual string value
			const statusStr = status.processing_status as string
			if (statusStr === "errored" || statusStr === "expired" || statusStr === "canceled") {
				throw new Error(`Batch processing failed with status: ${status.processing_status}`)
			}

			// Wait before next poll
			await new Promise((resolve) => setTimeout(resolve, BATCH_POLL_INTERVAL_MS))
		}

		if (!completedBatch) {
			throw new Error("Batch processing timeout exceeded")
		}

		// Retrieve results
		const results = await this.client.messages.batches.results(batch.id)

		// Process results
		for await (const result of results) {
			if (result.result.type === "succeeded") {
				const message = result.result.message

				// Yield content blocks
				for (const content of message.content) {
					if (content.type === "text") {
						yield { type: "text", text: content.text }
					} else if (content.type === "thinking") {
						yield { type: "reasoning", text: content.thinking }
					}
				}

				// Yield usage information
				const usage = message.usage
				yield {
					type: "usage",
					inputTokens: usage.input_tokens || 0,
					outputTokens: usage.output_tokens || 0,
					cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
					cacheReadTokens: usage.cache_read_input_tokens || undefined,
				}

				// Calculate and yield cost
				yield {
					type: "usage",
					inputTokens: 0,
					outputTokens: 0,
					totalCost: calculateApiCostAnthropic(
						this.getModel().info,
						usage.input_tokens || 0,
						usage.output_tokens || 0,
						usage.cache_creation_input_tokens || 0,
						usage.cache_read_input_tokens || 0,
					),
				}
			} else if (result.result.type === "errored") {
				const error = result.result.error
				// ErrorResponse only has 'type' field in SDK types, but may have 'message' at runtime
				const errorDetails = JSON.stringify(error)
				throw new Error(`Batch request failed: ${error.type} - ${errorDetails}`)
			}
		}
	}

	/**
	 * Counts tokens for the given content using Anthropic's API
	 *
	 * @param content The content blocks to count tokens for
	 * @returns A promise resolving to the token count
	 */
	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			// Use the current model
			const { id: model } = this.getModel()

			const response = await this.client.messages.countTokens({
				model,
				messages: [{ role: "user", content: content }],
			})

			return response.input_tokens
		} catch (error) {
			// Log error but fallback to tiktoken estimation
			console.warn("Anthropic token counting failed, using fallback", error)

			// Use the base provider's implementation as fallback
			return super.countTokens(content)
		}
	}
}
