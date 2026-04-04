export * from "./anthropic.ts"
export * from "./baseten.ts"
export * from "./bedrock.ts"
export * from "./deepseek.ts"
export * from "./fireworks.ts"
export * from "./gemini.ts"
export * from "./lite-llm.ts"
export * from "./lm-studio.ts"
export * from "./mistral.ts"
export * from "./moonshot.ts"
export * from "./ollama.ts"
export * from "./openai.ts"
export * from "./openai-codex.ts"
export * from "./openai-codex-rate-limits.ts"
export * from "./openrouter.ts"
export * from "./qwen-code.ts"
export * from "./requesty.ts"
export * from "./jabberwock.ts"
export * from "./sambanova.ts"
export * from "./unbound.ts"
export * from "./vertex.ts"
export * from "./vscode-llm.ts"
export * from "./xai.ts"
export * from "./vercel-ai-gateway.ts"
export * from "./zai.ts"
export * from "./minimax.ts"

import { anthropicDefaultModelId } from "./anthropic.ts"
import { basetenDefaultModelId } from "./baseten.ts"
import { bedrockDefaultModelId } from "./bedrock.ts"
import { deepSeekDefaultModelId } from "./deepseek.ts"
import { fireworksDefaultModelId } from "./fireworks.ts"
import { geminiDefaultModelId } from "./gemini.ts"
import { litellmDefaultModelId } from "./lite-llm.ts"
import { mistralDefaultModelId } from "./mistral.ts"
import { moonshotDefaultModelId } from "./moonshot.ts"
import { openAiCodexDefaultModelId } from "./openai-codex.ts"
import { openRouterDefaultModelId } from "./openrouter.ts"
import { qwenCodeDefaultModelId } from "./qwen-code.ts"
import { requestyDefaultModelId } from "./requesty.ts"
import { rooDefaultModelId } from "./jabberwock.ts"
import { sambaNovaDefaultModelId } from "./sambanova.ts"
import { unboundDefaultModelId } from "./unbound.ts"
import { vertexDefaultModelId } from "./vertex.ts"
import { vscodeLlmDefaultModelId } from "./vscode-llm.ts"
import { xaiDefaultModelId } from "./xai.ts"
import { vercelAiGatewayDefaultModelId } from "./vercel-ai-gateway.ts"
import { internationalZAiDefaultModelId, mainlandZAiDefaultModelId } from "./zai.ts"
import { minimaxDefaultModelId } from "./minimax.ts"

// Import the ProviderName type from provider-settings to avoid duplication
import type { ProviderName } from "../provider-settings.ts"

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
		case "jabberwock":
			return rooDefaultModelId
		case "qwen-code":
			return qwenCodeDefaultModelId
		case "unbound":
			return unboundDefaultModelId
		case "vercel-ai-gateway":
			return vercelAiGatewayDefaultModelId
		case "anthropic":
		case "gemini-cli":
		case "fake-ai":
		default:
			return anthropicDefaultModelId
	}
}
