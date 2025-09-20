import { OpenAI } from "openai"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import {
	MAX_BATCH_TOKENS,
	MAX_ITEM_TOKENS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
} from "../constants"
import { getDefaultModelId, getModelQueryPrefix } from "../../../shared/embeddingModels"
import { t } from "../../../i18n"
import { withValidationErrorHandling, HttpError, formatEmbeddingError } from "../shared/validation-helpers"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { Mutex } from "async-mutex"
import { handleOpenAIError } from "../../../api/providers/utils/openai-error-handler"

interface EmbeddingItem {
	embedding: string | number[]
	[key: string]: any
}

interface OpenAIEmbeddingResponse {
	data: EmbeddingItem[]
	usage?: {
		prompt_tokens?: number
		total_tokens?: number
	}
}

interface RateLimitInfo {
	retryAfterMs?: number
	retryAfterDate?: Date
}

/**
 * OpenAI Compatible implementation of the embedder interface with batching and rate limiting.
 * This embedder allows using any OpenAI-compatible API endpoint by specifying a custom baseURL.
 */

export class OpenAICompatibleEmbedder implements IEmbedder {
	private embeddingsClient: OpenAI
	private readonly defaultModelId: string
	private readonly baseUrl: string
	private readonly apiKey: string
	private readonly isFullUrl: boolean
	private readonly maxItemTokens: number

	// Global rate limiting state shared across all instances
	private static globalRateLimitState = {
		isRateLimited: false,
		rateLimitResetTime: 0,
		consecutiveRateLimitErrors: 0,
		lastRateLimitError: 0,
		// Mutex to ensure thread-safe access to rate limit state
		mutex: new Mutex(),
	}

