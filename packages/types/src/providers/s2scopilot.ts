import type { ModelInfo } from "../model.js"

// Default model for s2sCopilot
export const s2scopilotDefaultModelId = "claudesonnet4.5"

export const s2scopilotDefaultModelInfo: ModelInfo = {
	maxTokens: 64000,
	contextWindow: 200_000,
	supportsImages: true,
	supportsPromptCache: false,
	inputPrice: 3.0,
	outputPrice: 15.0,
	description: "Claude Sonnet 4.5 via s2sCopilot API Gateway",
}
