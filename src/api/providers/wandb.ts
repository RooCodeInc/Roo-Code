import { Anthropic } from "@anthropic-ai/sdk"

import { type WandbModelId, wandbDefaultModelId, wandbModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { XmlMatcher } from "../../utils/xml-matcher"

import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import { BaseProvider } from "./base-provider"
import { DEFAULT_HEADERS } from "./constants"
import { t } from "../../i18n"

const WANDB_BASE_URL = "https://api.inference.wandb.ai/v1"
const WANDB_DEFAULT_TEMPERATURE = 0

/**
 * Removes thinking tokens from text to prevent model confusion when processing conversation history.
 * This is crucial because models can get confused by their own thinking tokens in input.
 */
function stripThinkingTokens(text: string): string {
	// Remove <think>...</think> blocks entirely, including nested ones
	return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim()
}

/**
 * Flattens OpenAI message content to simple strings that W&B can handle.
 * W&B follows OpenAI API format but may have limitations on complex content arrays.
 */
function flattenMessageContent(content: any): string {
	if (typeof content === "string") {
		return content
	}

	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === "string") {
					return part
				}
				if (part.type === "text") {
					return part.text || ""
				}
				if (part.type === "image_url") {
					// Some W&B models support vision, so we preserve image references
					return part.image_url?.url ? `[Image: ${part.image_url.url}]` : "[Image]"
				}
				return ""
			})
			.filter(Boolean)
			.join("\n")
	}

	// Fallback for any other content types
	return String(content || "")
}

/**
 * Converts OpenAI messages to W&B-compatible format with proper content handling.
 * Also strips thinking tokens from assistant messages to prevent model confusion.
 */
function convertToWandbMessages(openaiMessages: any[]): Array<{ role: string; content: string }> {
	return openaiMessages
		.map((msg) => {
			let content = flattenMessageContent(msg.content)

			// Strip thinking tokens from assistant messages to prevent confusion
			if (msg.role === "assistant") {
				content = stripThinkingTokens(content)
			}

			return {
				role: msg.role,
				content,
			}
		})
		.filter((msg) => msg.content.trim() !== "") // Remove empty messages
}

