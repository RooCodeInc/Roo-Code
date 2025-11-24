import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
	OPEN_ROUTER_PROMPT_CACHING_MODELS,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { resolveToolProtocol } from "../../utils/resolveToolProtocol"
import { TOOL_PROTOCOL } from "@roo-code/types"
import { ApiStreamChunk } from "../transform/stream"
import { convertToR1Format } from "../transform/r1-format"
import { addCacheBreakpoints as addAnthropicCacheBreakpoints } from "../transform/caching/anthropic"
import { addCacheBreakpoints as addGeminiCacheBreakpoints } from "../transform/caching/gemini"
import type { OpenRouterReasoningParams } from "../transform/reasoning"
import { getModelParams } from "../transform/model-params"

import { getModels } from "./fetchers/modelCache"
import { getModelEndpoints } from "./fetchers/modelEndpointCache"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import { Package } from "../../shared/package"
import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import { handleOpenAIError } from "./utils/openai-error-handler"

// Image generation types
interface ImageGenerationResponse {
	choices?: Array<{
		message?: {
			content?: string
			images?: Array<{
				type?: string
				image_url?: {
					url?: string
				}
			}>
		}
	}>
	error?: {
		message?: string
		type?: string
		code?: string
	}
}

export interface ImageGenerationResult {
	success: boolean
	imageData?: string
	imageFormat?: string
	error?: string
}

// Add custom interface for OpenRouter params.
type OpenRouterChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParams & {
	transforms?: string[]
	include_reasoning?: boolean
	// https://openrouter.ai/docs/use-cases/reasoning-tokens
	reasoning?: OpenRouterReasoningParams
}

// See `OpenAI.Chat.Completions.ChatCompletionChunk["usage"]`
// `CompletionsAPI.CompletionUsage`
// See also: https://openrouter.ai/docs/use-cases/usage-accounting
interface CompletionUsage {
	completion_tokens?: number
	completion_tokens_details?: {
		reasoning_tokens?: number
	}
	prompt_tokens?: number
	prompt_tokens_details?: {
		cached_tokens?: number
	}
	total_tokens?: number
	cost?: number
	cost_details?: {
		upstream_inference_cost?: number
	}
}

