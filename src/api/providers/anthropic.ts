import { Anthropic } from "@anthropic-ai/sdk"
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/streaming"
import { CacheControlEphemeral } from "@anthropic-ai/sdk/resources"
import OpenAI from "openai"

import {
	type ModelInfo,
	type AnthropicModelId,
	anthropicDefaultModelId,
	anthropicModels,
	ANTHROPIC_DEFAULT_MAX_TOKENS,
	ApiProviderError,
} from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { filterNonAnthropicBlocks } from "../transform/anthropic-filter"
import { handleProviderError } from "./utils/error-handler"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { calculateApiCostAnthropic } from "../../shared/cost"
import {
	convertOpenAIToolsToAnthropic,
	convertOpenAIToolChoiceToAnthropic,
} from "../../core/prompts/tools/native-tools/converters"

export class AnthropicHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private client: Anthropic
	private readonly providerName = "Anthropic"

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
		let stream: AnthropicStream<Anthropic.Messages.RawMessageStreamEvent>
		const cacheControl: CacheControlEphemeral = { type: "ephemeral" }
		let {
			id: modelId,
			betas = ["fine-grained-tool-streaming-2025-05-14"],
			maxTokens,
			temperature,
			reasoning: thinking,
		} = this.getModel()

		// Filter out non-Anthropic blocks (reasoning, thoughtSignature, etc.) before sending to the API
		const sanitizedMessages = filterNonAnthropicBlocks(messages)

		// Add 1M context beta flag if enabled for supported models (Claude Sonnet 4/4.5/4.6, Opus 4.6)
		if (
			(modelId === "claude-sonnet-4-20250514" ||
				modelId === "claude-sonnet-4-5" ||
				modelId === "claude-sonnet-4-6" ||
				modelId === "claude-opus-4-6") &&
			this.options.anthropicBeta1MContext
		) {
			betas.push("context-1m-2025-08-07")
		}

		// Add advisor tool beta flag if enabled
		if (this.options.anthropicAdvisorEnabled) {
			betas.push("advisor-tool-2026-03-01")
		}

		let tools = convertOpenAIToolsToAnthropic(metadata?.tools ?? [])

		// Add advisor tool if enabled
		if (this.options.anthropicAdvisorEnabled) {
			const advisorModel = this.options.anthropicAdvisorModel ?? "claude-opus-4-6"
			const maxUses = this.options.anthropicAdvisorMaxUses ?? 3
			const advisorToolDef: { type: string; name: string; model: string; max_uses?: number } = {
				type: "advisor_20260301",
				name: "advisor",
				model: advisorModel,
			}
			if (maxUses >= 1) {
				advisorToolDef.max_uses = maxUses
			}
			tools.push(advisorToolDef as unknown as Anthropic.Tool)
		}

		const nativeToolParams = {
			tools,
			tool_choice: convertOpenAIToolChoiceToAnthropic(metadata?.tool_choice, metadata?.parallelToolCalls),
		}

		switch (modelId) {
			case "claude-sonnet-4-6":
			case "claude-sonnet-4-5":
			case "claude-sonnet-4-20250514":
			case "claude-opus-4-6":
			case "claude-opus-4-5-20251101":
			case "claude-opus-4-1-20250805":
			case "claude-opus-4-20250514":
			case "claude-3-7-sonnet-20250219":
			case "claude-3-5-sonnet-20241022":
			case "claude-3-5-haiku-20241022":
			case "claude-3-opus-20240229":
			case "claude-haiku-4-5-20251001":
			case "claude-3-haiku-20240307": {
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

				try {
					stream = await this.client.messages.create(
						{
							model: modelId,
							max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
							temperature,
							thinking,
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
							...nativeToolParams,
						},
						(() => {
							// prompt caching: https://x.com/alexalbert__/status/1823751995901272068
							// https://github.com/anthropics/anthropic-sdk-typescript?tab=readme-ov-file#default-headers
							// https://github.com/anthropics/anthropic-sdk-typescript/commit/c920b77fc67bd839bfeb6716ceab9d7c9bbe7393

							// Then check for models that support prompt caching
							switch (modelId) {
								case "claude-sonnet-4-6":
								case "claude-sonnet-4-5":
								case "claude-sonnet-4-20250514":
								case "claude-opus-4-6":
								case "claude-opus-4-5-20251101":
								case "claude-opus-4-1-20250805":
								case "claude-opus-4-20250514":
								case "claude-3-7-sonnet-20250219":
								case "claude-3-5-sonnet-20241022":
								case "claude-3-5-haiku-20241022":
								case "claude-3-opus-20240229":
								case "claude-haiku-4-5-20251001":
								case "claude-3-haiku-20240307":
									betas.push("prompt-caching-2024-07-31")
									return { headers: { "anthropic-beta": betas.join(",") } }
								default:
									return undefined
							}
						})(),
					)
				} catch (error) {
					TelemetryService.instance.captureException(
						new ApiProviderError(
							error instanceof Error ? error.message : String(error),
							this.providerName,
							modelId,
							"createMessage",
						),
					)
					throw error
				}
				break
			}
			default: {
				try {
					stream = (await this.client.messages.create({
						model: modelId,
						max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
						temperature,
						system: [{ text: systemPrompt, type: "text" }],
						messages: sanitizedMessages,
						stream: true,
						...nativeToolParams,
					})) as any
				} catch (error) {
					TelemetryService.instance.captureException(
						new ApiProviderError(
							error instanceof Error ? error.message : String(error),
							this.providerName,
							modelId,
							"createMessage",
						),
					)
					throw error
				}
				break
			}
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
				case "content_block_start": {
					const contentBlock = chunk.content_block as any
					switch (contentBlock.type) {
						case "thinking":
							// We may receive multiple text blocks, in which
							// case just insert a line break between them.
							if (chunk.index > 0) {
								yield { type: "reasoning", text: "\n" }
							}

							yield { type: "reasoning", text: contentBlock.thinking }
							break
						case "text":
							// We may receive multiple text blocks, in which
							// case just insert a line break between them.
							if (chunk.index > 0) {
								yield { type: "text", text: "\n" }
							}

							yield { type: "text", text: contentBlock.text }
							break
						case "tool_use": {
							// Emit initial tool call partial with id and name
							yield {
								type: "tool_call_partial",
								index: chunk.index,
								id: contentBlock.id,
								name: contentBlock.name,
								arguments: undefined,
							}
							break
						}
						case "server_tool_use": {
							const { id, name, input } = contentBlock
							yield {
								type: "advisor_tool_use",
								id,
								name,
								input: typeof input === "object" ? JSON.stringify(input) : String(input ?? "{}"),
							}
							break
						}
						case "advisor_tool_result": {
							const block = contentBlock as {
								type: "advisor_tool_result"
								tool_use_id: string
								content:
									| string
									| { type: string; text?: string }
									| Array<{ type: string; text?: string }>
									| undefined
							}
							const rawContent = block.content
							let text: string
							if (typeof rawContent === "string") {
								text = rawContent
							} else if (Array.isArray(rawContent)) {
								text = rawContent
									.filter((b) => b.type === "text")
									.map((b) => b.text ?? "")
									.join("\n")
							} else if (rawContent && typeof rawContent === "object" && "text" in rawContent) {
								// advisor_result shape: { type: "advisor_result", text: "..." }
								text = (rawContent as { text?: string }).text ?? ""
							} else {
								text = ""
							}
							yield {
								type: "advisor_tool_result",
								tool_use_id: block.tool_use_id,
								content: text,
								// Pass through the verbatim content object so it can be
								// round-tripped on subsequent turns as the Anthropic API requires.
								rawContent: rawContent,
							}
							break
						}
					}
					break
				}
				case "content_block_delta":
					switch (chunk.delta.type) {
						case "thinking_delta":
							yield { type: "reasoning", text: chunk.delta.thinking }
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
		let id = modelId && modelId in anthropicModels ? (modelId as AnthropicModelId) : anthropicDefaultModelId
		let info: ModelInfo = anthropicModels[id]

		// If 1M context beta is enabled for supported models, update the model info
		if (
			(id === "claude-sonnet-4-20250514" ||
				id === "claude-sonnet-4-5" ||
				id === "claude-sonnet-4-6" ||
				id === "claude-opus-4-6") &&
			this.options.anthropicBeta1MContext
		) {
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
			defaultTemperature: 0,
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

		let message
		try {
			message = await this.client.messages.create({
				model,
				max_tokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
				thinking: undefined,
				temperature,
				messages: [{ role: "user", content: prompt }],
				stream: false,
			})
		} catch (error) {
			TelemetryService.instance.captureException(
				new ApiProviderError(
					error instanceof Error ? error.message : String(error),
					this.providerName,
					model,
					"completePrompt",
				),
			)
			throw error
		}

		const content = message.content.find(({ type }) => type === "text")
		return content?.type === "text" ? content.text : ""
	}
}
