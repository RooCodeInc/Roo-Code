import type { ModelInfo } from "../model.js"

/**
 * Dynamic model information fetcher for VS Code LM API models.
 * Fetches accurate context windows and capabilities from reliable sources
 * instead of maintaining a static registry.
 */

interface ModelSource {
	name: string
	priority: number
	fetchModelInfo: (modelId: string) => Promise<Partial<ModelInfo> | null>
}

interface CachedModelInfo {
	info: Partial<ModelInfo>
	timestamp: number
	source: string
}

// Cache model info for 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const modelInfoCache = new Map<string, CachedModelInfo>()

/**
 * OpenRouter has comprehensive model information for most major providers
 * https://openrouter.ai/api/v1/models
 */
async function fetchFromOpenRouter(modelId: string): Promise<Partial<ModelInfo> | null> {
	try {
		const response = await fetch("https://openrouter.ai/api/v1/models", {
			headers: {
				"Content-Type": "application/json",
			},
		})

		if (!response.ok) {
			console.debug(`OpenRouter API returned ${response.status}`)
			return null
		}

		const data = await response.json()
		const models = data.data || []

		// Normalize model ID for matching
		const normalizedSearchId = normalizeModelId(modelId)

		// Find matching model
		for (const model of models) {
			const normalizedModelId = normalizeModelId(model.id)

			if (
				normalizedModelId.indexOf(normalizedSearchId) !== -1 ||
				normalizedSearchId.indexOf(normalizedModelId) !== -1
			) {
				const contextWindow = model.context_length || model.context_window
				if (!contextWindow || contextWindow === 0) continue

				console.debug(`Fetched model info from OpenRouter: ${model.id} -> ${contextWindow} context`)

				return {
					contextWindow,
					maxTokens: model.max_output_tokens || -1,
					supportsImages: model.architecture?.modality?.includes("image") || false,
					supportsPromptCache: false, // OpenRouter doesn't expose this reliably
				}
			}
		}

		return null
	} catch (error) {
		console.debug(`Error fetching from OpenRouter: ${error}`)
		return null
	}
}

/**
 * Anthropic documentation - for Claude models
 */
