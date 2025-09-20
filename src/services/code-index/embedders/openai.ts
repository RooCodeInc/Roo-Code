import { OpenAI } from "openai"
import { OpenAiNativeHandler } from "../../../api/providers/openai-native"
import { ApiHandlerOptions } from "../../../shared/api"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces"
import {
	MAX_BATCH_TOKENS,
	MAX_ITEM_TOKENS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
} from "../constants"
import { getModelQueryPrefix } from "../../../shared/embeddingModels"
import { t } from "../../../i18n"
import { withValidationErrorHandling, formatEmbeddingError, HttpError } from "../shared/validation-helpers"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { handleOpenAIError } from "../../../api/providers/utils/openai-error-handler"

/**
 * OpenAI implementation of the embedder interface with batching and rate limiting
 */
export class OpenAiEmbedder extends OpenAiNativeHandler implements IEmbedder {
	private embeddingsClient: OpenAI
	private readonly defaultModelId: string

	/**
	 * Creates a new OpenAI embedder
	 * @param options API handler options
	 */
	constructor(options: ApiHandlerOptions & { openAiEmbeddingModelId?: string }) {
		super(options)
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"

		// Wrap OpenAI client creation to handle invalid API key characters
		try {
			this.embeddingsClient = new OpenAI({ apiKey })
		} catch (error) {
			// Use the error handler to transform ByteString conversion errors
			throw handleOpenAIError(error, "OpenAI")
		}

		this.defaultModelId = options.openAiEmbeddingModelId || "text-embedding-3-small"
	}

	/**
	 * Creates embeddings for the given texts with batching and rate limiting
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.defaultModelId

		// Apply model-specific query prefix if required
		const queryPrefix = getModelQueryPrefix("openai", modelToUse)
		const processedTexts = queryPrefix
			? texts.map((text, index) => {
					// Prevent double-prefixing
					if (text.startsWith(queryPrefix)) {
						return text
					}
					const prefixedText = `${queryPrefix}${text}`
					const estimatedTokens = Math.ceil(prefixedText.length / 4)
					if (estimatedTokens > MAX_ITEM_TOKENS) {
						console.warn(
							t("embeddings:textWithPrefixExceedsTokenLimit", {
								index,
								estimatedTokens,
								maxTokens: MAX_ITEM_TOKENS,
							}),
						)
						// Return original text if adding prefix would exceed limit
						return text
					}
					return prefixedText
				})
			: texts

		const allEmbeddings: number[][] = []
		const usage = { promptTokens: 0, totalTokens: 0 }
		const remainingTexts = [...processedTexts]

		while (remainingTexts.length > 0) {
			const currentBatch: string[] = []
			let currentBatchTokens = 0
			const processedIndices: number[] = []

			for (let i = 0; i < remainingTexts.length; i++) {
				const text = remainingTexts[i]
				const itemTokens = Math.ceil(text.length / 4)

				if (itemTokens > MAX_ITEM_TOKENS) {
					console.warn(
						t("embeddings:textExceedsTokenLimit", {
							index: i,
							itemTokens,
							maxTokens: MAX_ITEM_TOKENS,
						}),
					)
					processedIndices.push(i)
					continue
				}

				if (currentBatchTokens + itemTokens <= MAX_BATCH_TOKENS) {
					currentBatch.push(text)
					currentBatchTokens += itemTokens
					processedIndices.push(i)
				} else {
					break
				}
			}

			// Remove processed items from remainingTexts (in reverse order to maintain correct indices)
			for (let i = processedIndices.length - 1; i >= 0; i--) {
				remainingTexts.splice(processedIndices[i], 1)
			}

			if (currentBatch.length > 0) {
				const batchResult = await this._embedBatchWithRetries(currentBatch, modelToUse)
				allEmbeddings.push(...batchResult.embeddings)
				usage.promptTokens += batchResult.usage.promptTokens
				usage.totalTokens += batchResult.usage.totalTokens
			}
		}

		return { embeddings: allEmbeddings, usage }
	}

	/**
	 * Parses the Retry-After header to determine wait time
	 * @param retryAfter The Retry-After header value
	 * @returns The number of milliseconds to wait, or undefined if not parseable
	 */
	private parseRetryAfter(retryAfter: string | null): number | undefined {
		if (!retryAfter) return undefined

		// Check if it's a delay in seconds (numeric value)
		const seconds = parseInt(retryAfter, 10)
		if (!isNaN(seconds)) {
			return seconds * 1000
		}

		// Check if it's an HTTP-date
		const retryDate = new Date(retryAfter)
		if (!isNaN(retryDate.getTime())) {
			const now = Date.now()
			const delay = retryDate.getTime() - now
			return delay > 0 ? delay : 0
		}

		return undefined
	}

