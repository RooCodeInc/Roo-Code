import type { ProviderSettings, RooCodeSettings } from "@roo-code/types"
import { logger } from "../../utils/logging"
import type { ApiConfigResponse } from "./types"

/**
 * Configuration to be applied to the extension
 */
export interface MappedConfiguration {
	providerSettings: Partial<ProviderSettings>
	globalSettings: Partial<RooCodeSettings>
	codeIndexSettings: {
		codebaseIndexEnabled?: boolean
		codebaseIndexQdrantUrl?: string
		codebaseIndexEmbedderProvider?: "openai" | "ollama" | "openai-compatible" | "gemini" | "mistral"
		codebaseIndexEmbedderBaseUrl?: string
		codebaseIndexEmbedderModelId?: string
		codebaseIndexOpenAiCompatibleBaseUrl?: string
	}
	secrets: Record<string, string>
}

/**
 * Maps API configuration response to extension configuration format
 */
export class ConfigMapper {
	/**
	 * Transform API response to extension configuration format
	 */
	static mapConfiguration(apiConfig: ApiConfigResponse): MappedConfiguration {
		logger.info("[ConfigMapper] Mapping API configuration to extension format")

		const result: MappedConfiguration = {
			providerSettings: {},
			globalSettings: {},
			codeIndexSettings: {},
			secrets: {},
		}

		// Map basic provider settings
		if (apiConfig.apiProvider) {
			result.providerSettings.apiProvider = apiConfig.apiProvider
			logger.info(`[ConfigMapper] Set API provider: ${apiConfig.apiProvider}`)
		}

		if (apiConfig.model && apiConfig.apiProvider) {
			// Map model to provider-specific field
			const modelFieldMap = {
				openai: "openAiModelId",
				"openai-native": "apiModelId", // openai-native uses generic apiModelId
				glama: "glamaModelId",
				openrouter: "openRouterModelId",
				ollama: "ollamaModelId",
				lmstudio: "lmStudioModelId",
				unbound: "unboundModelId",
				requesty: "requestyModelId",
				huggingface: "huggingFaceModelId",
				litellm: "litellmModelId",
				"io-intelligence": "ioIntelligenceModelId",
				"vercel-ai-gateway": "vercelAiGatewayModelId",
			} as const

			const modelField = modelFieldMap[apiConfig.apiProvider as keyof typeof modelFieldMap]
			if (modelField) {
				;(result.providerSettings as any)[modelField] = apiConfig.model
				logger.info(`[ConfigMapper] Set ${modelField}: ${apiConfig.model}`)
			} else {
				// Default to apiModelId for providers that use it
				result.providerSettings.apiModelId = apiConfig.model
				logger.info(`[ConfigMapper] Set apiModelId: ${apiConfig.model}`)
			}
		}

		// Map system prompt
		if (apiConfig.systemPrompt) {
			result.globalSettings.customInstructions = apiConfig.systemPrompt
			logger.info("[ConfigMapper] Set custom system prompt")
		}

		// Map provider API keys to secrets and provider settings
		this.mapProviderKeys(apiConfig, result)

		// Map code indexing settings
		if (apiConfig.codeIndexing) {
			this.mapCodeIndexSettings(apiConfig.codeIndexing, result)
		}

		return result
	}

	/**
	 * Map provider API keys to secrets and provider settings
	 */
	private static mapProviderKeys(apiConfig: ApiConfigResponse, result: MappedConfiguration): void {
		const keyMappings = {
			anthropicApiKey: "anthropicApiKey",
			openAiApiKey: "openAiApiKey",
			openAiNativeApiKey: "openAiNativeApiKey",
			claudeCodeApiKey: "claudeCodeApiKey",
			glamaApiKey: "glamaApiKey",
			openRouterApiKey: "openRouterApiKey",
			bedrockAccessKey: "bedrockAccessKey",
			bedrockSecretKey: "bedrockSecretKey",
			vertexProjectId: "vertexProjectId",
			vertexRegion: "vertexRegion",
			geminiApiKey: "geminiApiKey",
			mistralApiKey: "mistralApiKey",
			deepSeekApiKey: "deepSeekApiKey",
			xaiApiKey: "xaiApiKey",
			groqApiKey: "groqApiKey",
			cerebrasApiKey: "cerebrasApiKey",
			sambaNovaApiKey: "sambaNovaApiKey",
			fireworksApiKey: "fireworksApiKey",
		} as const

		// Provider settings field mappings (some providers store API keys directly in settings)
		const providerSettingsKeyMap = {
			openai: { field: "openAiApiKey", key: "openAiApiKey" },
			"openai-native": { field: "openAiNativeApiKey", key: "openAiNativeApiKey" },
			anthropic: { field: "apiKey", key: "anthropicApiKey" },
			glama: { field: "glamaApiKey", key: "glamaApiKey" },
			openrouter: { field: "openRouterApiKey", key: "openRouterApiKey" },
			gemini: { field: "geminiApiKey", key: "geminiApiKey" },
			mistral: { field: "mistralApiKey", key: "mistralApiKey" },
			deepseek: { field: "deepSeekApiKey", key: "deepSeekApiKey" },
			xai: { field: "xaiApiKey", key: "xaiApiKey" },
			groq: { field: "groqApiKey", key: "groqApiKey" },
			cerebras: { field: "cerebrasApiKey", key: "cerebrasApiKey" },
			sambanova: { field: "sambaNovaApiKey", key: "sambaNovaApiKey" },
			fireworks: { field: "fireworksApiKey", key: "fireworksApiKey" },
		} as const

		// Map to secrets (for VS Code secret storage)
		for (const [apiKey, secretKey] of Object.entries(keyMappings)) {
			const value = apiConfig[apiKey as keyof ApiConfigResponse]
			if (value && typeof value === "string" && value.trim()) {
				result.secrets[secretKey] = value.trim()
				logger.info(`[ConfigMapper] Mapped ${secretKey} to secrets`)
			}
		}

		// Map to provider settings (for immediate use)
		if (apiConfig.apiProvider) {
			const providerMapping = providerSettingsKeyMap[apiConfig.apiProvider as keyof typeof providerSettingsKeyMap]
			if (providerMapping) {
				const apiKeyValue = apiConfig[providerMapping.key as keyof ApiConfigResponse]
				if (apiKeyValue && typeof apiKeyValue === "string" && apiKeyValue.trim()) {
					;(result.providerSettings as any)[providerMapping.field] = apiKeyValue.trim()
					logger.info(`[ConfigMapper] Set ${providerMapping.field} in provider settings`)
				}
			}
		}
	}

