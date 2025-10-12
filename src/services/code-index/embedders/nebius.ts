import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import { MAX_ITEM_TOKENS } from "../constants"
import { t } from "../../../i18n"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

/**
 * Rate limiting configuration for Nebius AI
 * Based on the documented limits:
 * - 600,000 TPM (tokens per minute)
 * - 10,000 RPM (requests per minute)
 */
interface RateLimitState {
	tokensUsed: number
	requestsCount: number
	windowStart: number
}

/**
 * Nebius AI embedder implementation that wraps the OpenAI Compatible embedder
 * with configuration for Nebius AI's embedding API and rate limiting.
 *
 * Supported model:
 * - Qwen/Qwen3-Embedding-8B (dimension: 4096)
 *
 * Rate limits:
 * - 600,000 tokens per minute
 * - 10,000 requests per minute
 *
 * Pricing: $0.01 per 1M tokens
 */
export class NebiusEmbedder implements IEmbedder {
	private readonly openAICompatibleEmbedder: OpenAICompatibleEmbedder
	private static readonly NEBIUS_BASE_URL = "https://api.studio.nebius.com/v1"
	private static readonly DEFAULT_MODEL = "Qwen/Qwen3-Embedding-8B"
	private static readonly MODEL_DIMENSION = 4096
	private static readonly MAX_TOKENS_PER_MINUTE = 600000
	private static readonly MAX_REQUESTS_PER_MINUTE = 10000
	private static readonly RATE_LIMIT_WINDOW_MS = 60000 // 1 minute in milliseconds

	private readonly modelId: string
	private rateLimitState: RateLimitState = {
		tokensUsed: 0,
		requestsCount: 0,
		windowStart: Date.now(),
	}

	/**
	 * Creates a new Nebius AI embedder
	 * @param apiKey The Nebius AI API key for authentication
	 * @param modelId The model ID to use (defaults to Qwen/Qwen3-Embedding-8B)
	 */
	constructor(apiKey: string, modelId?: string) {
		if (!apiKey) {
			throw new Error(t("embeddings:validation.apiKeyRequired"))
		}

		// Use provided model or default
		this.modelId = modelId || NebiusEmbedder.DEFAULT_MODEL

		// Create an OpenAI Compatible embedder with Nebius's configuration
		// Note: MAX_ITEM_TOKENS is the token limit per item, not the embedding dimension
		this.openAICompatibleEmbedder = new OpenAICompatibleEmbedder(
			NebiusEmbedder.NEBIUS_BASE_URL,
			apiKey,
			this.modelId,
			MAX_ITEM_TOKENS,
		)
	}

	/**
	 * Checks and updates rate limit state, implementing a sliding window approach
	 * @returns true if the request can proceed, false if rate limited
	 */
	private checkAndUpdateRateLimit(estimatedTokens: number): boolean {
		const now = Date.now()
		const windowElapsed = now - this.rateLimitState.windowStart

		// Reset the window if a minute has passed
		if (windowElapsed >= NebiusEmbedder.RATE_LIMIT_WINDOW_MS) {
			this.rateLimitState = {
				tokensUsed: 0,
				requestsCount: 0,
				windowStart: now,
			}
		}

		// Check if we would exceed rate limits
		if (this.rateLimitState.requestsCount >= NebiusEmbedder.MAX_REQUESTS_PER_MINUTE) {
			console.warn(
				t("embeddings:nebius.rateLimitExceeded", {
					type: "requests",
					limit: NebiusEmbedder.MAX_REQUESTS_PER_MINUTE,
					window: "minute",
				}),
			)
			return false
		}

		if (this.rateLimitState.tokensUsed + estimatedTokens > NebiusEmbedder.MAX_TOKENS_PER_MINUTE) {
			console.warn(
				t("embeddings:nebius.rateLimitExceeded", {
					type: "tokens",
					limit: NebiusEmbedder.MAX_TOKENS_PER_MINUTE,
					window: "minute",
				}),
			)
			return false
		}

		// Update the state
		this.rateLimitState.tokensUsed += estimatedTokens
		this.rateLimitState.requestsCount += 1

		return true
	}

	/**
	 * Calculates the wait time until rate limits reset
	 * @returns milliseconds to wait, or 0 if no wait needed
	 */
	private getWaitTimeMs(): number {
		const now = Date.now()
		const windowElapsed = now - this.rateLimitState.windowStart
		const remainingTime = NebiusEmbedder.RATE_LIMIT_WINDOW_MS - windowElapsed

		return remainingTime > 0 ? remainingTime : 0
	}

	/**
	 * Creates embeddings for the given texts using Nebius AI's embedding API
	 * with built-in rate limiting for 600k TPM and 10k RPM
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier (uses constructor model if not provided)
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		try {
			// Use the provided model or fall back to the instance's model
			const modelToUse = model || this.modelId

			// Estimate tokens for rate limiting (rough estimate: 1 token ≈ 4 characters)
			const estimatedTokens = texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0)

			// Check rate limits
			if (!this.checkAndUpdateRateLimit(estimatedTokens)) {
				// Wait for the rate limit window to reset
				const waitTime = this.getWaitTimeMs()
				if (waitTime > 0) {
					console.log(
						t("embeddings:nebius.waitingForRateLimit", {
							waitTimeMs: waitTime,
						}),
					)
					await new Promise((resolve) => setTimeout(resolve, waitTime))
					// After waiting, reset the window and try again
					this.rateLimitState = {
						tokensUsed: estimatedTokens,
						requestsCount: 1,
						windowStart: Date.now(),
					}
				}
			}

			// Delegate to the OpenAI-compatible embedder
			const result = await this.openAICompatibleEmbedder.createEmbeddings(texts, modelToUse)

			// Log usage for monitoring (optional)
			if (result.usage) {
				console.debug(
					`Nebius AI embedding usage - Tokens: ${result.usage.totalTokens}, ` +
						`Rate limit status: ${this.rateLimitState.tokensUsed}/${NebiusEmbedder.MAX_TOKENS_PER_MINUTE} TPM, ` +
						`${this.rateLimitState.requestsCount}/${NebiusEmbedder.MAX_REQUESTS_PER_MINUTE} RPM`,
				)
			}

			return result
		} catch (error) {
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "NebiusEmbedder:createEmbeddings",
			})
			throw error
		}
	}

	/**
	 * Validates the Nebius AI embedder configuration by delegating to the underlying OpenAI-compatible embedder
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			// Delegate validation to the OpenAI-compatible embedder
			// The error messages will be specific to Nebius since we're using Nebius's base URL
			return await this.openAICompatibleEmbedder.validateConfiguration()
		} catch (error) {
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "NebiusEmbedder:validateConfiguration",
			})
			throw error
		}
	}

	/**
	 * Returns information about this embedder
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "nebius",
		}
	}

	/**
	 * Gets the model dimension for the Nebius AI model
	 * @returns The embedding dimension (4096 for Qwen/Qwen3-Embedding-8B)
	 */
	static get modelDimension(): number {
		return NebiusEmbedder.MODEL_DIMENSION
	}
}
