import type { ModelInfo } from "../model.js"

// Poe
// https://creator.poe.com/docs/external-applications/openai-compatible-api

export const poeModels = {
	"gpt-5.1-codex-mini": {
		maxTokens: 128_000,
		contextWindow: 400_000,
		supportsNativeTools: true,
		supportsImages: true,
		supportsPromptCache: true,
		supportsTemperature: false,
	},
	"gpt-5.1-codex": {
		maxTokens: 128_000,
		contextWindow: 400_000,
		supportsNativeTools: true,
		supportsImages: true,
		supportsPromptCache: true,
		supportsTemperature: false,
	},
	"gpt-5-mini": {
		maxTokens: 128_000,
		contextWindow: 400_000,
		supportsNativeTools: true,
		supportsImages: true,
		supportsPromptCache: true,
		supportsVerbosity: true,
		supportsTemperature: false,
	},
	"gpt-5.1": {
		maxTokens: 128_000,
		contextWindow: 400_000,
		supportsNativeTools: true,
		supportsImages: true,
		supportsPromptCache: true,
		supportsVerbosity: true,
		supportsTemperature: false,
	},
	"claude-sonnet-4.5": {
		maxTokens: 64_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
	},
	"claude-haiku-4.5": {
		maxTokens: 64_000,
		contextWindow: 200_000,
		supportsImages: false,
		supportsPromptCache: true,
	},
	"claude-opus-4.1": {
		maxTokens: 32_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
	},
	"gemini-3-pro": {
		maxTokens: 65_536,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsNativeTools: true,
		supportsPromptCache: true,
		supportsTemperature: true,
		defaultTemperature: 1,
	},
	"grok-code-fast-1": {
		maxTokens: 16_384,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: true,
	},
	"grok-4": {
		maxTokens: 8_192,
		contextWindow: 256_000,
		supportsImages: true,
		supportsPromptCache: true,
	},
	"deepseek-r1": {
		maxTokens: 65_536,
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: true,
	},
} as const satisfies Record<string, ModelInfo>

export type PoeModelId = keyof typeof poeModels

export const poeDefaultModelId = "gpt-5.1-codex-mini" satisfies PoeModelId
