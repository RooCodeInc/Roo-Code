export * from "./anthropic.js"
export * from "./azure.js"
export * from "./baseten.js"
export * from "./bedrock.js"
export * from "./deepseek.js"
export * from "./fireworks.js"
export * from "./gemini.js"
export * from "./lite-llm.js"
export * from "./lm-studio.js"
export * from "./mistral.js"
export * from "./moonshot.js"
export * from "./ollama.js"
export * from "./openai.js"
export * from "./openai-codex.js"
export * from "./openai-codex-rate-limits.js"
export * from "./openrouter.js"
export * from "./qwen-code.js"
export * from "./requesty.js"
export * from "./roo.js"
export * from "./sambanova.js"
export * from "./vertex.js"
export * from "./vscode-llm.js"
export * from "./xai.js"
export * from "./vercel-ai-gateway.js"
export * from "./zai.js"
export * from "./minimax.js"

import { anthropicDefaultModelId } from "./anthropic.js"
import { azureDefaultModelId } from "./azure.js"
import { basetenDefaultModelId } from "./baseten.js"
import { bedrockDefaultModelId } from "./bedrock.js"
import { deepSeekDefaultModelId } from "./deepseek.js"
import { fireworksDefaultModelId } from "./fireworks.js"
import { geminiDefaultModelId } from "./gemini.js"
import { litellmDefaultModelId } from "./lite-llm.js"
import { mistralDefaultModelId } from "./mistral.js"
import { moonshotDefaultModelId } from "./moonshot.js"
import { openAiCodexDefaultModelId } from "./openai-codex.js"
import { openRouterDefaultModelId } from "./openrouter.js"
import { qwenCodeDefaultModelId } from "./qwen-code.js"
import { requestyDefaultModelId } from "./requesty.js"
import { rooDefaultModelId } from "./roo.js"
import { sambaNovaDefaultModelId } from "./sambanova.js"
import { vertexDefaultModelId } from "./vertex.js"
import { vscodeLlmDefaultModelId } from "./vscode-llm.js"
import { xaiDefaultModelId } from "./xai.js"
import { vercelAiGatewayDefaultModelId } from "./vercel-ai-gateway.js"
import { internationalZAiDefaultModelId, mainlandZAiDefaultModelId } from "./zai.js"
import { minimaxDefaultModelId } from "./minimax.js"

// Import the ProviderName type from provider-settings to avoid duplication
import type { ProviderName } from "../provider-settings.js"

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
		case "azure":
			return azureDefaultModelId
		case "anthropic":
		case "gemini-cli":
		case "fake-ai":
		default:
			return anthropicDefaultModelId
	}
}
