import { Anthropic } from "@anthropic-ai/sdk"
import { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream"
import {
	CacheControlEphemeral,
	RedactedThinkingBlock,
	SignatureDelta,
	ThinkingBlock,
} from "@anthropic-ai/sdk/resources"
import OpenAI from "openai"

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
import { convertOpenAIToolsToAnthropic } from "../../core/prompts/tools/native-tools/converters"

export class AnthropicHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private client: Anthropic
	private lastThoughtSignature?: string
	private currentStream?: MessageStream

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
		// Reset signature tracking and stream reference at start of each message
		this.lastThoughtSignature = undefined
		this.currentStream = undefined

		let stream: MessageStream
		const cacheControl: CacheControlEphemeral = { type: "ephemeral" }
		let {
			id: modelId,
			info: modelInfo,
			betas = ["fine-grained-tool-streaming-2025-05-14"],
			maxTokens,
			temperature,
			reasoning: thinking,
		} = this.getModel()

		// Determine effective max_tokens
		// Keep the user's requested output budget intact unless the provider cap would be exceeded.
		const requestedMaxTokens = maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS
		const providerMaxTokens = modelInfo?.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS
		let effectiveMaxTokens = Math.min(requestedMaxTokens, providerMaxTokens)
		if (thinking && typeof thinking === "object" && "budget_tokens" in thinking) {
			const budgetTokens = Math.max(0, thinking.budget_tokens)
			// Anthropic enforces (max_tokens + budget_tokens) <= provider cap; shrink only when necessary.
			const maxTokensWithinProviderLimit = Math.max(1, providerMaxTokens - budgetTokens)
			effectiveMaxTokens = Math.min(requestedMaxTokens, maxTokensWithinProviderLimit)
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

		// Prepare native tool parameters if tools are provided and protocol is not XML
		// Also exclude tools when tool_choice is "none" since that means "don't use tools"
		const shouldIncludeNativeTools =
			metadata?.tools &&
			metadata.tools.length > 0 &&
			metadata?.toolProtocol !== "xml" &&
			metadata?.tool_choice !== "none"

		const nativeToolParams = shouldIncludeNativeTools
			? {
					tools: convertOpenAIToolsToAnthropic(metadata.tools!),
					tool_choice: this.convertOpenAIToolChoice(metadata.tool_choice, metadata.parallelToolCalls),
				}
			: {}

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

			// Use MessageStream for better error handling, abort support, and signature extraction
			stream = this.client.messages.stream(
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
					...nativeToolParams,
				},
				betas.length > 0 ? { headers: { "anthropic-beta": betas.join(",") } } : undefined,
			)
		} else {
			// No prompt caching - simpler request
			// Use MessageStream for better error handling, abort support, and signature extraction
			stream = this.client.messages.stream(
				{
					model: modelId,
					max_tokens: effectiveMaxTokens,
					// Temperature cannot be used with extended thinking (must be omitted or set to 1)
					...(thinking ? {} : { temperature }),
					// Only include thinking if explicitly enabled (for custom models that support it)
					...(thinking ? { thinking } : {}),
					system: [{ text: systemPrompt, type: "text" }],
					messages: sanitizedMessages,
					...nativeToolParams,
				},
				betas.length > 0 ? { headers: { "anthropic-beta": betas.join(",") } } : undefined,
			)
		}

		// Store stream reference for potential abort
		this.currentStream = stream

		let inputTokens = 0
		let outputTokens = 0
		let cacheWriteTokens = 0
		let cacheReadTokens = 0

		try {
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
							case "redacted_thinking":
								// Redacted thinking blocks contain encrypted content that cannot be displayed
								// The 'data' field contains the redacted content which is not human-readable
								// We emit a placeholder to indicate thinking occurred but was redacted
								if (chunk.index > 0) {
									yield { type: "reasoning", text: "\n" }
								}
								yield { type: "reasoning", text: "[Thinking redacted]" }
								break
							case "text":
								// We may receive multiple text blocks, in which
								// case just insert a line break between them.
								if (chunk.index > 0) {
									yield { type: "text", text: "\n" }
								}

								yield { type: "text", text: chunk.content_block.text }
								break
							case "tool_use": {
								// Emit initial tool call partial with id and name
								yield {
									type: "tool_call_partial",
									index: chunk.index,
									id: chunk.content_block.id,
									name: chunk.content_block.name,
									arguments: undefined,
								}
								break
							}
						}
						break
					case "content_block_delta":
						switch (chunk.delta.type) {
							case "thinking_delta":
								yield { type: "reasoning", text: chunk.delta.thinking }
								break
							case "signature_delta":
								// Capture the signature for multi-turn extended thinking
								// Using proper SDK type for SignatureDelta
								this.lastThoughtSignature = (chunk.delta as SignatureDelta).signature
								break
							case "text_delta":
								yield { type: "text", text: chunk.delta.text }
								break
							case "input_json_delta": {
								// Emit tool call partial chunks as arguments stream in
								yield {
									type: "tool_call_partial",
									index: chunk.index,
									id: undefined,
									name: undefined,
									arguments: chunk.delta.partial_json,
								}
								break
							}
						}

						break
					case "content_block_stop":
						// Block complete - no action needed for now.
						// NativeToolCallParser handles tool call completion
						break
				}
			}

			// After streaming completes, use finalMessage() to reliably extract signature
			// from ThinkingBlock or RedactedThinkingBlock for multi-turn extended thinking conversations
			try {
				const finalMessage = await stream.finalMessage()
				// Check for regular thinking block first
				const thinkingBlock = finalMessage.content.find(
					(block): block is ThinkingBlock => block.type === "thinking",
				)
				if (thinkingBlock?.signature) {
					this.lastThoughtSignature = thinkingBlock.signature
				} else {
					// Check for redacted thinking block (also has signature for multi-turn)
					const redactedBlock = finalMessage.content.find(
						(block): block is RedactedThinkingBlock => block.type === "redacted_thinking",
					)
					// Note: RedactedThinkingBlock has 'data' field, not 'signature'
					// The signature for multi-turn is captured during streaming via signature_delta
				}
			} catch {
				// finalMessage may fail if stream was interrupted, signature captured during streaming is still valid
			}
		} catch (error) {
			// Re-throw the error after cleanup
			// The caller can handle specific error types (rate limits, context length, etc.)
			this.currentStream = undefined
			throw error
		} finally {
			// Clear stream reference after completion
			this.currentStream = undefined
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
		// - budget_tokens maximum is 32000 (allows headroom for custom models)
		// - budget_tokens must be less than max_tokens
		const THINKING_BUDGET_MIN = 1024
		const THINKING_BUDGET_MAX = 32000
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

	/**
	 * Converts OpenAI tool_choice to Anthropic ToolChoice format
	 * @param toolChoice - OpenAI tool_choice parameter
	 * @param parallelToolCalls - When true, allows parallel tool calls. When false (default), disables parallel tool calls.
	 */
	private convertOpenAIToolChoice(
		toolChoice: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"],
		parallelToolCalls?: boolean,
	): Anthropic.Messages.MessageCreateParams["tool_choice"] | undefined {
		// Anthropic allows parallel tool calls by default. When parallelToolCalls is false or undefined,
		// we disable parallel tool use to ensure one tool call at a time.
		const disableParallelToolUse = !parallelToolCalls

		if (!toolChoice) {
			// Default to auto with parallel tool use control
			return { type: "auto", disable_parallel_tool_use: disableParallelToolUse }
		}

		if (typeof toolChoice === "string") {
			switch (toolChoice) {
				case "none":
					return undefined // Anthropic doesn't have "none", just omit tools
				case "auto":
					return { type: "auto", disable_parallel_tool_use: disableParallelToolUse }
				case "required":
					return { type: "any", disable_parallel_tool_use: disableParallelToolUse }
				default:
					return { type: "auto", disable_parallel_tool_use: disableParallelToolUse }
			}
		}

		// Handle object form { type: "function", function: { name: string } }
		if (typeof toolChoice === "object" && "function" in toolChoice) {
			return {
				type: "tool",
				name: toolChoice.function.name,
				disable_parallel_tool_use: disableParallelToolUse,
			}
		}

		return { type: "auto", disable_parallel_tool_use: disableParallelToolUse }
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
	 * Aborts the current streaming request if one is in progress.
	 * This cleanly cancels the underlying HTTP request and any pending operations.
	 */
	public abort(): void {
		if (this.currentStream) {
			this.currentStream.abort()
			this.currentStream = undefined
		}
	}

	/**
	 * Returns whether a stream is currently in progress.
	 */
	public isStreaming(): boolean {
		return this.currentStream !== undefined
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
