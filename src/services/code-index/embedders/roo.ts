import { OpenAI } from "openai"
import { CloudService } from "@roo-code/cloud"
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

interface RooEmbeddingResponse {
	data: EmbeddingItem[]
	usage?: {
		prompt_tokens?: number
		total_tokens?: number
	}
}

/**
 * Returns the current session token from CloudService, or "unauthenticated" if unavailable.
 */
function getSessionToken(): string {
	const token = CloudService.hasInstance() ? CloudService.instance.authService?.getSessionToken() : undefined
	return token ?? "unauthenticated"
}

/**
 * Returns the base URL for the Roo Code Router proxy, with /v1 suffix.
 */
function getRooBaseUrl(): string {
	let baseURL = process.env.ROO_CODE_PROVIDER_URL ?? "https://api.roocode.com/proxy"
	if (!baseURL.endsWith("/v1")) {
		baseURL = `${baseURL}/v1`
	}
	return baseURL
}

/**
 * Roo Code Router implementation of the embedder interface with batching and rate limiting.
 * Uses CloudService session token for authentication against the Roo Code proxy,
 * which forwards embedding requests to the underlying model provider (e.g. OpenAI).
 * No third-party API key is required -- users authenticate via Roo Code Cloud.
 */
export class RooEmbedder implements IEmbedder {
	private embeddingsClient: OpenAI
	private readonly defaultModelId: string
	private readonly maxItemTokens: number

	// Global rate limiting state shared across all instances
	private static globalRateLimitState = {
		isRateLimited: false,
		rateLimitResetTime: 0,
		consecutiveRateLimitErrors: 0,
		lastRateLimitError: 0,
		mutex: new Mutex(),
	}

	/**
	 * Creates a new Roo Code Router embedder.
	 * Authentication is handled via CloudService session token.
	 * @param modelId Optional model identifier (defaults to "text-embedding-3-small")
	 * @param maxItemTokens Optional maximum tokens per item (defaults to MAX_ITEM_TOKENS)
	 */
	constructor(modelId?: string, maxItemTokens?: number) {
		const sessionToken = getSessionToken()
		const baseURL = getRooBaseUrl()

		try {
			this.embeddingsClient = new OpenAI({
				baseURL,
				apiKey: sessionToken,
				defaultHeaders: {
					"HTTP-Referer": "https://github.com/RooCodeInc/Roo-Code",
					"X-Title": "Roo Code",
				},
			})
		} catch (error) {
			throw handleOpenAIError(error, "Roo Code Cloud")
		}

		this.defaultModelId = modelId || getDefaultModelId("roo")
		this.maxItemTokens = maxItemTokens || MAX_ITEM_TOKENS
	}

	/**
	 * Creates embeddings for the given texts with batching and rate limiting.
	 * Refreshes the session token before each top-level call to ensure freshness.
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		// Refresh API key to use the latest session token
		this.embeddingsClient.apiKey = getSessionToken()

		const modelToUse = model || this.defaultModelId

		// Apply model-specific query prefix if required
		const queryPrefix = getModelQueryPrefix("roo", modelToUse)
		const processedTexts = queryPrefix
			? texts.map((text, index) => {
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
	 * Helper method to handle batch embedding with retries and exponential backoff.
	 * Refreshes the session token on each retry attempt.
	 */
	private async _embedBatchWithRetries(
		batchTexts: string[],
		model: string,
	): Promise<{ embeddings: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
		for (let attempts = 0; attempts < MAX_RETRIES; attempts++) {
			await this.waitForGlobalRateLimit()

			// Refresh token on each attempt
			this.embeddingsClient.apiKey = getSessionToken()

			try {
				const requestParams: any = {
					input: batchTexts,
					model: model,
					// Request base64 encoding to bypass the OpenAI package's parser
					// which truncates embedding dimensions to 256 for numeric arrays.
					encoding_format: "base64",
				}

				const response = (await this.embeddingsClient.embeddings.create(requestParams)) as RooEmbeddingResponse

				// Convert base64 embeddings to float32 arrays
				const processedEmbeddings = response.data.map((item: EmbeddingItem) => {
					if (typeof item.embedding === "string") {
						const buffer = Buffer.from(item.embedding, "base64")
						const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)
						return {
							...item,
							embedding: Array.from(float32Array),
						}
					}
					return item
				})

				response.data = processedEmbeddings

				const embeddings = response.data.map((item) => item.embedding as number[])

				return {
					embeddings,
					usage: {
						promptTokens: response.usage?.prompt_tokens || 0,
						totalTokens: response.usage?.total_tokens || 0,
					},
				}
			} catch (error) {
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "RooEmbedder:_embedBatchWithRetries",
					attempt: attempts + 1,
				})

