import { Anthropic } from "@anthropic-ai/sdk"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { GoogleAuth, JWTInput } from "google-auth-library"

import {
	type ModelInfo,
	type VertexModelId,
	vertexDefaultModelId,
	vertexModels,
	ANTHROPIC_DEFAULT_MAX_TOKENS,
	TOOL_PROTOCOL,
	VERTEX_1M_CONTEXT_MODEL_IDS,
} from "@roo-code/types"

import { ApiHandlerOptions } from "../../shared/api"
import { safeJsonParse } from "../../shared/safeJsonParse"

import { ApiStream } from "../transform/stream"
import { addCacheBreakpoints } from "../transform/caching/vertex"
import { getModelParams } from "../transform/model-params"
import { filterNonAnthropicBlocks } from "../transform/anthropic-filter"
import { resolveToolProtocol } from "../../utils/resolveToolProtocol"
import {
	convertOpenAIToolsToAnthropic,
	convertOpenAIToolChoiceToAnthropic,
} from "../../core/prompts/tools/native-tools/converters"

import { ApiInferenceLogger } from "../logging/ApiInferenceLogger"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

// https://docs.anthropic.com/en/api/claude-on-vertex-ai
export class AnthropicVertexHandler extends BaseProvider implements SingleCompletionHandler {
	protected readonly providerName = "Anthropic Vertex"
	protected options: ApiHandlerOptions
	private client: AnthropicVertex

