import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbedderInfo } from "../interfaces/embedder"
import { getDefaultModelId } from "../../../shared/embeddingModels"
import { MAX_ITEM_TOKENS } from "../constants"
import { t } from "../../../i18n"

/**
 * OpenRouter embedder implementation that wraps the OpenAI Compatible embedder
 * with configuration for OpenRouter's embedding API.
 *
 * Supported models:
 * - openai/text-embedding-3-small (dimension: 1536)
 * - openai/text-embedding-3-large (dimension: 3072)
 * - openai/text-embedding-ada-002 (dimension: 1536)
 * - cohere/embed-english-v3.0 (dimension: 1024)
 * - cohere/embed-multilingual-v3.0 (dimension: 1024)
 * - voyage/voyage-3 (dimension: 1024)
 * - voyage/voyage-3-lite (dimension: 512)
 */
export class OpenRouterEmbedder extends OpenAICompatibleEmbedder implements IEmbedder {
	private static readonly OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
	private static readonly DEFAULT_MODEL = "openai/text-embedding-3-small"
	private readonly modelId: string

	/**
	 * Creates a new OpenRouter embedder
	 * @param apiKey The OpenRouter API key for authentication
	 * @param modelId The model ID to use (defaults to openai/text-embedding-3-small)
	 * @param baseUrl Optional custom base URL for OpenRouter API (defaults to https://openrouter.ai/api/v1)
	 */
	constructor(apiKey?: string, modelId?: string, baseUrl?: string) {
		if (!apiKey) {
			throw new Error(t("embeddings:validation.apiKeyRequired"))
		}

		// Use the provided base URL or default to OpenRouter's API URL
		const openRouterBaseUrl = baseUrl || OpenRouterEmbedder.OPENROUTER_BASE_URL

		// Initialize the parent OpenAI Compatible embedder with OpenRouter configuration
		super(openRouterBaseUrl, apiKey, modelId || OpenRouterEmbedder.DEFAULT_MODEL, MAX_ITEM_TOKENS)

		this.modelId = modelId || getDefaultModelId("openrouter")
	}

	/**
	 * Returns information about this embedder
	 */
	override get embedderInfo(): EmbedderInfo {
		return {
			name: "openrouter",
		}
	}
}
