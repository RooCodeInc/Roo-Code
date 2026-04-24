export type EmbedderProvider =
	| "openai"
	| "ollama"
	| "openai-compatible"
	| "gemini"
	| "mistral"
	| "vercel-ai-gateway"
	| "bedrock"
	| "openrouter" // Add other providers as needed.

export type EmbeddingPurpose = "index" | "query"

export interface EmbeddingModelProfile {
	dimension: number
	scoreThreshold?: number // Model-specific minimum score threshold for semantic search.
	queryPrefix?: string // Optional prefix required by the model for search queries.
	documentPrefix?: string // Optional prefix required by the model for indexing/document embedding.
	// Add other model-specific properties if needed, e.g., context window size.
}

export type EmbeddingModelProfiles = {
	[provider in EmbedderProvider]?: {
		[modelId: string]: EmbeddingModelProfile
	}
}
