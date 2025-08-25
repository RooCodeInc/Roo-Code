import type { ModelInfo } from "../model.js"

// https://ai-gateway.vercel.sh/v1/
export const vercelAiGatewayDefaultModelId = "anthropic/claude-sonnet-4"

export const vercelAiGatewayDefaultModelInfo: ModelInfo = {
	maxTokens: 64000,
	contextWindow: 128000,
	supportsImages: true,
	supportsPromptCache: true,
	inputPrice: 3,
	outputPrice: 15,
	cacheWritesPrice: 3.75,
	cacheReadsPrice: 0.3,
	description:
		"Claude Sonnet 4 significantly improves on Sonnet 3.7's industry-leading capabilities, excelling in coding with a state-of-the-art 72.7% on SWE-bench. The model balances performance and efficiency for internal and external use cases, with enhanced steerability for greater control over implementations. While not matching Opus 4 in most domains, it delivers an optimal mix of capability and practicality.",
}

export const VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE = 0
