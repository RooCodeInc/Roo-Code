import type { ModelInfo } from "../model.js"

export type OpenAiNativeCodexModelId = keyof typeof openAiNativeCodexModels

export const openAiNativeCodexDefaultModelId: OpenAiNativeCodexModelId = "gpt-5"

export const openAiNativeCodexModels = {
	"gpt-5": {
		maxTokens: 128000,
		contextWindow: 400000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningEffort: true,
		reasoningEffort: "medium",
		description: "GPT-5 via ChatGPT Responses (Codex). Optimized for coding and agentic tasks.",
		supportsTemperature: false,
	},
	"gpt-5-codex": {
		maxTokens: 128000,
		contextWindow: 400000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningEffort: true,
		reasoningEffort: "medium",
		description:
			"GPT-5 Codex via ChatGPT Responses (Codex). A GPT‑5 variant exposed to the client with coding‑oriented defaults.",
		supportsTemperature: false,
	},
} as const satisfies Record<string, ModelInfo>
