import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { rooDefaultModelId, getApiProtocol } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { convertToOpenAiMessages } from "../transform/openai-format"
import type { RooReasoningParams } from "../transform/reasoning"
import { getRooReasoning } from "../transform/reasoning"

import type { ApiHandlerCreateMessageMetadata } from "../index"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import { getModels, getModelsFromCache } from "../providers/fetchers/modelCache"
import { handleOpenAIError } from "./utils/openai-error-handler"

// Extend OpenAI's CompletionUsage to include Roo specific fields
interface RooUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
	cost?: number
}

// Add custom interface for Roo params to support reasoning
type RooChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
	reasoning?: RooReasoningParams
}

function getSessionToken(): string {
	const token = CloudService.hasInstance() ? CloudService.instance.authService?.getSessionToken() : undefined
	return token ?? "unauthenticated"
}

export class RooHandler extends BaseOpenAiCompatibleProvider<string> {
	private fetcherBaseURL: string

	constructor(options: ApiHandlerOptions) {
		const sessionToken = getSessionToken()

		let baseURL = process.env.ROO_CODE_PROVIDER_URL ?? "https://api.roocode.com/proxy"

		// Ensure baseURL ends with /v1 for OpenAI client, but don't duplicate it
		if (!baseURL.endsWith("/v1")) {
			baseURL = `${baseURL}/v1`
		}

		// Always construct the handler, even without a valid token.
		// The provider-proxy server will return 401 if authentication fails.
		super({
			...options,
			providerName: "Roo Code Cloud",
			baseURL, // Already has /v1 suffix
			apiKey: sessionToken,
			defaultProviderModelId: rooDefaultModelId,
			providerModels: {},
			defaultTemperature: 0.7,
		})

		// Load dynamic models asynchronously - strip /v1 from baseURL for fetcher
		this.fetcherBaseURL = baseURL.endsWith("/v1") ? baseURL.slice(0, -3) : baseURL
		this.loadDynamicModels(this.fetcherBaseURL, sessionToken).catch((error) => {
			console.error("[RooHandler] Failed to load dynamic models:", error)
		})
	}

