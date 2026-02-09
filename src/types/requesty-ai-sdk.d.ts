declare module "@requesty/ai-sdk" {
	import type { LanguageModelV2 } from "@ai-sdk/provider"

	type RequestyLanguageModel = LanguageModelV2

	interface RequestyProviderMetadata {
		requesty?: {
			usage?: {
				cachingTokens?: number
				cachedTokens?: number
			}
		}
	}

	type RequestyChatModelId = string

	type RequestyChatSettings = {
		logitBias?: Record<number, number>
		logprobs?: boolean | number
		parallelToolCalls?: boolean
		user?: string
		includeReasoning?: boolean
		reasoningEffort?: "low" | "medium" | "high" | "max" | string
		extraBody?: Record<string, any>
		models?: string[]
	}

	interface RequestyProvider {
		(modelId: RequestyChatModelId, settings?: RequestyChatSettings): RequestyLanguageModel
		languageModel(modelId: RequestyChatModelId, settings?: RequestyChatSettings): RequestyLanguageModel
		chat(modelId: RequestyChatModelId, settings?: RequestyChatSettings): RequestyLanguageModel
	}

	interface RequestyProviderSettings {
		baseURL?: string
		baseUrl?: string
		apiKey?: string
		headers?: Record<string, string>
		compatibility?: "strict" | "compatible"
		fetch?: typeof fetch
		extraBody?: Record<string, unknown>
	}

	function createRequesty(options?: RequestyProviderSettings): RequestyProvider

	const requesty: RequestyProvider

	export {
		type RequestyChatModelId,
		type RequestyChatSettings,
		type RequestyLanguageModel,
		type RequestyProvider,
		type RequestyProviderMetadata,
		type RequestyProviderSettings,
		createRequesty,
		requesty,
	}
}
