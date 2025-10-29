import type { ModelInfo } from "@roo-code/types"

/**
 * Determine effective per‑million prices for this request based on model tiers.
 * If tiers are defined, pick the first tier whose contextWindow >= tierBasisTokens.
 * Fallback to the last tier when all tiers are below the observed tokens.
 */
function selectTierPrices(
	modelInfo: ModelInfo,
	tierBasisTokens: number,
): {
	inputPrice: number
	outputPrice: number
	cacheReadsPrice: number
} {
	let inputPrice = modelInfo.inputPrice ?? 0
	let outputPrice = modelInfo.outputPrice ?? 0
	let cacheReadsPrice = modelInfo.cacheReadsPrice ?? 0

	const tiers = (modelInfo as ModelInfo).tiers
	if (Array.isArray(tiers) && tiers.length > 0) {
		// If tiers are "service tiers" (e.g., OpenAI flex/priority), they will have a name.
		// Do NOT auto-select by tokens in that case. Pricing is chosen explicitly by the provider path.
		const hasNamedTiers = (tiers as any[]).some(
			(t) => typeof (t as any).name === "string" && (t as any).name.length > 0,
		)

		if (!hasNamedTiers) {
			// Choose the smallest tier that can accommodate the request's input size
			let chosen =
				tiers.find(
					(t) =>
						tierBasisTokens <=
						(t.contextWindow === Infinity ? Number.POSITIVE_INFINITY : (t.contextWindow as number)),
				) || tiers[tiers.length - 1]!

			inputPrice = chosen.inputPrice ?? inputPrice
			outputPrice = chosen.outputPrice ?? outputPrice
			cacheReadsPrice = chosen.cacheReadsPrice ?? cacheReadsPrice
		}
	}

	return { inputPrice, outputPrice, cacheReadsPrice }
}

function calculateApiCostInternal(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens: number,
	cacheReadInputTokens: number,
	// Use total input tokens (before cache deductions) to determine tier selection
	tierBasisTokens: number,
): number {
	const { inputPrice, outputPrice, cacheReadsPrice } = selectTierPrices(modelInfo, tierBasisTokens)

	const cacheWritesPrice = modelInfo.cacheWritesPrice || 0
	const cacheWritesCost = (cacheWritesPrice / 1_000_000) * cacheCreationInputTokens
	const cacheReadsCost = (cacheReadsPrice / 1_000_000) * cacheReadInputTokens
	const baseInputCost = (inputPrice / 1_000_000) * inputTokens
	const outputCost = (outputPrice / 1_000_000) * outputTokens

	return cacheWritesCost + cacheReadsCost + baseInputCost + outputCost
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
		// Tier basis for Anthropic protocol = actual input tokens (no cache included)
		inputTokens,
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
		// Tier basis for OpenAI protocol = total input tokens before subtracting cache
		inputTokens,
	)
}

export const parseApiPrice = (price: any) => (price ? parseFloat(price) * 1_000_000 : undefined)
