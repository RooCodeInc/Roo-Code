import type { EmbeddingPurpose } from "@roo-code/types"

/**
 * Interface for code index embedders.
 * This interface is implemented by both OpenAI and Ollama embedders.
 */
export interface IEmbedder {
	/**
	 * Creates embeddings for the given texts.
	 * @param texts Array of text strings to create embeddings for
	 * @param model Optional model ID to use for embeddings
	 * @param purpose Optional embedding purpose ("index" for document indexing, "query" for search queries).
	 *   When "index", the model's documentPrefix is applied (if any).
	 *   When "query" or undefined, the model's queryPrefix is applied (if any) for backward compatibility.
	 * @returns Promise resolving to an EmbeddingResponse
	 */
	createEmbeddings(texts: string[], model?: string, purpose?: EmbeddingPurpose): Promise<EmbeddingResponse>

	/**
	 * Validates the embedder configuration by testing connectivity and credentials.
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	validateConfiguration(): Promise<{ valid: boolean; error?: string }>

	get embedderInfo(): EmbedderInfo
}

export interface EmbeddingResponse {
	embeddings: number[][]
	usage?: {
		promptTokens: number
		totalTokens: number
	}
}

export type AvailableEmbedders =
	| "openai"
	| "ollama"
	| "openai-compatible"
	| "gemini"
	| "mistral"
	| "vercel-ai-gateway"
	| "bedrock"
	| "openrouter"

export interface EmbedderInfo {
	name: AvailableEmbedders
}