export class OpenRouterHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	protected models: ModelRecord = {}
	protected endpoints: ModelRecord = {}
	private readonly providerName = "OpenRouter"
	private currentReasoningDetails: any[] = []

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
		const apiKey = this.options.openRouterApiKey ?? "not-provided"

		this.client = new OpenAI({ baseURL, apiKey, defaultHeaders: DEFAULT_HEADERS })

		// Load models asynchronously to populate cache before getModel() is called
		this.loadDynamicModels().catch((error) => {
			console.error("[OpenRouterHandler] Failed to load dynamic models:", error)
		})
	}

	private async loadDynamicModels(): Promise<void> {
		try {
			const [models, endpoints] = await Promise.all([
				getModels({ provider: "openrouter" }),
				getModelEndpoints({
					router: "openrouter",
					modelId: this.options.openRouterModelId,
					endpoint: this.options.openRouterSpecificProvider,
				}),
			])

			this.models = models
			this.endpoints = endpoints
		} catch (error) {
			console.error("[OpenRouterHandler] Error loading dynamic models:", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})
		}
	}

	getReasoningDetails(): any[] | undefined {
		return this.currentReasoningDetails.length > 0 ? this.currentReasoningDetails : undefined
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): AsyncGenerator<ApiStreamChunk> {
		const model = await this.fetchModel()

		let { id: modelId, maxTokens, temperature, topP, reasoning } = model

		// Reset reasoning_details accumulator for this request
		this.currentReasoningDetails = []

		// OpenRouter sends reasoning tokens by default for Gemini 2.5 Pro models
		// even if you don't request them. This is not the default for
		// other providers (including Gemini), so we need to explicitly disable
		// them unless the user has explicitly configured reasoning.
		// Note: Gemini 3 models use reasoning_details format and should not be excluded.
		if (
			(modelId === "google/gemini-2.5-pro-preview" || modelId === "google/gemini-2.5-pro") &&
			typeof reasoning === "undefined"
		) {
			reasoning = { exclude: true }
		}

		// Convert Anthropic messages to OpenAI format.
		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// DeepSeek highly recommends using user instead of system role.
		if (modelId.startsWith("deepseek/deepseek-r1") || modelId === "perplexity/sonar-reasoning") {
			openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
		}

		// Process reasoning_details when switching models to Gemini for native tool call compatibility
		const toolProtocol = resolveToolProtocol(this.options, model.info)
		const isNativeProtocol = toolProtocol === TOOL_PROTOCOL.NATIVE
		const isGemini = modelId.startsWith("google/gemini")

		// For Gemini with native protocol: inject fake reasoning.encrypted blocks for tool calls
		// This is required when switching from other models to Gemini to satisfy API validation
		if (isNativeProtocol && isGemini) {
			openAiMessages = openAiMessages.map((msg) => {
				if (msg.role === "assistant") {
					const toolCalls = (msg as any).tool_calls as any[] | undefined
					const existingDetails = (msg as any).reasoning_details as any[] | undefined

					// Only inject if there are tool calls and no existing encrypted reasoning
					if (toolCalls && toolCalls.length > 0) {
						const hasEncrypted = existingDetails?.some((d) => d.type === "reasoning.encrypted") ?? false

						if (!hasEncrypted) {
							const fakeEncrypted = toolCalls.map((tc, idx) => ({
								id: tc.id,
								type: "reasoning.encrypted",
								data: "skip_thought_signature_validator",
								format: "google-gemini-v1",
								index: (existingDetails?.length ?? 0) + idx,
							}))

							return {
								...msg,
								reasoning_details: [...(existingDetails ?? []), ...fakeEncrypted],
							}
						}
					}
				}
				return msg
			})
		}

		// https://openrouter.ai/docs/features/prompt-caching
		// TODO: Add a `promptCacheStratey` field to `ModelInfo`.
		if (OPEN_ROUTER_PROMPT_CACHING_MODELS.has(modelId)) {
			if (modelId.startsWith("google")) {
				addGeminiCacheBreakpoints(systemPrompt, openAiMessages)
			} else {
				addAnthropicCacheBreakpoints(systemPrompt, openAiMessages)
			}
		}

		const transforms = (this.options.openRouterUseMiddleOutTransform ?? true) ? ["middle-out"] : undefined

		// https://openrouter.ai/docs/transforms
		const completionParams: OpenRouterChatCompletionParams = {
			model: modelId,
			...(maxTokens && maxTokens > 0 && { max_tokens: maxTokens }),
			temperature,
			top_p: topP,
			messages: openAiMessages,
			stream: true,
			stream_options: { include_usage: true },
			// Only include provider if openRouterSpecificProvider is not "[default]".
			...(this.options.openRouterSpecificProvider &&
				this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME && {
					provider: {
						order: [this.options.openRouterSpecificProvider],
						only: [this.options.openRouterSpecificProvider],
						allow_fallbacks: false,
					},
				}),
			parallel_tool_calls: false, // Ensure only one tool call at a time
			...(transforms && { transforms }),
			...(reasoning && { reasoning }),
			...(metadata?.tools && { tools: metadata.tools }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
		}

		let stream
		try {
			stream = await this.client.chat.completions.create(completionParams)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}

		let lastUsage: CompletionUsage | undefined = undefined
		const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>()
		// Accumulator for reasoning_details: accumulate text by type-index key
		const reasoningDetailsAccumulator = new Map<
			string,
			{
				type: string
				text?: string
				summary?: string
				data?: string
				id?: string | null
				format?: string
				signature?: string
				index: number
			}
		>()

		for await (const chunk of stream) {
			// OpenRouter returns an error object instead of the OpenAI SDK throwing an error.
			if ("error" in chunk) {
				const error = chunk.error as { message?: string; code?: number }
				console.error(`OpenRouter API Error: ${error?.code} - ${error?.message}`)
				throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
			}

			const delta = chunk.choices[0]?.delta
			const finishReason = chunk.choices[0]?.finish_reason

			if (delta) {
				// Handle reasoning_details array format (used by Gemini 3, Claude, OpenAI o-series, etc.)
				// See: https://openrouter.ai/docs/use-cases/reasoning-tokens#preserving-reasoning-blocks
				// Priority: Check for reasoning_details first, as it's the newer format
				const deltaWithReasoning = delta as typeof delta & {
					reasoning_details?: Array<{
						type: string
						text?: string
						summary?: string
						data?: string
						id?: string | null
						format?: string
						signature?: string
						index?: number
					}>
				}

				if (deltaWithReasoning.reasoning_details && Array.isArray(deltaWithReasoning.reasoning_details)) {
					for (const detail of deltaWithReasoning.reasoning_details) {
						const index = detail.index ?? 0
						const key = `${detail.type}-${index}`
						const existing = reasoningDetailsAccumulator.get(key)

						if (existing) {
							// Accumulate text/summary/data for existing reasoning detail
							if (detail.text !== undefined) {
								existing.text = (existing.text || "") + detail.text
							}
							if (detail.summary !== undefined) {
								existing.summary = (existing.summary || "") + detail.summary
							}
							if (detail.data !== undefined) {
								existing.data = (existing.data || "") + detail.data
							}
							// Update other fields if provided
							if (detail.id !== undefined) existing.id = detail.id
							if (detail.format !== undefined) existing.format = detail.format
							if (detail.signature !== undefined) existing.signature = detail.signature
						} else {
							// Start new reasoning detail accumulation
							reasoningDetailsAccumulator.set(key, {
								type: detail.type,
								text: detail.text,
								summary: detail.summary,
								data: detail.data,
								id: detail.id,
								format: detail.format,
								signature: detail.signature,
								index,
							})
						}

						// Yield text for display (still fragmented for live streaming)
						let reasoningText: string | undefined
						if (detail.type === "reasoning.text" && typeof detail.text === "string") {
							reasoningText = detail.text
						} else if (detail.type === "reasoning.summary" && typeof detail.summary === "string") {
							reasoningText = detail.summary
						}
						// Note: reasoning.encrypted types are intentionally skipped as they contain redacted content

						if (reasoningText) {
							yield { type: "reasoning", text: reasoningText }
						}
					}
				} else if ("reasoning" in delta && delta.reasoning && typeof delta.reasoning === "string") {
					// Handle legacy reasoning format - only if reasoning_details is not present
					// See: https://openrouter.ai/docs/use-cases/reasoning-tokens
					yield { type: "reasoning", text: delta.reasoning }
				}

				// Check for tool calls in delta
				if ("tool_calls" in delta && Array.isArray(delta.tool_calls)) {
					for (const toolCall of delta.tool_calls) {
						const index = toolCall.index
						const existing = toolCallAccumulator.get(index)

						if (existing) {
							// Accumulate arguments for existing tool call
							if (toolCall.function?.arguments) {
								existing.arguments += toolCall.function.arguments
							}
						} else {
							// Start new tool call accumulation
							toolCallAccumulator.set(index, {
								id: toolCall.id || "",
								name: toolCall.function?.name || "",
								arguments: toolCall.function?.arguments || "",
							})
						}
					}
				}

				if (delta.content) {
					yield { type: "text", text: delta.content }
				}
			}

			// When finish_reason is 'tool_calls', yield all accumulated tool calls
			if (finishReason === "tool_calls" && toolCallAccumulator.size > 0) {
				for (const toolCall of toolCallAccumulator.values()) {
					yield {
						type: "tool_call",
						id: toolCall.id,
						name: toolCall.name,
						arguments: toolCall.arguments,
					}
				}
				// Clear accumulator after yielding
				toolCallAccumulator.clear()
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		// Fallback: If stream ends with accumulated tool calls that weren't yielded
		// (e.g., finish_reason was 'stop' or 'length' instead of 'tool_calls')
		if (toolCallAccumulator.size > 0) {
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

		// After streaming completes, store the accumulated reasoning_details
		if (reasoningDetailsAccumulator.size > 0) {
			this.currentReasoningDetails = Array.from(reasoningDetailsAccumulator.values())
		}

		if (lastUsage) {
			yield {
				type: "usage",
				inputTokens: lastUsage.prompt_tokens || 0,
				outputTokens: lastUsage.completion_tokens || 0,
				cacheReadTokens: lastUsage.prompt_tokens_details?.cached_tokens,
				reasoningTokens: lastUsage.completion_tokens_details?.reasoning_tokens,
				totalCost: (lastUsage.cost_details?.upstream_inference_cost || 0) + (lastUsage.cost || 0),
			}
		}
	}

	public async fetchModel() {
		const [models, endpoints] = await Promise.all([
			getModels({ provider: "openrouter" }),
			getModelEndpoints({
				router: "openrouter",
				modelId: this.options.openRouterModelId,
				endpoint: this.options.openRouterSpecificProvider,
			}),
		])

		this.models = models
		this.endpoints = endpoints

		return this.getModel()
	}

	override getModel() {
		const id = this.options.openRouterModelId ?? openRouterDefaultModelId
		let info = this.models[id] ?? openRouterDefaultModelInfo

		// If a specific provider is requested, use the endpoint for that provider.
		if (this.options.openRouterSpecificProvider && this.endpoints[this.options.openRouterSpecificProvider]) {
			info = this.endpoints[this.options.openRouterSpecificProvider]
		}

		const isDeepSeekR1 = id.startsWith("deepseek/deepseek-r1") || id === "perplexity/sonar-reasoning"

		const params = getModelParams({
			format: "openrouter",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0,
		})

		return { id, info, topP: isDeepSeekR1 ? 0.95 : undefined, ...params }
	}

	async completePrompt(prompt: string, systemPrompt?: string, metadata?: any) {
		let { id: modelId, maxTokens, temperature, reasoning } = await this.fetchModel()

		const completionParams: OpenRouterChatCompletionParams = {
			model: modelId,
			max_tokens: maxTokens,
			temperature,
			messages: [{ role: "user", content: prompt }],
			stream: false,
			// Only include provider if openRouterSpecificProvider is not "[default]".
			...(this.options.openRouterSpecificProvider &&
				this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME && {
					provider: {
						order: [this.options.openRouterSpecificProvider],
						only: [this.options.openRouterSpecificProvider],
						allow_fallbacks: false,
					},
				}),
			...(reasoning && { reasoning }),
		}

		let response
		try {
			response = await this.client.chat.completions.create(completionParams, { signal: metadata?.signal })
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}

		if ("error" in response) {
			const error = response.error as { message?: string; code?: number }
			throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
		}

		const completion = response as OpenAI.Chat.ChatCompletion
		return completion.choices[0]?.message?.content || ""
	}

	/**
	 * Generate an image using OpenRouter's image generation API
	 * @param prompt The text prompt for image generation
	 * @param model The model to use for generation
	 * @param apiKey The OpenRouter API key (must be explicitly provided)
	 * @param inputImage Optional base64 encoded input image data URL
	 * @returns The generated image data and format, or an error
	 */
	async generateImage(
		prompt: string,
		model: string,
		apiKey: string,
		inputImage?: string,
	): Promise<ImageGenerationResult> {
		if (!apiKey) {
			return {
				success: false,
				error: "OpenRouter API key is required for image generation",
			}
		}

		try {
			const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
			const response = await fetch(`${baseURL}/chat/completions`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
					"HTTP-Referer": "https://github.com/zgsm-ai/zgsm",
					"X-Costrict-Version": Package.version,
					"X-Title": "Costrict",
				},
				body: JSON.stringify({
					model,
					messages: [
						{
							role: "user",
							content: inputImage
								? [
										{
											type: "text",
											text: prompt,
										},
										{
											type: "image_url",
											image_url: {
												url: inputImage,
											},
										},
									]
								: prompt,
						},
					],
					modalities: ["image", "text"],
				}),
			})

			if (!response.ok) {
				const errorText = await response.text()
				let errorMessage = `Failed to generate image: ${response.status} ${response.statusText}`
				try {
					const errorJson = JSON.parse(errorText)
					if (errorJson.error?.message) {
						errorMessage = `Failed to generate image: ${errorJson.error.message}`
					}
				} catch {
					// Use default error message
				}
				return {
					success: false,
					error: errorMessage,
				}
			}

			const result: ImageGenerationResponse = await response.json()

			if (result.error) {
				return {
					success: false,
					error: `Failed to generate image: ${result.error.message}`,
				}
			}

			// Extract the generated image from the response
			const images = result.choices?.[0]?.message?.images
			if (!images || images.length === 0) {
				return {
					success: false,
					error: "No image was generated in the response",
				}
			}

			const imageData = images[0]?.image_url?.url
			if (!imageData) {
				return {
					success: false,
					error: "Invalid image data in response",
				}
			}

			// Extract base64 data from data URL
			const base64Match = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)
			if (!base64Match) {
				return {
					success: false,
					error: "Invalid image format received",
				}
			}

			return {
				success: true,
				imageData: imageData,
				imageFormat: base64Match[1],
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
			}
		}
	}
}
