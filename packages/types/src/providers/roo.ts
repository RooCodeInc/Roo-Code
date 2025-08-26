import type { ModelInfo } from "../model.js"

export type RooModelId =
	| "xai/grok-code-fast-1"
	| "roo/code-supernova-1-million"
	| "xai/grok-4-fast"
	| "deepseek/deepseek-chat-v3.1"
	| "roo/sonic"

export const rooDefaultModelId: RooModelId = "xai/grok-code-fast-1"

export const rooModels = {
	"xai/grok-code-fast-1": {
		maxTokens: 16_384,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0,
		description:
			"A reasoning model that is blazing fast and excels at agentic coding, accessible for free through Roo Code Cloud for a limited time. (Note: the free prompts and completions are logged by xAI and used to improve the model.)",
	},
	"roo/code-supernova-1-million": {
		maxTokens: 30_000,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0,
		description:
			"A versatile agentic coding stealth model with a 1M token context window that supports image inputs, accessible for free through Roo Code Cloud for a limited time. (Note: the free prompts and completions are logged by the model provider and used to improve the model.)",
	},
	"xai/grok-4-fast": {
		maxTokens: 30_000,
		contextWindow: 2_000_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		description:
			"Grok 4 Fast is xAI's latest multimodal model with SOTA cost-efficiency and a 2M token context window. (Note: prompts and completions are logged by xAI and used to improve the model.)",
		deprecated: true,
	},
	"deepseek/deepseek-chat-v3.1": {
		maxTokens: 16_384,
		contextWindow: 163_840,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		description:
			"DeepSeek-V3.1 is a large hybrid reasoning model (671B parameters, 37B active). It extends the DeepSeek-V3 base with a two-phase long-context training process, reaching up to 128K tokens, and uses FP8 microscaling for efficient inference.",
	},
	"roo/sonic": {
		contextWindow: 200000,
		supportsPromptCache: true,
		supportsImages: true,
		supportsComputerUse: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
		description:
			"Roo Sonic is a blazing-fast model optimized for coding tasks, offering 200K context, prompt caching, and vision capabilities.",
	},
} as const satisfies Record<RooModelId, ModelInfo>