	constructor(options: ApiHandlerOptions) {
		super()

		this.options = options

		// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#regions
		const projectId = this.options.vertexProjectId ?? "not-provided"
		const region = this.options.vertexRegion ?? "us-east5"

		if (this.options.vertexJsonCredentials) {
			this.client = new AnthropicVertex({
				projectId,
				region,
				googleAuth: new GoogleAuth({
					scopes: ["https://www.googleapis.com/auth/cloud-platform"],
					credentials: safeJsonParse<JWTInput>(this.options.vertexJsonCredentials, undefined),
				}),
			})
		} else if (this.options.vertexKeyFile) {
			this.client = new AnthropicVertex({
				projectId,
				region,
				googleAuth: new GoogleAuth({
					scopes: ["https://www.googleapis.com/auth/cloud-platform"],
					keyFile: this.options.vertexKeyFile,
				}),
			})
		} else {
			this.client = new AnthropicVertex({ projectId, region })
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const startedAt = Date.now()
		const shouldLog = ApiInferenceLogger.isEnabled()

		let { id, info, temperature, maxTokens, reasoning: thinking, betas } = this.getModel()

		const { supportsPromptCache } = info

		// Filter out non-Anthropic blocks (reasoning, thoughtSignature, etc.) before sending to the API
		const sanitizedMessages = filterNonAnthropicBlocks(messages)

		// Enable native tools using resolveToolProtocol (which checks model's defaultToolProtocol)
		// This matches the approach used in AnthropicHandler
		// Also exclude tools when tool_choice is "none" since that means "don't use tools"
		const toolProtocol = resolveToolProtocol(this.options, info, metadata?.toolProtocol)
		const shouldIncludeNativeTools =
			metadata?.tools &&
			metadata.tools.length > 0 &&
			toolProtocol === TOOL_PROTOCOL.NATIVE &&
			metadata?.tool_choice !== "none"

		const nativeToolParams = shouldIncludeNativeTools
			? {
					tools: convertOpenAIToolsToAnthropic(metadata.tools!),
					tool_choice: convertOpenAIToolChoiceToAnthropic(metadata.tool_choice, metadata.parallelToolCalls),
				}
			: {}

		const textParts: string[] = []
		const reasoningParts: string[] = []
		const toolCallsByIndex = new Map<
			number,
			{
				index: number
				id?: string
				name?: string
				argsParts: string[]
			}
		>()

		let usageSnapshot:
			| {
					inputTokens: number
					outputTokens: number
					cacheWriteTokens?: number
					cacheReadTokens?: number
			  }
			| undefined

		function tryParseJsonString(input: string): unknown {
			try {
				return JSON.parse(input)
			} catch {
				return input
			}
		}

		function getOrCreateToolCall(index: number) {
			let current = toolCallsByIndex.get(index)
			if (!current) {
				current = { index, argsParts: [] }
				toolCallsByIndex.set(index, current)
			}
			return current
		}

		/**
		 * Vertex API has specific limitations for prompt caching:
		 * 1. Maximum of 4 blocks can have cache_control
		 * 2. Only text blocks can be cached (images and other content types cannot)
		 * 3. Cache control can only be applied to user messages, not assistant messages
		 *
		 * Our caching strategy:
		 * - Cache the system prompt (1 block)
		 * - Cache the last text block of the second-to-last user message (1 block)
		 * - Cache the last text block of the last user message (1 block)
		 * This ensures we stay under the 4-block limit while maintaining effective caching
		 * for the most relevant context.
		 */
		const params: Anthropic.Messages.MessageCreateParamsStreaming = {
			model: id,
			max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
			temperature,
			thinking,
			// Cache the system prompt if caching is enabled.
			system: supportsPromptCache
				? [{ text: systemPrompt, type: "text" as const, cache_control: { type: "ephemeral" } }]
				: systemPrompt,
			messages: supportsPromptCache ? addCacheBreakpoints(sanitizedMessages) : sanitizedMessages,
			stream: true,
			...nativeToolParams,
		}

		// and prompt caching
		const requestOptions = betas?.length ? { headers: { "anthropic-beta": betas.join(",") } } : undefined

		if (shouldLog) {
			ApiInferenceLogger.logRaw(`[API][request][${this.providerName}][${id}]`, {
				...params,
				...(requestOptions ? { __requestOptions: requestOptions } : {}),
			})
		}

		let stream: Awaited<ReturnType<typeof this.client.messages.create>>
		try {
			stream = await this.client.messages.create(params, requestOptions)
		} catch (error) {
			if (shouldLog) {
				const durationMs = Date.now() - startedAt
				ApiInferenceLogger.logRawError(`[API][error][${this.providerName}][${id}][${durationMs}ms]`, error)
			}
			throw error
		}

		try {
			for await (const chunk of stream) {
				switch (chunk.type) {
					case "message_start": {
						const usage = chunk.message!.usage
						usageSnapshot = {
							inputTokens: usage.input_tokens || 0,
							outputTokens: usage.output_tokens || 0,
							cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
							cacheReadTokens: usage.cache_read_input_tokens || undefined,
						}

						yield {
							type: "usage",
							inputTokens: usageSnapshot.inputTokens,
							outputTokens: usageSnapshot.outputTokens,
							cacheWriteTokens: usageSnapshot.cacheWriteTokens,
							cacheReadTokens: usageSnapshot.cacheReadTokens,
						}

						break
					}
					case "message_delta": {
						const outputTokens = chunk.usage!.output_tokens || 0
						if (usageSnapshot) usageSnapshot.outputTokens = outputTokens
						yield {
							type: "usage",
							inputTokens: 0,
							outputTokens,
						}

						break
					}
					case "content_block_start": {
						switch (chunk.content_block!.type) {
							case "text": {
								if (chunk.index! > 0) {
									textParts.push("\n")
									yield { type: "text", text: "\n" }
								}

								textParts.push(chunk.content_block!.text)
								yield { type: "text", text: chunk.content_block!.text }
								break
							}
							case "thinking": {
								if (chunk.index! > 0) {
									reasoningParts.push("\n")
									yield { type: "reasoning", text: "\n" }
								}

								const thinkingText = (chunk.content_block as any).thinking as string
								reasoningParts.push(thinkingText)
								yield { type: "reasoning", text: thinkingText }
								break
							}
							case "tool_use": {
								const tc = getOrCreateToolCall(chunk.index ?? 0)
								tc.id = chunk.content_block!.id
								tc.name = chunk.content_block!.name

								// Emit initial tool call partial with id and name
								yield {
									type: "tool_call_partial",
									index: chunk.index,
									id: chunk.content_block!.id,
									name: chunk.content_block!.name,
									arguments: undefined,
								}
								break
							}
						}

						break
					}
					case "content_block_delta": {
						switch (chunk.delta!.type) {
							case "text_delta": {
								textParts.push(chunk.delta!.text)
								yield { type: "text", text: chunk.delta!.text }
								break
							}
							case "thinking_delta": {
								const thinkingText = (chunk.delta as any).thinking as string
								reasoningParts.push(thinkingText)
								yield { type: "reasoning", text: thinkingText }
								break
							}
							case "input_json_delta": {
								const partial = (chunk.delta as any).partial_json as string
								const tc = getOrCreateToolCall(chunk.index ?? 0)
								if (typeof partial === "string" && partial.length > 0) tc.argsParts.push(partial)
								// Emit tool call partial chunks as arguments stream in
								yield {
									type: "tool_call_partial",
									index: chunk.index,
									id: undefined,
									name: undefined,
									arguments: partial,
								}
								break
							}
						}

						break
					}
					case "content_block_stop": {
						// Block complete - no action needed for now.
						// NativeToolCallParser handles tool call completion
						// Note: Signature for multi-turn thinking would require using stream.finalMessage()
						// after iteration completes, which requires restructuring the streaming approach.
						break
					}
				}
			}
		} catch (error) {
			if (shouldLog) {
				const durationMs = Date.now() - startedAt
				ApiInferenceLogger.logRawError(`[API][error][${this.providerName}][${id}][${durationMs}ms]`, error)
			}
			throw error
		} finally {
			if (shouldLog) {
				const durationMs = Date.now() - startedAt
				const toolUseBlocks = Array.from(toolCallsByIndex.values())
					.sort((a, b) => a.index - b.index)
					.map((tc) => {
						const joined = tc.argsParts.join("")
						return {
							type: "tool_use" as const,
							...(tc.id ? { id: tc.id } : {}),
							...(tc.name ? { name: tc.name } : {}),
							...(joined.length > 0 ? { input: tryParseJsonString(joined) } : {}),
						}
					})

				ApiInferenceLogger.logRaw(`[API][response][${this.providerName}][${id}][${durationMs}ms][streaming]`, {
					type: "message",
					role: "assistant",
					model: id,
					content: [
						...(textParts.length > 0 ? ([{ type: "text", text: textParts.join("") }] as const) : []),
						...(reasoningParts.length > 0
							? ([{ type: "thinking", thinking: reasoningParts.join("") }] as const)
							: []),
						...toolUseBlocks,
					],
					...(usageSnapshot
						? {
								usage: {
									input_tokens: usageSnapshot.inputTokens,
									output_tokens: usageSnapshot.outputTokens,
									cache_creation_input_tokens: usageSnapshot.cacheWriteTokens,
									cache_read_input_tokens: usageSnapshot.cacheReadTokens,
								},
							}
						: {}),
				})
			}
		}
	}

	getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in vertexModels ? (modelId as VertexModelId) : vertexDefaultModelId
		let info: ModelInfo = vertexModels[id]

		// Check if 1M context beta should be enabled for supported models
		const supports1MContext = VERTEX_1M_CONTEXT_MODEL_IDS.includes(
			id as (typeof VERTEX_1M_CONTEXT_MODEL_IDS)[number],
		)
		const enable1MContext = supports1MContext && this.options.vertex1MContext

		// If 1M context beta is enabled, update the model info with tier pricing
		if (enable1MContext) {
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

		const params = getModelParams({ format: "anthropic", modelId: id, model: info, settings: this.options })

		// Build betas array for request headers
		const betas: string[] = []

		// Add 1M context beta flag if enabled for supported models
		if (enable1MContext) {
			betas.push("context-1m-2025-08-07")
		}

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Anthropic's API does not have this
		// suffix.
		return {
			id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id,
			info,
			betas: betas.length > 0 ? betas : undefined,
			...params,
		}
	}

	async completePrompt(prompt: string) {
		try {
			const startedAt = Date.now()
			let {
				id,
				info: { supportsPromptCache },
				temperature,
				maxTokens = ANTHROPIC_DEFAULT_MAX_TOKENS,
				reasoning: thinking,
			} = this.getModel()

			const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
				model: id,
				max_tokens: maxTokens,
				temperature,
				thinking,
				messages: [
					{
						role: "user",
						content: supportsPromptCache
							? [{ type: "text" as const, text: prompt, cache_control: { type: "ephemeral" } }]
							: prompt,
					},
				],
				stream: false,
			}

			if (ApiInferenceLogger.isEnabled()) {
				ApiInferenceLogger.logRaw(`[API][request][${this.providerName}][${id}]`, params)
			}

			const response = await this.client.messages.create(params)
			if (ApiInferenceLogger.isEnabled()) {
				const durationMs = Date.now() - startedAt
				ApiInferenceLogger.logRaw(`[API][response][${this.providerName}][${id}][${durationMs}ms]`, response)
			}
			const content = response.content[0]

			if (content.type === "text") {
				return content.text
			}

			return ""
		} catch (error) {
			const modelId = this.options.apiModelId ?? vertexDefaultModelId
			if (ApiInferenceLogger.isEnabled()) {
				ApiInferenceLogger.logRawError(`[API][error][${this.providerName}][${modelId}][0ms]`, error)
			}
			if (error instanceof Error) {
				throw new Error(`Vertex completion error: ${error.message}`)
			}

			throw error
		}
	}
}
