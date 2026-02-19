export * from "./anthropic"
export * from "./baseten"
export * from "./bedrock"
export * from "./deepseek"
export * from "./fireworks"
export * from "./gemini"
export * from "./lite-llm"
export * from "./lm-studio"
export * from "./mistral"
export * from "./moonshot"
export * from "./ollama"
export * from "./openai"
export * from "./openai-codex"
export * from "./openai-codex-rate-limits"
export * from "./openrouter"
export * from "./qwen-code"
export * from "./requesty"
export * from "./roo"
export * from "./sambanova"
export * from "./vertex"
export * from "./vscode-llm"
export * from "./xai"
export * from "./vercel-ai-gateway"
export * from "./zai"
export * from "./minimax"

import { anthropicDefaultModelId } from "./anthropic"
import { basetenDefaultModelId } from "./baseten"
import { bedrockDefaultModelId } from "./bedrock"
import { deepSeekDefaultModelId } from "./deepseek"
import { fireworksDefaultModelId } from "./fireworks"
import { geminiDefaultModelId } from "./gemini"
import { litellmDefaultModelId } from "./lite-llm"
import { mistralDefaultModelId } from "./mistral"
import { moonshotDefaultModelId } from "./moonshot"
import { openAiCodexDefaultModelId } from "./openai-codex"
import { openRouterDefaultModelId } from "./openrouter"
import { qwenCodeDefaultModelId } from "./qwen-code"
import { requestyDefaultModelId } from "./requesty"
import { rooDefaultModelId } from "./roo"
import { sambaNovaDefaultModelId } from "./sambanova"
import { vertexDefaultModelId } from "./vertex"
import { vscodeLlmDefaultModelId } from "./vscode-llm"
import { xaiDefaultModelId } from "./xai"
import { vercelAiGatewayDefaultModelId } from "./vercel-ai-gateway"
import { internationalZAiDefaultModelId, mainlandZAiDefaultModelId } from "./zai"
import { minimaxDefaultModelId } from "./minimax"

// Import the ProviderName type from provider-settings to avoid duplication
import type { ProviderName } from "../provider-settings"

/**
 * Get the default model ID for a given provider.
 * This function returns only the provider's default model ID, without considering user configuration.
 * Used as a fallback when provider models are still loading.
 */
export function getProviderDefaultModelId(
	provider: ProviderName,
	options: { isChina?: boolean } = { isChina: false },
): string {
	switch (provider) {
		case "openrouter":
			return openRouterDefaultModelId
		case "requesty":
			return requestyDefaultModelId
		case "litellm":
			return litellmDefaultModelId
		case "xai":
			return xaiDefaultModelId
		case "baseten":
			return basetenDefaultModelId
		case "bedrock":
			return bedrockDefaultModelId
		case "vertex":
			return vertexDefaultModelId
		case "gemini":
			return geminiDefaultModelId
		case "deepseek":
			return deepSeekDefaultModelId
		case "moonshot":
			return moonshotDefaultModelId
		case "minimax":
			return minimaxDefaultModelId
		case "zai":
			return options?.isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId
		case "openai-native":
			return "gpt-4o" // Based on openai-native patterns
		case "openai-codex":
			return openAiCodexDefaultModelId
		case "mistral":
			return mistralDefaultModelId
		case "openai":
			return "" // OpenAI provider uses custom model configuration
		case "ollama":
			return "" // Ollama uses dynamic model selection
		case "lmstudio":
			return "" // LMStudio uses dynamic model selection
		case "vscode-lm":
			return vscodeLlmDefaultModelId
		case "sambanova":
			return sambaNovaDefaultModelId
		case "fireworks":
			return fireworksDefaultModelId
		case "roo":
			return rooDefaultModelId
		case "qwen-code":
			return qwenCodeDefaultModelId
		case "vercel-ai-gateway":
			return vercelAiGatewayDefaultModelId
		case "anthropic":
		case "gemini-cli":
		case "fake-ai":
		default:
			return anthropicDefaultModelId
	}
}