	protected override createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	) {
		const { id: model, info } = this.getModel()

		// Get model parameters including reasoning
		const params = getModelParams({
			format: "openai",
			modelId: model,
			model: info,
			settings: this.options,
			defaultTemperature: this.defaultTemperature,
		})

		// Get Roo-specific reasoning parameters
		const reasoning = getRooReasoning({
			model: info,
			reasoningBudget: params.reasoningBudget,
			reasoningEffort: params.reasoningEffort,
			settings: this.options,
		})

		const max_tokens = params.maxTokens ?? undefined
		const temperature = params.temperature ?? this.defaultTemperature

		const rooParams: RooChatCompletionParams = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
			...(reasoning && { reasoning }),
			...(metadata?.tools && { tools: metadata.tools }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
		}

		try {
			this.client.apiKey = getSessionToken()
			return this.client.chat.completions.create(rooParams, requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		try {
			const stream = await this.createStream(
				systemPrompt,
				messages,
				metadata,
				metadata?.taskId ? { headers: { "X-Roo-Task-ID": metadata.taskId } } : undefined,
			)

			let lastUsage: RooUsage | undefined = undefined
			// Accumulate tool calls by index - similar to how reasoning accumulates
			const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>()
			// Track if we're currently processing reasoning to prevent interference with tool parsing
			let isProcessingReasoning = false

			// Check if this is an x-ai model that might have malformed reasoning blocks
			const modelId = this.options.apiModelId || ""
			const isXAIModel = modelId.includes("x-ai/") || modelId.includes("grok")

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta
				const finishReason = chunk.choices[0]?.finish_reason

				if (delta) {
					// Check for reasoning content (similar to OpenRouter)
					if ("reasoning" in delta && delta.reasoning && typeof delta.reasoning === "string") {
						// For x-ai models, sanitize reasoning text to prevent XML-like content from interfering
						let reasoningText = delta.reasoning
						if (isXAIModel) {
							// Remove any XML-like tags that might interfere with tool parsing
							reasoningText = reasoningText
								.replace(/<\/?apply_diff[^>]*>/g, "")
								.replace(/<\/?SEARCH[^>]*>/g, "")
								.replace(/<\/?REPLACE[^>]*>/g, "")
								.replace(/<<<<<<< SEARCH/g, "[SEARCH]")
								.replace(/=======/g, "[SEPARATOR]")
								.replace(/>>>>>>> REPLACE/g, "[REPLACE]")
						}
						isProcessingReasoning = true
						yield {
							type: "reasoning",
							text: reasoningText,
						}
						isProcessingReasoning = false
					}

					// Also check for reasoning_content for backward compatibility
					if ("reasoning_content" in delta && typeof delta.reasoning_content === "string") {
						// Apply same sanitization for x-ai models
						let reasoningText = delta.reasoning_content
						if (isXAIModel) {
							reasoningText = reasoningText
								.replace(/<\/?apply_diff[^>]*>/g, "")
								.replace(/<\/?SEARCH[^>]*>/g, "")
								.replace(/<\/?REPLACE[^>]*>/g, "")
								.replace(/<<<<<<< SEARCH/g, "[SEARCH]")
								.replace(/=======/g, "[SEPARATOR]")
								.replace(/>>>>>>> REPLACE/g, "[REPLACE]")
						}
						isProcessingReasoning = true
						yield {
							type: "reasoning",
							text: reasoningText,
						}
						isProcessingReasoning = false
					}

					// Check for tool calls in delta - but skip if we're processing reasoning to avoid interference
					if (!isProcessingReasoning && "tool_calls" in delta && Array.isArray(delta.tool_calls)) {
						for (const toolCall of delta.tool_calls) {
							const index = toolCall.index
							const existing = toolCallAccumulator.get(index)

							if (existing) {
								// Accumulate arguments for existing tool call
								if (toolCall.function?.arguments) {
									// For x-ai models, validate the arguments don't contain reasoning artifacts
									let args = toolCall.function.arguments
									if (isXAIModel && args) {
										// Check if the arguments contain reasoning block artifacts
										if (
											args.includes("<think>") ||
											args.includes("</think>") ||
											args.includes("<reasoning>") ||
											args.includes("</reasoning>")
										) {
											// Skip this chunk as it's likely corrupted reasoning content
											console.warn(
												"[RooHandler] Skipping corrupted tool call arguments from x-ai model",
												{
													modelId,
													corruptedContent: args.substring(0, 100),
												},
											)
											continue
										}
									}
									existing.arguments += args
								}
							} else {
								// Start new tool call accumulation
								const toolName = toolCall.function?.name || ""
								const toolArgs = toolCall.function?.arguments || ""

								// Validate tool name isn't corrupted by reasoning content
								if (isXAIModel && (toolName.includes("think") || toolName.includes("reasoning"))) {
									console.warn("[RooHandler] Skipping corrupted tool call from x-ai model", {
										modelId,
										corruptedName: toolName,
									})
									continue
								}

								toolCallAccumulator.set(index, {
									id: toolCall.id || "",
									name: toolName,
									arguments: toolArgs,
								})
							}
						}
					}

					if (delta.content) {
						// For x-ai models, check if content contains interleaved reasoning markers
						let textContent = delta.content
						if (isXAIModel) {
							// Check for common reasoning block markers that shouldn't be in regular content
							if (textContent.includes("<think>") || textContent.includes("</think>")) {
								// Extract and handle the reasoning part separately
								const thinkMatch = textContent.match(/<think>(.*?)<\/think>/s)
								if (thinkMatch) {
									// Emit the reasoning part
									yield {
										type: "reasoning",
										text: thinkMatch[1],
									}
									// Remove the thinking block from the text
									textContent = textContent.replace(/<think>.*?<\/think>/s, "")
								}
							}
						}

						// Only yield text if there's content after cleaning
						if (textContent.trim()) {
							yield {
								type: "text",
								text: textContent,
							}
						}
					}
				}

				// When finish_reason is 'tool_calls', yield all accumulated tool calls
				if (finishReason === "tool_calls" && toolCallAccumulator.size > 0) {
					for (const [index, toolCall] of toolCallAccumulator.entries()) {
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
					lastUsage = chunk.usage as RooUsage
				}
			}

			// Fallback: If stream ends with accumulated tool calls that weren't yielded
			// (e.g., finish_reason was 'stop' or 'length' instead of 'tool_calls')
			if (toolCallAccumulator.size > 0) {
				for (const [index, toolCall] of toolCallAccumulator.entries()) {
					yield {
						type: "tool_call",
						id: toolCall.id,
						name: toolCall.name,
						arguments: toolCall.arguments,
					}
				}
				toolCallAccumulator.clear()
			}

			if (lastUsage) {
				// Check if the current model is marked as free
				const model = this.getModel()
				const isFreeModel = model.info.isFree ?? false

				// Normalize input tokens based on protocol expectations:
				// - OpenAI protocol expects TOTAL input tokens (cached + non-cached)
				// - Anthropic protocol expects NON-CACHED input tokens (caches passed separately)
				const modelId = model.id
				const apiProtocol = getApiProtocol("roo", modelId)

				const promptTokens = lastUsage.prompt_tokens || 0
				const cacheWrite = lastUsage.cache_creation_input_tokens || 0
				const cacheRead = lastUsage.prompt_tokens_details?.cached_tokens || 0
				const nonCached = Math.max(0, promptTokens - cacheWrite - cacheRead)

				const inputTokensForDownstream = apiProtocol === "anthropic" ? nonCached : promptTokens

				yield {
					type: "usage",
					inputTokens: inputTokensForDownstream,
					outputTokens: lastUsage.completion_tokens || 0,
					cacheWriteTokens: cacheWrite,
					cacheReadTokens: cacheRead,
					totalCost: isFreeModel ? 0 : (lastUsage.cost ?? 0),
				}
			}
		} catch (error) {
			// Log streaming errors with context
			console.error("[RooHandler] Error during message streaming:", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				modelId: this.options.apiModelId,
				hasTaskId: Boolean(metadata?.taskId),
			})
			throw error
		}
	}
	override async completePrompt(prompt: string): Promise<string> {
		// Update API key before making request to ensure we use the latest session token
		this.client.apiKey = getSessionToken()
		return super.completePrompt(prompt)
	}

	private async loadDynamicModels(baseURL: string, apiKey?: string): Promise<void> {
		try {
			// Fetch models and cache them in the shared cache
			await getModels({
				provider: "roo",
				baseUrl: baseURL,
				apiKey,
			})
		} catch (error) {
			// Enhanced error logging with more context
			console.error("[RooHandler] Error loading dynamic models:", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				baseURL,
				hasApiKey: Boolean(apiKey),
			})
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId || rooDefaultModelId

		// Get models from shared cache
		const models = getModelsFromCache("roo") || {}
		const modelInfo = models[modelId]

		if (modelInfo) {
			return { id: modelId, info: modelInfo }
		}

		// Return the requested model ID even if not found, with fallback info.
		const fallbackInfo = {
			maxTokens: 16_384,
			contextWindow: 262_144,
			supportsImages: false,
			supportsReasoningEffort: false,
			supportsPromptCache: true,
			supportsNativeTools: false,
			inputPrice: 0,
			outputPrice: 0,
			isFree: false,
		}

		return {
			id: modelId,
			info: fallbackInfo,
		}
	}
}