	/**
	 * Map code indexing configuration
	 */
	private static mapCodeIndexSettings(
		codeIndexing: NonNullable<ApiConfigResponse["codeIndexing"]>,
		result: MappedConfiguration,
	): void {
		logger.info("[ConfigMapper] Mapping code indexing settings")

		// Enable code indexing if any settings are provided
		result.codeIndexSettings.codebaseIndexEnabled = true

		// Map embedder provider
		if (codeIndexing.embedderProvider) {
			result.codeIndexSettings.codebaseIndexEmbedderProvider = codeIndexing.embedderProvider
			logger.info(`[ConfigMapper] Set embedder provider: ${codeIndexing.embedderProvider}`)
		}

		// Map Qdrant URL
		if (codeIndexing.qdrantUrl) {
			result.codeIndexSettings.codebaseIndexQdrantUrl = codeIndexing.qdrantUrl
			logger.info(`[ConfigMapper] Set Qdrant URL: ${codeIndexing.qdrantUrl}`)
		}

		// Map embedding model
		if (codeIndexing.embeddingModel) {
			result.codeIndexSettings.codebaseIndexEmbedderModelId = codeIndexing.embeddingModel
			logger.info(`[ConfigMapper] Set embedding model: ${codeIndexing.embeddingModel}`)
		}

		// Map base URL for ollama or openai-compatible providers
		if (codeIndexing.baseUrl) {
			if (codeIndexing.embedderProvider === "ollama") {
				result.codeIndexSettings.codebaseIndexEmbedderBaseUrl = codeIndexing.baseUrl
			} else if (codeIndexing.embedderProvider === "openai-compatible") {
				result.codeIndexSettings.codebaseIndexOpenAiCompatibleBaseUrl = codeIndexing.baseUrl
			}
			logger.info(`[ConfigMapper] Set base URL: ${codeIndexing.baseUrl}`)
		}

		// Map provider API keys for code indexing
		if (codeIndexing.providerApiKey) {
			const provider = codeIndexing.embedderProvider || "openai"
			const secretKeyMap = {
				openai: "codeIndexOpenAiKey",
				"openai-compatible": "codeIndexOpenAiCompatibleApiKey",
				gemini: "codeIndexGeminiApiKey",
				mistral: "codeIndexMistralApiKey",
			} as const

			const secretKey = secretKeyMap[provider as keyof typeof secretKeyMap]
			if (secretKey) {
				result.secrets[secretKey] = codeIndexing.providerApiKey
				logger.info(`[ConfigMapper] Mapped code index API key for provider: ${provider}`)
			}
		}

		// Map Qdrant API key
		if (codeIndexing.qdrantApiKey) {
			result.secrets.codeIndexQdrantApiKey = codeIndexing.qdrantApiKey
			logger.info("[ConfigMapper] Mapped Qdrant API key")
		}
	}

	/**
	 * Validate mapped configuration
	 */
	static validateConfiguration(config: MappedConfiguration): { valid: boolean; errors: string[] } {
		const errors: string[] = []

		// Validate provider settings if API provider is set
		if (config.providerSettings.apiProvider) {
			const provider = config.providerSettings.apiProvider

			// Check if appropriate API key exists for the provider
			const requiredKeyMap = {
				anthropic: "anthropicApiKey",
				openai: "openAiApiKey",
				"openai-native": "openAiNativeApiKey",
				"claude-code": "claudeCodeApiKey",
				gemini: "geminiApiKey",
				mistral: "mistralApiKey",
				deepseek: "deepSeekApiKey",
				xai: "xaiApiKey",
				groq: "groqApiKey",
			} as const

			const requiredKey = requiredKeyMap[provider as keyof typeof requiredKeyMap]
			if (requiredKey && !config.secrets[requiredKey]) {
				errors.push(`Missing API key for provider: ${provider}`)
			}
		}

		// Validate code indexing settings if enabled
		if (config.codeIndexSettings.codebaseIndexEnabled) {
			if (!config.codeIndexSettings.codebaseIndexQdrantUrl) {
				errors.push("Qdrant URL is required when code indexing is enabled")
			}

			const embedderProvider = config.codeIndexSettings.codebaseIndexEmbedderProvider
			if (
				embedderProvider &&
				!["openai", "ollama", "openai-compatible", "gemini", "mistral"].includes(embedderProvider)
			) {
				errors.push(`Invalid embedder provider: ${embedderProvider}`)
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		}
	}
}
