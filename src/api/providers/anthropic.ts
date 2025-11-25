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
import { filterNonAnthropicBlocks } from "../transform/anthropic-filter"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { calculateApiCostAnthropic } from "../../shared/cost"

export class AnthropicHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private client: Anthropic
	private lastThoughtSignature?: string

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

	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Reset signature tracking at start of each message
		this.lastThoughtSignature = undefined
		let stream: AnthropicStream<Anthropic.Messages.RawMessageStreamEvent>
		const cacheControl: CacheControlEphemeral = { type: "ephemeral" }
		let { id: modelId, info: modelInfo, betas = [], maxTokens, temperature, reasoning: thinking } = this.getModel()

		// Determine effective max_tokens
		// When thinking is enabled, max_tokens MUST be greater than thinking.budget_tokens
		// Use 64000 - budget_tokens as the effective max tokens for output
		let effectiveMaxTokens = maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS
		if (thinking && typeof thinking === "object" && "budget_tokens" in thinking) {
			const budgetTokens = thinking.budget_tokens
			effectiveMaxTokens = 64000 - budgetTokens
		}

		// Check if prompt caching is supported (use model info, which can be overridden for custom models)
		const supportsPromptCache = modelInfo.supportsPromptCache

		// Filter out non-Anthropic blocks (reasoning, thoughtSignature, etc.) before sending to the API
		const sanitizedMessages = filterNonAnthropicBlocks(messages)

		// Add 1M context beta flag if enabled for Claude Sonnet 4 and 4.5
		// Only apply if not using a custom model name (custom models handle their own betas)
		if (
			!this.options.anthropicCustomModelName &&
			(modelId === "claude-sonnet-4-20250514" || modelId === "claude-sonnet-4-5") &&
			this.options.anthropicBeta1MContext
		) {
			betas.push("context-1m-2025-08-07")
		}

		if (supportsPromptCache) {
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
			const userMsgIndices = sanitizedMessages.reduce(
				(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
				[] as number[],
			)

			const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
			const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

			// Add prompt caching beta header
			betas.push("prompt-caching-2024-07-31")

			stream = await this.client.messages.create(
				{
					model: modelId,
					max_tokens: effectiveMaxTokens,
					// Temperature cannot be used with extended thinking (must be omitted or set to 1)
					...(thinking ? {} : { temperature }),
					// Only include thinking if it's defined with proper structure
					...(thinking ? { thinking } : {}),
					// Setting cache breakpoint for system prompt so new tasks can reuse it.
					system: [{ text: systemPrompt, type: "text", cache_control: cacheControl }],
					messages: sanitizedMessages.map((message, index) => {
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
				betas.length > 0 ? { headers: { "anthropic-beta": betas.join(",") } } : undefined,
			)
		} else {
			// No prompt caching - simpler request
			stream = (await this.client.messages.create({
				model: modelId,
				max_tokens: effectiveMaxTokens,
				// Temperature cannot be used with extended thinking (must be omitted or set to 1)
				...(thinking ? {} : { temperature }),
				// Only include thinking if explicitly enabled (for custom models that support it)
				...(thinking ? { thinking } : {}),
				system: [{ text: systemPrompt, type: "text" }],
				messages: sanitizedMessages,
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
						case "signature_delta":
							// Capture the signature for multi-turn extended thinking
							this.lastThoughtSignature = (chunk.delta as any).signature
							break
						case "text_delta":
							yield { type: "text", text: chunk.delta.text }
							break
					}

					break
				case "content_block_stop":
					// Block complete - no action needed for now.
					// Note: Signature for multi-turn thinking would require using stream.finalMessage()
					// after iteration completes, which requires restructuring the streaming approach.
					break
			}
		}

		if (inputTokens > 0 || outputTokens > 0 || cacheWriteTokens > 0 || cacheReadTokens > 0) {
			const { totalCost } = calculateApiCostAnthropic(
				this.getModel().info,
				inputTokens,
				outputTokens,
				cacheWriteTokens,
				cacheReadTokens,
			)

			yield {
				type: "usage",
				inputTokens: 0,
				outputTokens: 0,
				totalCost,
			}
		}
	}

	getModel() {
		const modelId = this.options.apiModelId
		const customModelName = this.options.anthropicCustomModelName
		const customModelInfo = this.options.anthropicCustomModelInfo

		// If a custom model name is provided (for custom base URLs), use it
		// but fall back to default model info for parameters
		let id = modelId && modelId in anthropicModels ? (modelId as AnthropicModelId) : anthropicDefaultModelId

		// Determine base model info:
		// 1. If anthropicCustomModelInfo is provided, use it as the base
		// 2. Otherwise, use the preset model info
		let info: ModelInfo

		if (customModelName && customModelInfo) {
			// Use unified custom model info when provided
			info = { ...customModelInfo }
		} else {
			// Use preset model info
			info = { ...anthropicModels[id] }
		}

		// If using a custom model name, we use that as the actual model ID sent to the API
		// but still use the selected model's info for context limits, pricing, etc.
		const effectiveModelId = customModelName || id

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
		// Enable thinking for:
		// 1. The :thinking model variant
		// 2. Custom models with supportsReasoningBudget in anthropicCustomModelInfo
		const enableThinking =
			id === "claude-3-7-sonnet-20250219:thinking" || (customModelName && info.supportsReasoningBudget)

		let finalModelId = effectiveModelId
		if (id === "claude-3-7-sonnet-20250219:thinking") {
			// Only strip the :thinking suffix if we're not using a custom model name
			finalModelId = customModelName || "claude-3-7-sonnet-20250219"
		}

		// For extended thinking:
		// - budget_tokens minimum is 1024
		// - budget_tokens maximum is 16384
		// - budget_tokens must be less than max_tokens
		const THINKING_BUDGET_MIN = 1024
		const THINKING_BUDGET_MAX = 16384
		const configuredBudget =
			params.reasoning && params.reasoning.type === "enabled"
				? params.reasoning.budget_tokens
				: THINKING_BUDGET_MIN
		const thinkingBudget = Math.min(THINKING_BUDGET_MAX, Math.max(THINKING_BUDGET_MIN, configuredBudget))

		return {
			id: finalModelId,
			info,
			betas: enableThinking ? ["output-128k-2025-02-19"] : undefined,
			...params,
			// Override reasoning if custom thinking is enabled (via anthropicCustomModelInfo)
			// Use budget_tokens (snake_case) as required by Anthropic API
			// Note: max_tokens must be greater than budget_tokens
			...(enableThinking && !params.reasoning
				? { reasoning: { type: "enabled" as const, budget_tokens: thinkingBudget } }
				: {}),
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
	 * Returns the signature from the last thinking block for multi-turn extended thinking.
	 * This signature is required when sending thinking blocks back to the API.
	 */
	public getThoughtSignature(): string | undefined {
		return this.lastThoughtSignature
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
