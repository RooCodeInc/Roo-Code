import type { ModelInfo } from "@roo-code/types"
import type { ServiceTier } from "@roo-code/types"

export interface ApiCostResult {
	totalInputTokens: number
	totalOutputTokens: number
	totalCost: number
}

function applyLongContextPricing(modelInfo: ModelInfo, totalInputTokens: number, serviceTier?: ServiceTier): ModelInfo {
	const pricing = modelInfo.longContextPricing
	if (!pricing || totalInputTokens <= pricing.thresholdTokens) {
		return modelInfo
	}

	const effectiveServiceTier = serviceTier ?? "default"
	if (pricing.appliesToServiceTiers && !pricing.appliesToServiceTiers.includes(effectiveServiceTier)) {
		return modelInfo
	}

	return {
		...modelInfo,
		inputPrice:
			modelInfo.inputPrice !== undefined && pricing.inputPriceMultiplier !== undefined
				? modelInfo.inputPrice * pricing.inputPriceMultiplier
				: modelInfo.inputPrice,
		outputPrice:
			modelInfo.outputPrice !== undefined && pricing.outputPriceMultiplier !== undefined
				? modelInfo.outputPrice * pricing.outputPriceMultiplier
				: modelInfo.outputPrice,
		cacheWritesPrice:
			modelInfo.cacheWritesPrice !== undefined && pricing.cacheWritesPriceMultiplier !== undefined
				? modelInfo.cacheWritesPrice * pricing.cacheWritesPriceMultiplier
				: modelInfo.cacheWritesPrice,
		cacheReadsPrice:
			modelInfo.cacheReadsPrice !== undefined && pricing.cacheReadsPriceMultiplier !== undefined
				? modelInfo.cacheReadsPrice * pricing.cacheReadsPriceMultiplier
				: modelInfo.cacheReadsPrice,
	}
}

function calculateApiCostInternal(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens: number,
	cacheReadInputTokens: number,
	totalInputTokens: number,
	totalOutputTokens: number,
): ApiCostResult {
	const cacheWritesCost = ((modelInfo.cacheWritesPrice || 0) / 1_000_000) * cacheCreationInputTokens
	const cacheReadsCost = ((modelInfo.cacheReadsPrice || 0) / 1_000_000) * cacheReadInputTokens
	const baseInputCost = ((modelInfo.inputPrice || 0) / 1_000_000) * inputTokens
	const outputCost = ((modelInfo.outputPrice || 0) / 1_000_000) * outputTokens
	const totalCost = cacheWritesCost + cacheReadsCost + baseInputCost + outputCost

	return {
		totalInputTokens,
		totalOutputTokens,
		totalCost,
	}
}

// For Anthropic compliant usage, the input tokens count does NOT include the
// cached tokens.
export function calculateApiCostAnthropic(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens?: number,
	cacheReadInputTokens?: number,
): ApiCostResult {
	const cacheCreation = cacheCreationInputTokens || 0
	const cacheRead = cacheReadInputTokens || 0

	// For Anthropic: inputTokens does NOT include cached tokens
	// Total input = base input + cache creation + cache reads
	const totalInputTokens = inputTokens + cacheCreation + cacheRead

	return calculateApiCostInternal(
		modelInfo,
		inputTokens,
		outputTokens,
		cacheCreation,
		cacheRead,
		totalInputTokens,
		outputTokens,
	)
}

// For OpenAI compliant usage, the input tokens count INCLUDES the cached tokens.
export function calculateApiCostOpenAI(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens?: number,
	cacheReadInputTokens?: number,
	serviceTier?: ServiceTier,
): ApiCostResult {
	const cacheCreationInputTokensNum = cacheCreationInputTokens || 0
	const cacheReadInputTokensNum = cacheReadInputTokens || 0
	const nonCachedInputTokens = Math.max(0, inputTokens - cacheCreationInputTokensNum - cacheReadInputTokensNum)
	const effectiveModelInfo = applyLongContextPricing(modelInfo, inputTokens, serviceTier)

	// For OpenAI: inputTokens ALREADY includes all tokens (cached + non-cached)
	// So we pass the original inputTokens as the total
	return calculateApiCostInternal(
		effectiveModelInfo,
		nonCachedInputTokens,
		outputTokens,
		cacheCreationInputTokensNum,
		cacheReadInputTokensNum,
		inputTokens,
		outputTokens,
	)
}

export const parseApiPrice = (price: any) => (price ? parseFloat(price) * 1_000_000 : undefined)
