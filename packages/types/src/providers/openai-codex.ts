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
	"codex-mini-latest": {
		// Based on OpenAI's Codex CLI page (fast reasoning model tuned from o4-mini)
		maxTokens: 100000,
		contextWindow: 200000,
		supportsImages: true, // input images supported
		supportsPromptCache: true,
		supportsReasoningEffort: true,
		reasoningEffort: "medium",
		description:
			"codex-mini-latest via ChatGPT Responses (Codex). Fast reasoning model optimized for the Codex CLI (fine‑tuned o4‑mini).",
		supportsTemperature: false,
		// Pricing per 1M tokens
		inputPrice: 1.5,
		outputPrice: 6.0,
		// Prompt cache pricing
		cacheWritesPrice: 1.5,
		cacheReadsPrice: 0.375,
	},
} as const satisfies Record<string, ModelInfo>
