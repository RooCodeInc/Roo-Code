import type { ModelInfo } from "../model.js"

// Cloud.ru Foundation Models (CFM)
// https://cloud.ru/ai/foundation-models

export type CloudRuModelId = keyof typeof cloudRuModels
export const cloudRuDefaultModelId: CloudRuModelId = "GigaChat-Max"

export const cloudRuModels = {
	"GigaChat-Max": {
		maxTokens: 32768,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.12, // Pricing per 1000 tokens (estimated)
		outputPrice: 0.12,
		supportsTemperature: true,
		defaultTemperature: 0.7,
		description: "GigaChat Max - Most capable model for complex tasks and reasoning",
	},
	"GigaChat-Pro": {
		maxTokens: 32768,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.08,
		outputPrice: 0.08,
		supportsTemperature: true,
		defaultTemperature: 0.7,
		description: "GigaChat Pro - Balanced model for professional use cases",
	},
	"GigaChat-Plus": {
		maxTokens: 8192,
		contextWindow: 32000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.04,
		outputPrice: 0.04,
		supportsTemperature: true,
		defaultTemperature: 0.7,
		description: "GigaChat Plus - Efficient model for standard tasks",
	},
	GigaChat: {
		maxTokens: 8192,
		contextWindow: 32000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.02,
		outputPrice: 0.02,
		supportsTemperature: true,
		defaultTemperature: 0.7,
		description: "GigaChat - Base model for simple tasks",
	},
	"GigaChat-2-Max": {
		maxTokens: 32768,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 0.15,
		supportsTemperature: true,
		defaultTemperature: 0.7,
		description: "GigaChat 2 Max - Next generation model with enhanced capabilities",
	},
	"Qwen3-Coder-480B-A35B-Instruct": {
		maxTokens: 32768,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.1,
		outputPrice: 0.1,
		supportsTemperature: true,
		defaultTemperature: 0.7,
		description: "Qwen 3 Coder - Specialized model for code generation and analysis (480B parameters)",
	},
	"Qwen3-Coder-32B-Instruct": {
		maxTokens: 32768,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.06,
		outputPrice: 0.06,
		supportsTemperature: true,
		defaultTemperature: 0.7,
		description: "Qwen 3 Coder - Efficient coding model (32B parameters)",
	},
	"Qwen3-Coder-7B-Instruct": {
		maxTokens: 32768,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.03,
		outputPrice: 0.03,
		supportsTemperature: true,
		defaultTemperature: 0.7,
		description: "Qwen 3 Coder - Lightweight coding model (7B parameters)",
	},
} as const satisfies Record<string, ModelInfo>