				const hasMoreAttempts = attempts < MAX_RETRIES - 1

				const httpError = error as HttpError
				if (httpError?.status === 429) {
					await this.updateGlobalRateLimitState(httpError)

					if (hasMoreAttempts) {
						const baseDelay = INITIAL_DELAY_MS * Math.pow(2, attempts)
						const globalDelay = await this.getGlobalRateLimitDelay()
						const delayMs = Math.max(baseDelay, globalDelay)

						console.warn(
							t("embeddings:rateLimitRetry", {
								delayMs,
								attempt: attempts + 1,
								maxRetries: MAX_RETRIES,
							}),
						)
						await new Promise((resolve) => setTimeout(resolve, delayMs))
						continue
					}
				}

				console.error(`Roo embedder error (attempt ${attempts + 1}/${MAX_RETRIES}):`, error)
				throw formatEmbeddingError(error, MAX_RETRIES)
			}
		}

		throw new Error(t("embeddings:failedMaxAttempts", { attempts: MAX_RETRIES }))
	}

	/**
	 * Validates the Roo embedder configuration by testing API connectivity.
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(async () => {
			// Refresh token before validation
			this.embeddingsClient.apiKey = getSessionToken()

			try {
				const testTexts = ["test"]
				const modelToUse = this.defaultModelId

				const requestParams: any = {
					input: testTexts,
					model: modelToUse,
					encoding_format: "base64",
				}

				const response = (await this.embeddingsClient.embeddings.create(requestParams)) as RooEmbeddingResponse

				if (!response?.data || response.data.length === 0) {
					return {
						valid: false,
						error: "embeddings:validation.invalidResponse",
					}
				}

				return { valid: true }
			} catch (error) {
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "RooEmbedder:validateConfiguration",
				})
				throw error
			}
		}, "roo")
	}

	/**
	 * Returns information about this embedder.
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "roo",
		}
	}

	/**
	 * Waits if there's an active global rate limit.
	 */
	private async waitForGlobalRateLimit(): Promise<void> {
		const release = await RooEmbedder.globalRateLimitState.mutex.acquire()
		let mutexReleased = false

		try {
			const state = RooEmbedder.globalRateLimitState

			if (state.isRateLimited && state.rateLimitResetTime > Date.now()) {
				const waitTime = state.rateLimitResetTime - Date.now()
				release()
				mutexReleased = true
				await new Promise((resolve) => setTimeout(resolve, waitTime))
				return
			}

			if (state.isRateLimited && state.rateLimitResetTime <= Date.now()) {
				state.isRateLimited = false
				state.consecutiveRateLimitErrors = 0
			}
		} finally {
			if (!mutexReleased) {
				release()
			}
		}
	}

	/**
	 * Updates global rate limit state when a 429 error occurs.
	 */
	private async updateGlobalRateLimitState(error: HttpError): Promise<void> {
		const release = await RooEmbedder.globalRateLimitState.mutex.acquire()
		try {
			const state = RooEmbedder.globalRateLimitState
			const now = Date.now()

			if (now - state.lastRateLimitError < 60000) {
				state.consecutiveRateLimitErrors++
			} else {
				state.consecutiveRateLimitErrors = 1
			}

			state.lastRateLimitError = now

			const baseDelay = 5000
			const maxDelay = 300000
			const exponentialDelay = Math.min(baseDelay * Math.pow(2, state.consecutiveRateLimitErrors - 1), maxDelay)

			state.isRateLimited = true
			state.rateLimitResetTime = now + exponentialDelay
		} finally {
			release()
		}
	}

	/**
	 * Gets the current global rate limit delay.
	 */
	private async getGlobalRateLimitDelay(): Promise<number> {
		const release = await RooEmbedder.globalRateLimitState.mutex.acquire()
		try {
			const state = RooEmbedder.globalRateLimitState

			if (state.isRateLimited && state.rateLimitResetTime > Date.now()) {
				return state.rateLimitResetTime - Date.now()
			}

			return 0
		} finally {
			release()
		}
	}
}