	/**
	 * Creates a new OpenAI Compatible embedder
	 * @param baseUrl The base URL for the OpenAI-compatible API endpoint
	 * @param apiKey The API key for authentication
	 * @param modelId Optional model identifier (defaults to "text-embedding-3-small")
	 * @param maxItemTokens Optional maximum tokens per item (defaults to MAX_ITEM_TOKENS)
	 */
	constructor(baseUrl: string, apiKey: string, modelId?: string, maxItemTokens?: number) {
		if (!baseUrl) {
			throw new Error(t("embeddings:validation.baseUrlRequired"))
		}
		if (!apiKey) {
			throw new Error(t("embeddings:validation.apiKeyRequired"))
		}

		this.baseUrl = baseUrl
		this.apiKey = apiKey

		// Wrap OpenAI client creation to handle invalid API key characters
		try {
			this.embeddingsClient = new OpenAI({
				baseURL: baseUrl,
				apiKey: apiKey,
			})
		} catch (error) {
			// Use the error handler to transform ByteString conversion errors
			throw handleOpenAIError(error, "OpenAI Compatible")
		}

		this.defaultModelId = modelId || getDefaultModelId("openai-compatible")
		// Cache the URL type check for performance
		this.isFullUrl = this.isFullEndpointUrl(baseUrl)
		this.maxItemTokens = maxItemTokens || MAX_ITEM_TOKENS
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
		const queryPrefix = getModelQueryPrefix("openai-compatible", modelToUse)
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

				if (itemTokens > this.maxItemTokens) {
					console.warn(
						t("embeddings:textExceedsTokenLimit", {
							index: i,
							itemTokens,
							maxTokens: this.maxItemTokens,
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
	 * Determines if the provided URL is a full endpoint URL or a base URL that needs the endpoint appended by the SDK.
	 * Uses smart pattern matching for known providers while accepting we can't cover all possible patterns.
	 * @param url The URL to check
	 * @returns true if it's a full endpoint URL, false if it's a base URL
	 */
	private isFullEndpointUrl(url: string): boolean {
		// Known patterns for major providers
		const patterns = [
			// Azure OpenAI: /deployments/{deployment-name}/embeddings
			/\/deployments\/[^\/]+\/embeddings(\?|$)/,
			// Azure Databricks: /serving-endpoints/{endpoint-name}/invocations
			/\/serving-endpoints\/[^\/]+\/invocations(\?|$)/,
			// Direct endpoints: ends with /embeddings (before query params)
			/\/embeddings(\?|$)/,
			// Some providers use /embed instead of /embeddings
			/\/embed(\?|$)/,
		]

		return patterns.some((pattern) => pattern.test(url))
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
	 * Extracts rate limit information from response headers and body
	 * @param response The fetch Response object
	 * @param errorBody Optional error response body for providers that include retry info there
	 * @returns Rate limit information if available
	 */
	private extractRateLimitInfo(response: Response | null, errorBody?: any): RateLimitInfo {
		const info: RateLimitInfo = {}

		if (!response) return info

		// Helper function to safely get header value
		const getHeader = (name: string): string | null => {
			if (response.headers) {
				// Check if it's a proper Headers object with get method
				if (typeof response.headers.get === "function") {
					return response.headers.get(name)
				}
				// Check if it's a plain object
				if (typeof response.headers === "object") {
					return (response.headers as any)[name] || null
				}
			}
			return null
		}

		// Standard Retry-After header (used by most providers)
		const retryAfter = getHeader("retry-after")
		if (retryAfter) {
			const delayMs = this.parseRetryAfter(retryAfter)
			if (delayMs !== undefined) {
				info.retryAfterMs = delayMs
			}
		}

		// X-RateLimit-Reset-After header (used by some providers like Anthropic)
		const resetAfter = getHeader("x-ratelimit-reset-after")
		if (resetAfter) {
			const seconds = parseInt(resetAfter, 10)
			if (!isNaN(seconds)) {
				info.retryAfterMs = seconds * 1000
			}
		}

		// X-RateLimit-Reset header (Unix timestamp)
		const resetTimestamp = getHeader("x-ratelimit-reset")
		if (resetTimestamp) {
			const timestamp = parseInt(resetTimestamp, 10)
			if (!isNaN(timestamp)) {
				const resetTime = timestamp * 1000 // Convert to milliseconds
				const now = Date.now()
				const delay = resetTime - now
				if (delay > 0) {
					info.retryAfterMs = delay
				}
			}
		}

		// Check for Gemini-specific retry information in error body
		if (errorBody && typeof errorBody === "object") {
			// Gemini may include retry information in the error response
			if (errorBody.error?.details) {
				for (const detail of errorBody.error.details) {
					if (detail.metadata?.retry_delay) {
						// Parse duration string like "10s" or "1m"
						const delay = this.parseDurationString(detail.metadata.retry_delay)
						if (delay) {
							info.retryAfterMs = delay
						}
					}
				}
			}
		}

		return info
	}

	/**
	 * Parses duration strings like "10s", "1m", "1h" to milliseconds
	 * @param duration Duration string
	 * @returns Duration in milliseconds or undefined
	 */
	private parseDurationString(duration: string): number | undefined {
		if (!duration || typeof duration !== "string") return undefined

		const match = duration.match(/^(\d+)([smh])$/)
		if (!match) return undefined

		const value = parseInt(match[1], 10)
		const unit = match[2]

		switch (unit) {
			case "s":
				return value * 1000
			case "m":
				return value * 60 * 1000
			case "h":
				return value * 60 * 60 * 1000
			default:
				return undefined
		}
	}

	/**
	 * Makes a direct HTTP request to the embeddings endpoint
	 * Used when the user provides a full endpoint URL (e.g., Azure OpenAI with query parameters)
	 * @param url The full endpoint URL
	 * @param batchTexts Array of texts to embed
	 * @param model Model identifier to use
	 * @returns Promise resolving to OpenAI-compatible response
	 */
	private async makeDirectEmbeddingRequest(
		url: string,
		batchTexts: string[],
		model: string,
	): Promise<OpenAIEmbeddingResponse> {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				// Azure OpenAI uses 'api-key' header, while OpenAI uses 'Authorization'
				// We'll try 'api-key' first for Azure compatibility
				"api-key": this.apiKey,
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				input: batchTexts,
				model: model,
				encoding_format: "base64",
			}),
		})

		if (!response || !response.ok) {
			const status = response?.status || 0
			let errorText = "No response"
			let errorBody: any
			try {
				if (response && typeof response.text === "function") {
					errorText = await response.text()
					// Try to parse as JSON for structured error info
					try {
						errorBody = JSON.parse(errorText)
					} catch {
						// Not JSON, keep as text
					}
				} else if (response) {
					errorText = `Error ${status}`
				}
			} catch {
				// Ignore text parsing errors
				errorText = `Error ${status}`
			}
			const error = new Error(`HTTP ${status}: ${errorText}`) as HttpError & { rateLimitInfo?: RateLimitInfo }
			error.status = status || response?.status || 0

			// Extract rate limit info if this is a 429 error
			if (status === 429) {
				error.rateLimitInfo = this.extractRateLimitInfo(response, errorBody)
			}

			throw error
		}

		try {
			return await response.json()
		} catch (e) {
			const error = new Error(`Failed to parse response JSON`) as HttpError
			error.status = response.status
			throw error
		}
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
		// Use cached value for performance
		const isFullUrl = this.isFullUrl

		for (let attempts = 0; attempts < MAX_RETRIES; attempts++) {
			// Check global rate limit before attempting request
			await this.waitForGlobalRateLimit()

			try {
				let response: OpenAIEmbeddingResponse
				let rateLimitInfo: RateLimitInfo | undefined

				if (isFullUrl) {
					// Use direct HTTP request for full endpoint URLs
					response = await this.makeDirectEmbeddingRequest(this.baseUrl, batchTexts, model)
				} else {
					// Use OpenAI SDK for base URLs
					try {
						response = (await this.embeddingsClient.embeddings.create({
							input: batchTexts,
							model: model,
							// OpenAI package (as of v4.78.1) has a parsing issue that truncates embedding dimensions to 256
							// when processing numeric arrays, which breaks compatibility with models using larger dimensions.
							// By requesting base64 encoding, we bypass the package's parser and handle decoding ourselves.
							encoding_format: "base64",
						})) as OpenAIEmbeddingResponse
					} catch (sdkError: any) {
						// Extract rate limit info from SDK errors
						if (sdkError?.status === 429) {
							// The OpenAI SDK may include headers in the error
							if (sdkError.headers) {
								const mockResponse = {
									headers: new Map(Object.entries(sdkError.headers)),
								} as any
								rateLimitInfo = this.extractRateLimitInfo(mockResponse, sdkError.error)
							}
							// Re-throw with rate limit info attached
							const error = sdkError as HttpError & { rateLimitInfo?: RateLimitInfo }
							error.rateLimitInfo = rateLimitInfo
						}
						throw sdkError
					}
				}

				// Convert base64 embeddings to float32 arrays
				const processedEmbeddings = response.data.map((item: EmbeddingItem) => {
					if (typeof item.embedding === "string") {
						const buffer = Buffer.from(item.embedding, "base64")

						// Create Float32Array view over the buffer
						const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)

						return {
							...item,
							embedding: Array.from(float32Array),
						}
					}
					return item
				})

				// Replace the original data with processed embeddings
				response.data = processedEmbeddings

				const embeddings = response.data.map((item) => item.embedding as number[])

				return {
					embeddings: embeddings,
					usage: {
						promptTokens: response.usage?.prompt_tokens || 0,
						totalTokens: response.usage?.total_tokens || 0,
					},
				}
			} catch (error: any) {
				// Capture telemetry before error is reformatted
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "OpenAICompatibleEmbedder:_embedBatchWithRetries",
					attempt: attempts + 1,
				})

				const hasMoreAttempts = attempts < MAX_RETRIES - 1

				// Check if it's a rate limit error
				const httpError = error as HttpError & { rateLimitInfo?: RateLimitInfo }
				if (httpError?.status === 429) {
					// Update global rate limit state with provider-specific retry info
					await this.updateGlobalRateLimitState(httpError)

					if (hasMoreAttempts) {
						// Calculate delay based on provider guidance or fallback
						let delayMs: number

						if (httpError.rateLimitInfo?.retryAfterMs) {
							// Use provider-specified delay
							delayMs = httpError.rateLimitInfo.retryAfterMs
							console.warn(
								t("embeddings:rateLimitRetry", {
									delayMs,
									attempt: attempts + 1,
									maxRetries: MAX_RETRIES,
								}) + " (using provider-specified delay)",
							)
						} else {
							// Fallback to exponential backoff
							const baseDelay = INITIAL_DELAY_MS * Math.pow(2, attempts)
							const globalDelay = await this.getGlobalRateLimitDelay()
							delayMs = Math.max(baseDelay, globalDelay)
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
				}

				// Log the error for debugging
				console.error(`OpenAI Compatible embedder error (attempt ${attempts + 1}/${MAX_RETRIES}):`, error)

				// Format and throw the error
				throw formatEmbeddingError(error, MAX_RETRIES)
			}
		}

		throw new Error(t("embeddings:failedMaxAttempts", { attempts: MAX_RETRIES }))
	}

	/**
	 * Validates the OpenAI-compatible embedder configuration by testing endpoint connectivity and API key
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(async () => {
			try {
				// Test with a minimal embedding request
				const testTexts = ["test"]
				const modelToUse = this.defaultModelId

				let response: OpenAIEmbeddingResponse

				if (this.isFullUrl) {
					// Test direct HTTP request for full endpoint URLs
					response = await this.makeDirectEmbeddingRequest(this.baseUrl, testTexts, modelToUse)
				} else {
					// Test using OpenAI SDK for base URLs
					response = (await this.embeddingsClient.embeddings.create({
						input: testTexts,
						model: modelToUse,
						encoding_format: "base64",
					})) as OpenAIEmbeddingResponse
				}

				// Check if we got a valid response
				if (!response?.data || response.data.length === 0) {
					return {
						valid: false,
						error: "embeddings:validation.invalidResponse",
					}
				}

				return { valid: true }
			} catch (error) {
				// Capture telemetry for validation errors
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "OpenAICompatibleEmbedder:validateConfiguration",
				})
				throw error
			}
		}, "openai-compatible")
	}

	/**
	 * Returns information about this embedder
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "openai-compatible",
		}
	}

	/**
	 * Waits if there's an active global rate limit
	 */
	private async waitForGlobalRateLimit(): Promise<void> {
		const release = await OpenAICompatibleEmbedder.globalRateLimitState.mutex.acquire()
		try {
			const state = OpenAICompatibleEmbedder.globalRateLimitState

			if (state.isRateLimited && state.rateLimitResetTime > Date.now()) {
				const waitTime = state.rateLimitResetTime - Date.now()
				// Silent wait - no logging to prevent flooding
				release() // Release mutex before waiting
				await new Promise((resolve) => setTimeout(resolve, waitTime))
				return
			}

			// Reset rate limit if time has passed
			if (state.isRateLimited && state.rateLimitResetTime <= Date.now()) {
				state.isRateLimited = false
				state.consecutiveRateLimitErrors = 0
			}
		} finally {
			// Only release if we haven't already
			try {
				release()
			} catch {
				// Already released
			}
		}
	}

	/**
	 * Updates global rate limit state when a 429 error occurs
	 */
	private async updateGlobalRateLimitState(error: HttpError & { rateLimitInfo?: RateLimitInfo }): Promise<void> {
		const release = await OpenAICompatibleEmbedder.globalRateLimitState.mutex.acquire()
		try {
			const state = OpenAICompatibleEmbedder.globalRateLimitState
			const now = Date.now()

			// Increment consecutive rate limit errors
			if (now - state.lastRateLimitError < 60000) {
				// Within 1 minute
				state.consecutiveRateLimitErrors++
			} else {
				state.consecutiveRateLimitErrors = 1
			}

			state.lastRateLimitError = now

			let delay: number

			// Prefer provider-specified delay if available
			if (error.rateLimitInfo?.retryAfterMs) {
				delay = error.rateLimitInfo.retryAfterMs
				// Add a small buffer to avoid hitting the limit immediately
				delay = Math.min(delay + 1000, 300000) // Cap at 5 minutes
			} else {
				// Fallback to exponential backoff
				const baseDelay = 5000 // 5 seconds base
				const maxDelay = 300000 // 5 minutes max
				delay = Math.min(baseDelay * Math.pow(2, state.consecutiveRateLimitErrors - 1), maxDelay)
			}

			// Set global rate limit
			state.isRateLimited = true
			state.rateLimitResetTime = now + delay

			// Silent rate limit activation - no logging to prevent flooding
		} finally {
			release()
		}
	}

	/**
	 * Gets the current global rate limit delay
	 */
	private async getGlobalRateLimitDelay(): Promise<number> {
		const release = await OpenAICompatibleEmbedder.globalRateLimitState.mutex.acquire()
		try {
			const state = OpenAICompatibleEmbedder.globalRateLimitState

			if (state.isRateLimited && state.rateLimitResetTime > Date.now()) {
				return state.rateLimitResetTime - Date.now()
			}

			return 0
		} finally {
			release()
		}
	}
}
