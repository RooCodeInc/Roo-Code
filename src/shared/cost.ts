import type { ModelInfo } from "@roo-code/types"

function calculateApiCostInternal(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens: number,
	cacheReadInputTokens: number,
): number {
	const cacheWritesCost = ((modelInfo.cacheWritesPrice || 0) / 1_000_000) * cacheCreationInputTokens
	const cacheReadsCost = ((modelInfo.cacheReadsPrice || 0) / 1_000_000) * cacheReadInputTokens
	const baseInputCost = ((modelInfo.inputPrice || 0) / 1_000_000) * inputTokens
	const outputCost = ((modelInfo.outputPrice || 0) / 1_000_000) * outputTokens
	const totalCost = cacheWritesCost + cacheReadsCost + baseInputCost + outputCost
	return totalCost
}

// For Anthropic compliant usage, the input tokens count does NOT include the
// cached tokens.
export function calculateApiCostAnthropic(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens?: number,
	cacheReadInputTokens?: number,
): number {
	return calculateApiCostInternal(
		modelInfo,
		inputTokens,
		outputTokens,
		cacheCreationInputTokens || 0,
		cacheReadInputTokens || 0,
	)
}

// For OpenAI compliant usage, the input tokens count INCLUDES the cached tokens.
export function calculateApiCostOpenAI(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens?: number,
	cacheReadInputTokens?: number,
): number {
	const cacheCreationInputTokensNum = cacheCreationInputTokens || 0
	const cacheReadInputTokensNum = cacheReadInputTokens || 0
	const nonCachedInputTokens = Math.max(0, inputTokens - cacheCreationInputTokensNum - cacheReadInputTokensNum)

	return calculateApiCostInternal(
		modelInfo,
		nonCachedInputTokens,
		outputTokens,
		cacheCreationInputTokensNum,
		cacheReadInputTokensNum,
	)
}

/**
 * Applies 50% discount to all pricing fields for Anthropic Batch API usage
 */
export function applyBatchApiDiscount(info: ModelInfo): ModelInfo {
	return {
		...info,
		inputPrice: typeof info.inputPrice === "number" ? info.inputPrice * 0.5 : undefined,
		outputPrice: typeof info.outputPrice === "number" ? info.outputPrice * 0.5 : undefined,
		cacheWritesPrice: typeof info.cacheWritesPrice === "number" ? info.cacheWritesPrice * 0.5 : undefined,
		cacheReadsPrice: typeof info.cacheReadsPrice === "number" ? info.cacheReadsPrice * 0.5 : undefined,
	}
}

export const parseApiPrice = (price: any) => (price ? parseFloat(price) * 1_000_000 : undefined)