	/**
	 * Extracts rate limit information from OpenAI SDK error
	 * @param error The error from OpenAI SDK
	 * @returns The number of milliseconds to wait, or undefined
	 */
	private extractRateLimitDelay(error: any): number | undefined {
		// OpenAI SDK may include headers in the error object
		if (error?.headers) {
			// Try Retry-After header first
			const retryAfter = error.headers["retry-after"] || error.headers["Retry-After"]
			if (retryAfter) {
				const delay = this.parseRetryAfter(retryAfter)
				if (delay !== undefined) return delay
			}

			// Try X-RateLimit-Reset-After (seconds)
			const resetAfter = error.headers["x-ratelimit-reset-after"] || error.headers["X-RateLimit-Reset-After"]
			if (resetAfter) {
				const seconds = parseInt(resetAfter, 10)
				if (!isNaN(seconds)) {
					return seconds * 1000
				}
			}

			// Try X-RateLimit-Reset (Unix timestamp)
			const resetTimestamp = error.headers["x-ratelimit-reset"] || error.headers["X-RateLimit-Reset"]
			if (resetTimestamp) {
				const timestamp = parseInt(resetTimestamp, 10)
				if (!isNaN(timestamp)) {
					const resetTime = timestamp * 1000 // Convert to milliseconds
					const now = Date.now()
					const delay = resetTime - now
					if (delay > 0) return delay
				}
			}
		}

		// Check if the error response includes retry information
		if (error?.response?.headers) {
			const headers = error.response.headers

			// Try the same header checks on response.headers
			const retryAfter = headers.get?.("retry-after") || headers["retry-after"]
			if (retryAfter) {
				const delay = this.parseRetryAfter(retryAfter)
				if (delay !== undefined) return delay
			}

			const resetAfter = headers.get?.("x-ratelimit-reset-after") || headers["x-ratelimit-reset-after"]
			if (resetAfter) {
				const seconds = parseInt(resetAfter, 10)
				if (!isNaN(seconds)) {
					return seconds * 1000
				}
			}

			const resetTimestamp = headers.get?.("x-ratelimit-reset") || headers["x-ratelimit-reset"]
			if (resetTimestamp) {
				const timestamp = parseInt(resetTimestamp, 10)
				if (!isNaN(timestamp)) {
					const resetTime = timestamp * 1000
					const now = Date.now()
					const delay = resetTime - now
					if (delay > 0) return delay
				}
			}
		}

		return undefined
	}

	/**
	 * Helper method to handle batch embedding with retries and exponential backoff
	 * @param batchTexts Array of texts to embed in this batch
	 * @param model Model identifier to use
	 * @returns Promise resolving to embeddings and usage statistics
	 */
	private async _embedBatchWithRetries(
		batchTexts: string[],
		model: string,
	): Promise<{ embeddings: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
		for (let attempts = 0; attempts < MAX_RETRIES; attempts++) {
			try {
				const response = await this.embeddingsClient.embeddings.create({
					input: batchTexts,
					model: model,
				})

				return {
					embeddings: response.data.map((item) => item.embedding),
					usage: {
						promptTokens: response.usage?.prompt_tokens || 0,
						totalTokens: response.usage?.total_tokens || 0,
					},
				}
			} catch (error: any) {
				const hasMoreAttempts = attempts < MAX_RETRIES - 1

				// Check if it's a rate limit error
				const httpError = error as HttpError
				if (httpError?.status === 429 && hasMoreAttempts) {
					// Try to extract provider-specified delay
					const providerDelay = this.extractRateLimitDelay(error)

					let delayMs: number
					if (providerDelay !== undefined) {
						// Use provider-specified delay with a small buffer
						delayMs = Math.min(providerDelay + 1000, 300000) // Cap at 5 minutes
						console.warn(
							t("embeddings:rateLimitRetry", {
								delayMs,
								attempt: attempts + 1,
								maxRetries: MAX_RETRIES,
							}) + " (using provider-specified delay)",
						)
					} else {
						// Fallback to exponential backoff
						delayMs = INITIAL_DELAY_MS * Math.pow(2, attempts)
						console.warn(
							t("embeddings:rateLimitRetry", {
								delayMs,
								attempt: attempts + 1,
								maxRetries: MAX_RETRIES,
							}) + " (using exponential backoff)",
						)
					}

					await new Promise((resolve) => setTimeout(resolve, delayMs))
					continue
				}

				// Capture telemetry before reformatting the error
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "OpenAiEmbedder:_embedBatchWithRetries",
					attempt: attempts + 1,
				})

				// Log the error for debugging
				console.error(`OpenAI embedder error (attempt ${attempts + 1}/${MAX_RETRIES}):`, error)

				// Format and throw the error
				throw formatEmbeddingError(error, MAX_RETRIES)
			}
		}

		throw new Error(t("embeddings:failedMaxAttempts", { attempts: MAX_RETRIES }))
	}

	/**
	 * Validates the OpenAI embedder configuration by attempting a minimal embedding request
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(async () => {
			try {
				// Test with a minimal embedding request
				const response = await this.embeddingsClient.embeddings.create({
					input: ["test"],
					model: this.defaultModelId,
				})

				// Check if we got a valid response
				if (!response.data || response.data.length === 0) {
					return {
						valid: false,
						error: t("embeddings:openai.invalidResponseFormat"),
					}
				}

				return { valid: true }
			} catch (error) {
				// Capture telemetry for validation errors
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "OpenAiEmbedder:validateConfiguration",
				})
				throw error
			}
		}, "openai")
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "openai",
		}
	}
}
