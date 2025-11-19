import {
	anthropicModels,
	bedrockModels,
	cerebrasModels,
	claudeCodeModels,
	deepSeekModels,
	doubaoModels,
	featherlessModels,
	fireworksModels,
	geminiModels,
	groqModels,
	ioIntelligenceModels,
	mistralModels,
	moonshotModels,
	openAiNativeModels,
	qwenCodeModels,
	sambaNovaModels,
	vertexModels,
	vscodeLlmModels,
	xaiModels,
	internationalZAiModels,
	minimaxModels,
	type ProviderName,
	type ModelInfo,
} from "@roo-code/types"

import { getCustomModelsForProvider } from "./index"

// Single source of truth for static provider names
// This const tuple provides proper type narrowing for StaticProviderWithCustomModels
export const staticProviderNames = [
	"anthropic",
	"bedrock",
	"cerebras",
	"claude-code",
	"deepseek",
	"doubao",
	"featherless",
	"fireworks",
	"gemini",
	"groq",
	"io-intelligence",
	"mistral",
	"moonshot",
	"minimax",
	"openai-native",
	"qwen-code",
	"sambanova",
	"vertex",
	"vscode-lm",
	"xai",
	"zai",
] as const

// Map of provider names to their static model dictionaries
const STATIC_MODEL_DICTIONARIES: Record<(typeof staticProviderNames)[number], Record<string, ModelInfo>> = {
	anthropic: anthropicModels as Record<string, ModelInfo>,
	bedrock: bedrockModels as Record<string, ModelInfo>,
	cerebras: cerebrasModels as Record<string, ModelInfo>,
	"claude-code": claudeCodeModels as Record<string, ModelInfo>,
	deepseek: deepSeekModels as Record<string, ModelInfo>,
	doubao: doubaoModels as Record<string, ModelInfo>,
	featherless: featherlessModels as Record<string, ModelInfo>,
	fireworks: fireworksModels as Record<string, ModelInfo>,
	gemini: geminiModels as Record<string, ModelInfo>,
	groq: groqModels as Record<string, ModelInfo>,
	"io-intelligence": ioIntelligenceModels as Record<string, ModelInfo>,
	mistral: mistralModels as Record<string, ModelInfo>,
	moonshot: moonshotModels as Record<string, ModelInfo>,
	minimax: minimaxModels as Record<string, ModelInfo>,
	"openai-native": openAiNativeModels as Record<string, ModelInfo>,
	"qwen-code": qwenCodeModels as Record<string, ModelInfo>,
	sambanova: sambaNovaModels as Record<string, ModelInfo>,
	vertex: vertexModels as Record<string, ModelInfo>,
	"vscode-lm": vscodeLlmModels as Record<string, ModelInfo>,
	xai: xaiModels as Record<string, ModelInfo>,
	zai: internationalZAiModels as Record<string, ModelInfo>,
}

/**
 * Get models for a static provider, merging built-in models with custom models
 * @param provider The provider name
 * @param cwd Current working directory for project path
 * @returns Merged record of models
 */
export async function getModelsForStaticProvider(
	provider: ProviderName,
	cwd: string,
): Promise<Record<string, ModelInfo>> {
	const staticModels =
		(STATIC_MODEL_DICTIONARIES as Partial<Record<ProviderName, Record<string, ModelInfo>>>)[provider] || {}
	const customModels = await getCustomModelsForProvider(provider as any, cwd)

	// Merge: custom models override static models
	return { ...staticModels, ...customModels }
}

/**
 * Check if a provider is a static provider (has hard-coded models)
 * @param provider The provider name
 * @returns True if the provider has static models
 */
export function isStaticProvider(provider: ProviderName): boolean {
	return provider in STATIC_MODEL_DICTIONARIES
}

/**
 * Get all static provider names (providers with hard-coded models)
 * @returns Array of static provider names
 */
export function getStaticProviderNames(): readonly ProviderName[] {
	return staticProviderNames
}

/**
 * Get all provider names that support custom models (both static and dynamic)
 * @returns Array of provider names
 */
export function getSupportedProviders(): ProviderName[] {
	return [
		...staticProviderNames,
		// Dynamic providers from modelCache.ts
		"openrouter",
		"requesty",
		"glama",
		"unbound",
		"litellm",
		"ollama",
		"lmstudio",
		"deepinfra",
		"vercel-ai-gateway",
		"huggingface",
		"roo",
		"chutes",
	] as ProviderName[]
}
