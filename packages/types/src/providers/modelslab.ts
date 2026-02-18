import type { ModelInfo } from "../model.js"

/**
 * ModelsLab model IDs for uncensored chat completion.
 * API docs: https://docs.modelslab.com
 */
export type ModelsLabModelId = "llama-3.1-8b-uncensored" | "llama-3.1-70b-uncensored"

export const modelsLabDefaultModelId: ModelsLabModelId = "llama-3.1-8b-uncensored"

export const modelsLabModels = {
	"llama-3.1-8b-uncensored": {
		maxTokens: 8192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		description:
			"Llama 3.1 8B Uncensored — fast, no content restrictions, 128K context. " +
			"Ideal for creative writing, security research, and unrestricted coding assistance.",
	},
	"llama-3.1-70b-uncensored": {
		maxTokens: 8192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		description:
			"Llama 3.1 70B Uncensored — higher quality, no content restrictions, 128K context. " +
			"Best for complex tasks requiring deeper reasoning without content filtering.",
	},
} as const satisfies Record<ModelsLabModelId, ModelInfo>
