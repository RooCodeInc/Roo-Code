import { Anthropic } from "@anthropic-ai/sdk"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { GoogleAuth, JWTInput } from "google-auth-library"

import {
	type ModelInfo,
	type VertexModelId,
	vertexDefaultModelId,
	vertexModels,
	ANTHROPIC_DEFAULT_MAX_TOKENS,
} from "@roo-code/types"

import { ApiHandlerOptions } from "../../shared/api"
import { safeJsonParse } from "../../shared/safeJsonParse"

import { ApiStream } from "../transform/stream"
import { addCacheBreakpoints } from "../transform/caching/vertex"
import { getModelParams } from "../transform/model-params"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

// https://docs.anthropic.com/en/api/claude-on-vertex-ai
export class AnthropicVertexHandler extends BaseProvider implements SingleCompletionHandler {
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
		let {
			id,
			info: { supportsPromptCache },
			temperature,
			maxTokens,
			reasoning: thinking,
		} = this.getModel()

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
			// Cache the system prompt if caching is enabled.
			system: supportsPromptCache
				? [{ text: systemPrompt, type: "text" as const, cache_control: { type: "ephemeral" } }]
				: systemPrompt,
			messages: supportsPromptCache ? addCacheBreakpoints(messages) : messages,
			stream: true,
		}
		// Only set thinking if defined to avoid adding an explicit undefined property
		if (thinking) {
			;(params as any).thinking = thinking
		}

		// Enable 1M context beta when using [1m] variants or when explicitly enabled via settings for Sonnet 4/4.5
		const use1m =
			this.options.apiModelId?.endsWith("[1m]") === true ||
			((id === "claude-sonnet-4@20250514" || id === "claude-sonnet-4-5@20250929") &&
				this.options.anthropicBeta1MContext === true)

		let stream
		if (use1m) {
			stream = await this.client.messages.create(params, {
				headers: { "anthropic-beta": "context-1m-2025-08-07" },
			})
		} else {
			stream = await this.client.messages.create(params)
		}

		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start": {
					const usage = chunk.message!.usage

					yield {
						type: "usage",
						inputTokens: usage.input_tokens || 0,
						outputTokens: usage.output_tokens || 0,
						cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
						cacheReadTokens: usage.cache_read_input_tokens || undefined,
					}

					break
				}
				case "message_delta": {
					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage!.output_tokens || 0,
					}

					break
				}
				case "content_block_start": {
					switch (chunk.content_block!.type) {
						case "text": {
							if (chunk.index! > 0) {
								yield { type: "text", text: "\n" }
							}

							yield { type: "text", text: chunk.content_block!.text }
							break
						}
						case "thinking": {
							if (chunk.index! > 0) {
								yield { type: "reasoning", text: "\n" }
							}

							yield { type: "reasoning", text: (chunk.content_block as any).thinking }
							break
						}
					}

					break
				}
				case "content_block_delta": {
					switch (chunk.delta!.type) {
						case "text_delta": {
							yield { type: "text", text: chunk.delta!.text }
							break
						}
						case "thinking_delta": {
							yield { type: "reasoning", text: (chunk.delta as any).thinking }
							break
						}
					}

					break
				}
			}
		}
	}

	getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in vertexModels ? (modelId as VertexModelId) : vertexDefaultModelId
		const info: ModelInfo = vertexModels[id]
		const params = getModelParams({ format: "anthropic", modelId: id, model: info, settings: this.options })

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Anthropic's API does not have this
		// suffix. Additionally, strip the optional [1m] suffix used to
		// denote the 1M context beta variant in Roo's model list.
		const normalizedId = id.replace(":thinking", "").replace("[1m]", "")
		return { id: normalizedId, info, ...params }
	}

	async completePrompt(prompt: string) {
		try {
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
			// Only set thinking if defined to avoid adding an explicit undefined property
			if (thinking) {
				;(params as any).thinking = thinking
			}

			// Enable 1M context beta when using [1m] variants or when explicitly enabled via settings for Sonnet 4/4.5
			const use1m =
				this.options.apiModelId?.endsWith("[1m]") === true ||
				((id === "claude-sonnet-4@20250514" || id === "claude-sonnet-4-5@20250929") &&
					this.options.anthropicBeta1MContext === true)

			const response = use1m
				? await this.client.messages.create(params, { headers: { "anthropic-beta": "context-1m-2025-08-07" } })
				: await this.client.messages.create(params)
			const content = response.content[0]

			if (content.type === "text") {
				return content.text
			}

			return ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Vertex completion error: ${error.message}`)
			}

			throw error
		}
	}
}
