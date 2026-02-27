import type { ModelInfo } from "../model.js"

// https://avian.io
export type AvianModelId = "deepseek/deepseek-v3.2" | "moonshotai/kimi-k2.5" | "z-ai/glm-5" | "minimax/minimax-m2.5"

export const avianDefaultModelId: AvianModelId = "deepseek/deepseek-v3.2"

export const avianModels = {
	"deepseek/deepseek-v3.2": {
		maxTokens: 65536,
		contextWindow: 163840,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.26,
		outputPrice: 0.38,
		description:
			"DeepSeek V3.2 is the latest iteration of the V3 model family with enhanced reasoning capabilities, improved code generation, and better instruction following. 164K context window with 65K max output.",
	},
	"moonshotai/kimi-k2.5": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.45,
		outputPrice: 2.2,
		description:
			"Kimi K2.5 is Moonshot AI's flagship agentic model. It unifies vision and text, thinking and non-thinking modes, and single-agent and multi-agent execution into one model. 131K context window.",
	},
	"z-ai/glm-5": {
		maxTokens: 16384,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 2.55,
		description:
			"Z.ai GLM-5 is an advanced coding and reasoning model with exceptional performance on complex programming tasks. 131K context window with 16K max output.",
	},
	"minimax/minimax-m2.5": {
		maxTokens: 1048576,
		contextWindow: 1048576,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 1.1,
		description:
			"MiniMax M2.5 is a high-performance language model with an industry-leading 1M context window, optimized for long-context understanding and generation tasks.",
	},
} as const satisfies Record<string, ModelInfo>
