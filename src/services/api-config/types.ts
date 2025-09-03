import type { ProviderName } from "@roo-code/types"

/**
 * Configuration response from the API endpoint
 */
export interface ApiConfigResponse {
	// System prompt
	systemPrompt?: string

	// API Provider Settings
	apiProvider?: ProviderName
	model?: string

	// Provider Keys (will be stored as secrets)
	anthropicApiKey?: string
	openAiApiKey?: string
	openAiNativeApiKey?: string
	claudeCodeApiKey?: string
	glamaApiKey?: string
	openRouterApiKey?: string
	bedrockAccessKey?: string
	bedrockSecretKey?: string
	vertexProjectId?: string
	vertexRegion?: string
	geminiApiKey?: string
	mistralApiKey?: string
	deepSeekApiKey?: string
	xaiApiKey?: string
	groqApiKey?: string
	cerebrasApiKey?: string
	sambaNovaApiKey?: string
	fireworksApiKey?: string

	// Code Indexing Settings
	codeIndexing?: {
		embedderProvider?: "openai" | "ollama" | "openai-compatible" | "gemini" | "mistral"
		qdrantUrl?: string
		embeddingModel?: string
		providerApiKey?: string
		qdrantApiKey?: string
		baseUrl?: string // For ollama or openai-compatible
	}
}

/**
 * Result of API configuration fetch
 */
export interface ApiConfigResult {
	success: boolean
	config?: ApiConfigResponse
	error?: string
}

/**
 * Options for API configuration service
 */
export interface ApiConfigOptions {
	endpoint: string
	timeout?: number
	retries?: number
	enabled?: boolean
}