export class WandbHandler extends BaseProvider implements SingleCompletionHandler {
	private apiKey: string
	private providerModels: typeof wandbModels
	private defaultProviderModelId: WandbModelId
	private options: ApiHandlerOptions
	private lastUsage: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 }

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.apiKey = options.wandbApiKey || ""
		this.providerModels = wandbModels
		this.defaultProviderModelId = wandbDefaultModelId

		if (!this.apiKey) {
			throw new Error("Weights & Biases API key is required")
		}
	}

	getModel(): { id: WandbModelId; info: (typeof wandbModels)[WandbModelId] } {
		const modelId = (this.options.apiModelId as WandbModelId) || this.defaultProviderModelId

		return {
			id: modelId,
			info: this.providerModels[modelId],
		}
	}

	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const {
			id: model,
			info: { maxTokens: max_tokens },
		} = this.getModel()
		const temperature = this.options.modelTemperature ?? WANDB_DEFAULT_TEMPERATURE

		// Convert Anthropic messages to OpenAI format, then flatten for W&B
		// This will automatically strip thinking tokens from assistant messages
		const openaiMessages = convertToOpenAiMessages(messages)
		const wandbMessages = convertToWandbMessages(openaiMessages)

		// Prepare request body following W&B API specification (OpenAI-compatible)
		const requestBody = {
			model,
			messages: [{ role: "system", content: systemPrompt }, ...wandbMessages],
			stream: true,
			// Use max_tokens (OpenAI-compatible parameter)
			...(max_tokens && max_tokens > 0 ? { max_tokens } : {}),
			// Temperature handling
			...(temperature !== undefined && temperature !== WANDB_DEFAULT_TEMPERATURE
				? {
						temperature: Math.max(0, Math.min(2, temperature)), // W&B typically supports 0-2 range
					}
				: {}),
		}

		try {
			const response = await fetch(`${WANDB_BASE_URL}/chat/completions`, {
				method: "POST",
				headers: {
					...DEFAULT_HEADERS,
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const errorText = await response.text()

				let errorMessage = "Unknown error"
				try {
					const errorJson = JSON.parse(errorText)
					errorMessage = errorJson.error?.message || errorJson.message || JSON.stringify(errorJson, null, 2)
				} catch {
					errorMessage = errorText || `HTTP ${response.status}`
				}

				// Provide more actionable error messages
				if (response.status === 401) {
					throw new Error(t("common:errors.wandb.authenticationFailed"))
				} else if (response.status === 403) {
					throw new Error(t("common:errors.wandb.accessForbidden"))
				} else if (response.status === 429) {
					throw new Error(t("common:errors.wandb.rateLimitExceeded"))
				} else if (response.status >= 500) {
					throw new Error(t("common:errors.wandb.serverError", { status: response.status }))
				} else {
					throw new Error(
						t("common:errors.wandb.genericError", { status: response.status, message: errorMessage }),
					)
				}
			}

			if (!response.body) {
				throw new Error(t("common:errors.wandb.noResponseBody"))
			}

			// Initialize XmlMatcher to parse <think>...</think> tags for reasoning models
			const matcher = new XmlMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ""
			let inputTokens = 0
			let outputTokens = 0

			try {
				while (true) {
					const { done, value } = await reader.read()
					if (done) break

					buffer += decoder.decode(value, { stream: true })
					const lines = buffer.split("\n")
					buffer = lines.pop() || "" // Keep the last incomplete line in the buffer

					for (const line of lines) {
						if (line.trim() === "") continue

						try {
							if (line.startsWith("data: ")) {
								const jsonStr = line.slice(6).trim()
								if (jsonStr === "[DONE]") {
									continue
								}

								const parsed = JSON.parse(jsonStr)

								// Handle text content - parse for thinking tokens
								if (parsed.choices?.[0]?.delta?.content) {
									const content = parsed.choices[0].delta.content

									// Use XmlMatcher to parse <think>...</think> tags
									for (const chunk of matcher.update(content)) {
										yield chunk
									}
								}

								// Handle usage information if available
								if (parsed.usage) {
									inputTokens = parsed.usage.prompt_tokens || 0
									outputTokens = parsed.usage.completion_tokens || 0
								}
							}
						} catch (error) {
							// Silently ignore malformed streaming data lines
						}
					}
				}
			} finally {
				reader.releaseLock()
			}

			// Process any remaining content in the matcher
			for (const chunk of matcher.final()) {
				yield chunk
			}

			// Provide token usage estimate if not available from API
			if (inputTokens === 0 || outputTokens === 0) {
				const inputText = systemPrompt + wandbMessages.map((m) => m.content).join("")
				inputTokens = inputTokens || Math.ceil(inputText.length / 4) // Rough estimate: 4 chars per token
				outputTokens = outputTokens || Math.ceil((max_tokens || 1000) / 10) // Rough estimate
			}

			// Store usage for cost calculation
			this.lastUsage = { inputTokens, outputTokens }

			yield {
				type: "usage",
				inputTokens,
				outputTokens,
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(t("common:errors.wandb.completionError", { error: error.message }))
			}
			throw error
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: model } = this.getModel()

		// Prepare request body for non-streaming completion
		const requestBody = {
			model,
			messages: [{ role: "user", content: prompt }],
			stream: false,
		}

		try {
			const response = await fetch(`${WANDB_BASE_URL}/chat/completions`, {
				method: "POST",
				headers: {
					...DEFAULT_HEADERS,
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const errorText = await response.text()

				// Provide consistent error handling with createMessage
				if (response.status === 401) {
					throw new Error(t("common:errors.wandb.authenticationFailed"))
				} else if (response.status === 403) {
					throw new Error(t("common:errors.wandb.accessForbidden"))
				} else if (response.status === 429) {
					throw new Error(t("common:errors.wandb.rateLimitExceeded"))
				} else if (response.status >= 500) {
					throw new Error(t("common:errors.wandb.serverError", { status: response.status }))
				} else {
					throw new Error(
						t("common:errors.wandb.genericError", { status: response.status, message: errorText }),
					)
				}
			}

			const result = await response.json()
			return result.choices?.[0]?.message?.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(t("common:errors.wandb.completionError", { error: error.message }))
			}
			throw error
		}
	}

	getApiCost(metadata: ApiHandlerCreateMessageMetadata): number {
		const { info } = this.getModel()
		// Use actual token usage from the last request
		const { inputTokens, outputTokens } = this.lastUsage
		return calculateApiCostOpenAI(info, inputTokens, outputTokens)
	}
}