async function fetchFromAnthropicDocs(modelId: string): Promise<Partial<ModelInfo> | null> {
	const normalizedId = normalizeModelId(modelId)

	// Claude model patterns and their known context windows
	const claudePatterns: Record<string, Partial<ModelInfo>> = {
		"claude-opus-4-5": {
			contextWindow: 200_000,
			maxTokens: 32_000,
			supportsImages: true,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		},
		"claude-opus-4-1": {
			contextWindow: 200_000,
			maxTokens: 32_000,
			supportsImages: true,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		},
		"claude-sonnet-4-5": {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"claude-sonnet-4": {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"claude-haiku-4-5": {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: false,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		},
		"claude-haiku-4": {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: false,
			supportsPromptCache: true,
		},
		"claude-3-5-sonnet": {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"claude-3-7-sonnet": {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"claude-3-opus": {
			contextWindow: 200_000,
			maxTokens: 4_096,
			supportsImages: true,
			supportsPromptCache: true,
		},
	}

	for (const [pattern, info] of Object.entries(claudePatterns)) {
		if (normalizedId.indexOf(pattern) !== -1) {
			console.debug(`Matched Claude model: ${modelId} -> ${pattern}`)
			return info
		}
	}

	return null
}

/**
 * OpenAI documentation - for GPT models
 */
async function fetchFromOpenAIDocs(modelId: string): Promise<Partial<ModelInfo> | null> {
	const normalizedId = normalizeModelId(modelId)

	// GPT model patterns and their known context windows
	const gptPatterns: Record<string, Partial<ModelInfo>> = {
		"gpt-5": {
			contextWindow: 200_000,
			maxTokens: 128_000,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"gpt-4o": {
			contextWindow: 128_000,
			maxTokens: 16_384,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"gpt-4o-mini": {
			contextWindow: 128_000,
			maxTokens: 16_384,
			supportsImages: true,
			supportsPromptCache: false,
		},
		"gpt-4-turbo": {
			contextWindow: 128_000,
			maxTokens: 4_096,
			supportsImages: true,
			supportsPromptCache: false,
		},
		"gpt-4": {
			contextWindow: 128_000,
			maxTokens: 8_192,
			supportsImages: false,
			supportsPromptCache: false,
		},
		"gpt-3.5-turbo": {
			contextWindow: 16_385,
			maxTokens: 4_096,
			supportsImages: false,
			supportsPromptCache: false,
		},
		"o1-preview": {
			contextWindow: 128_000,
			maxTokens: 32_768,
			supportsImages: true,
			supportsPromptCache: false,
		},
		"o1-mini": {
			contextWindow: 128_000,
			maxTokens: 65_536,
			supportsImages: false,
			supportsPromptCache: false,
		},
		"o3-mini": {
			contextWindow: 200_000,
			maxTokens: 100_000,
			supportsImages: false,
			supportsPromptCache: false,
		},
	}

	for (const [pattern, info] of Object.entries(gptPatterns)) {
		if (normalizedId.indexOf(pattern) !== -1) {
			console.debug(`Matched GPT model: ${modelId} -> ${pattern}`)
			return info
		}
	}

	return null
}

/**
 * Google Gemini documentation
 */
async function fetchFromGeminiDocs(modelId: string): Promise<Partial<ModelInfo> | null> {
	const normalizedId = normalizeModelId(modelId)

	const geminiPatterns: Record<string, Partial<ModelInfo>> = {
		"gemini-2.5-pro": {
			contextWindow: 1_048_576,
			maxTokens: 65_536,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"gemini-2-5-pro": {
			contextWindow: 1_048_576,
			maxTokens: 65_536,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"gemini-2.0-flash": {
			contextWindow: 1_048_576,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: false,
		},
		"gemini-1.5-pro": {
			contextWindow: 2_097_152,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"gemini-1.5-flash": {
			contextWindow: 1_048_576,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
	}

	for (const [pattern, info] of Object.entries(geminiPatterns)) {
		if (normalizedId.indexOf(pattern) !== -1) {
			console.debug(`Matched Gemini model: ${modelId} -> ${pattern}`)
			return info
		}
	}

	return null
}

/**
 * Normalize model ID for comparison
 */
function normalizeModelId(modelId: string): string {
	return modelId
		.toLowerCase()
		.replace(/[@_\s.]/g, "-") // Normalize separators
		.replace(/\//g, "-") // Remove slashes
		.replace(/-+/g, "-") // Collapse multiple hyphens
		.trim()
}

/**
 * Model information sources in priority order
 */
const MODEL_SOURCES: ModelSource[] = [
	{
		name: "Anthropic Docs",
		priority: 1,
		fetchModelInfo: fetchFromAnthropicDocs,
	},
	{
		name: "OpenAI Docs",
		priority: 2,
		fetchModelInfo: fetchFromOpenAIDocs,
	},
	{
		name: "Gemini Docs",
		priority: 3,
		fetchModelInfo: fetchFromGeminiDocs,
	},
	{
		name: "OpenRouter API",
		priority: 4,
		fetchModelInfo: fetchFromOpenRouter,
	},
]

/**
 * Fetch model information from all available sources
 */
export async function fetchModelInfo(modelId: string): Promise<Partial<ModelInfo> | null> {
	if (!modelId) return null

	// Check cache first
	const cached = modelInfoCache.get(modelId)
	if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
		console.debug(`Using cached model info for ${modelId} from ${cached.source}`)
		return cached.info
	}

	// Try each source in priority order
	for (const source of MODEL_SOURCES) {
		try {
			const info = await source.fetchModelInfo(modelId)
			if (info && info.contextWindow && info.contextWindow > 0) {
				// Cache the result
				modelInfoCache.set(modelId, {
					info,
					timestamp: Date.now(),
					source: source.name,
				})

				console.debug(`Fetched model info for ${modelId} from ${source.name}`)
				return info
			}
		} catch (error) {
			console.debug(`Error fetching from ${source.name}: ${error}`)
			continue
		}
	}

	console.debug(`No model info found for ${modelId} from any source`)
	return null
}

/**
 * Merge model information from VS Code LM API with fetched data.
 * Fetched values take precedence for context window and capabilities.
 */
export async function mergeModelInfoWithFetched(
	modelId: string,
	apiMaxInputTokens: number | undefined,
	fallbackContextWindow: number,
): Promise<Partial<ModelInfo>> {
	const fetchedInfo = await fetchModelInfo(modelId)

	if (fetchedInfo && fetchedInfo.contextWindow) {
		const contextWindow = fetchedInfo.contextWindow

		console.debug(
			`Roo Code <VS Code LM Fetcher>: Using fetched info for '${modelId}'. ` +
				`Context: ${contextWindow} (Fetched: ${fetchedInfo.contextWindow}, API: ${apiMaxInputTokens})`,
		)

		return {
			contextWindow,
			maxTokens: fetchedInfo.maxTokens ?? -1,
			supportsImages: fetchedInfo.supportsImages ?? false,
			supportsPromptCache: fetchedInfo.supportsPromptCache ?? true,
			supportsReasoningBudget: fetchedInfo.supportsReasoningBudget,
		}
	}

	// No fetched data - use API values or fallback
	const contextWindow = typeof apiMaxInputTokens === "number" ? Math.max(0, apiMaxInputTokens) : fallbackContextWindow

	console.debug(
		`Roo Code <VS Code LM Fetcher>: No fetched data for '${modelId}'. ` +
			`Using API/fallback context: ${contextWindow}`,
	)

	return {
		contextWindow,
		maxTokens: -1,
		supportsImages: false,
		supportsPromptCache: true,
	}
}

/**
 * Clear the model info cache (useful for testing or forcing refresh)
 */
export function clearModelInfoCache(): void {
	modelInfoCache.clear()
	console.debug("Model info cache cleared")
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
	return {
		size: modelInfoCache.size,
		entries: Array.from(modelInfoCache.keys()),
	}
}
