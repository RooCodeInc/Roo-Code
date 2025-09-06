import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import { GEMINI_MAX_ITEM_TOKENS } from "../constants"
import { t } from "../../../i18n"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

/**
 * Gemini embedder implementation that wraps the OpenAI Compatible embedder
 * with configuration for Google's Gemini embedding API.
 *
 * Supported models:
 * - text-embedding-004 (dimension: 768)
 * - gemini-embedding-001 (dimension: 2048)
 */
export class GeminiEmbedder implements IEmbedder {
	private readonly openAICompatibleEmbedder: OpenAICompatibleEmbedder
	private static readonly GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
	private static readonly DEFAULT_MODEL = "gemini-embedding-001"
	private readonly modelId: string

	/**
	 * Creates a new Gemini embedder
	 * @param apiKey The Gemini API key for authentication
	 * @param modelId The model ID to use (defaults to gemini-embedding-001)
	 */
	constructor(apiKey: string, modelId?: string) {
		if (!apiKey) {
			throw new Error(t("embeddings:validation.apiKeyRequired"))
		}

		// Use provided model or default
		this.modelId = modelId || GeminiEmbedder.DEFAULT_MODEL

		// Create an OpenAI Compatible embedder with Gemini's configuration
		this.openAICompatibleEmbedder = new OpenAICompatibleEmbedder(
			GeminiEmbedder.GEMINI_BASE_URL,
			apiKey,
			this.modelId,
			GEMINI_MAX_ITEM_TOKENS,
		)
	}

	/**
	 * Creates embeddings for the given texts using Gemini's embedding API
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier (uses constructor model if not provided)
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		try {
			// Use the provided model or fall back to the instance's model
			const modelToUse = model || this.modelId
			return await this.openAICompatibleEmbedder.createEmbeddings(texts, modelToUse)
		} catch (error) {
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "GeminiEmbedder:createEmbeddings",
			})
			throw error
		}
	}

	/**
	 * Validates the Gemini embedder configuration by delegating to the underlying OpenAI-compatible embedder
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			// Delegate validation to the OpenAI-compatible embedder
			const result = await this.openAICompatibleEmbedder.validateConfiguration()

			// If validation failed, enhance the error message with Gemini-specific guidance
			if (!result.valid && result.error) {
				// Check for common Gemini-specific issues
				if (
					result.error.includes("401") ||
					result.error.includes("403") ||
					result.error.includes("Authentication")
				) {
					result.error = `${result.error}. For Gemini, ensure you have a valid API key from Google AI Studio (makersuite.google.com/app/apikey) and that it's correctly configured.`
				} else if (result.error.includes("404") || result.error.includes("model")) {
					result.error = `${result.error}. Supported Gemini models: text-embedding-004 (dimension: 768), gemini-embedding-001 (dimension: 2048).`
				} else if (result.error.includes("connection") || result.error.includes("host")) {
					result.error = `${result.error}. Gemini API endpoint: ${GeminiEmbedder.GEMINI_BASE_URL}`
				}
			}

			return result
		} catch (error) {
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "GeminiEmbedder:validateConfiguration",
				modelId: this.modelId,
			})

			// Provide a more informative error message
			const errorMessage = error instanceof Error ? error.message : String(error)
			return {
				valid: false,
				error: `Gemini embedder validation failed: ${errorMessage}. Please check your API key and model configuration (current model: ${this.modelId}).`,
			}
		}
	}

	/**
	 * Returns information about this embedder
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "gemini",
		}
	}
}
