import type { ApiStreamUsageChunk } from "../../transform/stream"

type NumberLike = number | string | null | undefined

export type UsageLike = {
	inputTokens?: number
	outputTokens?: number
	inputTokenDetails?: {
		noCacheTokens?: number
		cacheReadTokens?: number
		cacheWriteTokens?: number
	}
	details?: {
		cachedInputTokens?: number
	}
	cacheCreationInputTokens?: number
	cache_creation_input_tokens?: number
	cachedInputTokens?: number
	cached_tokens?: number
	raw?: Record<string, unknown>
}

export interface CanonicalUsageMetrics {
	inputTokensTotal: number
	inputTokensNonCached?: number
	outputTokens: number
	cacheWriteTokens: number
	cacheReadTokens: number
	reasoningTokens?: number
	totalCostCandidate?: number
}

export interface NormalizeUsageMetricsOptions {
	usage: UsageLike
	apiProtocol?: "anthropic" | "openai"
	cacheWriteCandidates?: NumberLike[]
	cacheReadCandidates?: NumberLike[]
	inputNonCachedCandidates?: NumberLike[]
	reasoningCandidates?: NumberLike[]
	costCandidates?: NumberLike[]
	emitZeroCacheTokens?: boolean
	deriveAnthropicNoCacheFromTotalWhenMissing?: boolean
}

export function normalizeUsageMetrics({
	usage,
	apiProtocol,
	cacheWriteCandidates = [],
	cacheReadCandidates = [],
	inputNonCachedCandidates = [],
	reasoningCandidates = [],
	costCandidates = [],
	emitZeroCacheTokens = false,
	deriveAnthropicNoCacheFromTotalWhenMissing = false,
}: NormalizeUsageMetricsOptions): Pick<
	ApiStreamUsageChunk,
	| "inputTokens"
	| "nonCachedInputTokens"
	| "outputTokens"
	| "cacheWriteTokens"
	| "cacheReadTokens"
	| "reasoningTokens"
	| "totalCost"
> {
	const canonical = toCanonicalUsageMetrics({
		usage,
		apiProtocol,
		cacheWriteCandidates,
		cacheReadCandidates,
		inputNonCachedCandidates,
		reasoningCandidates,
		costCandidates,
		deriveAnthropicNoCacheFromTotalWhenMissing,
	})

	return {
		inputTokens: canonical.inputTokensTotal,
		nonCachedInputTokens: canonical.inputTokensNonCached,
		outputTokens: canonical.outputTokens,
		cacheWriteTokens:
			emitZeroCacheTokens || canonical.cacheWriteTokens > 0 ? canonical.cacheWriteTokens : undefined,
		cacheReadTokens: emitZeroCacheTokens || canonical.cacheReadTokens > 0 ? canonical.cacheReadTokens : undefined,
		reasoningTokens: canonical.reasoningTokens,
		totalCost: canonical.totalCostCandidate,
	}
}

export function toCanonicalUsageMetrics({
	usage,
	apiProtocol,
	cacheWriteCandidates = [],
	cacheReadCandidates = [],
	inputNonCachedCandidates = [],
	reasoningCandidates = [],
	costCandidates = [],
	deriveAnthropicNoCacheFromTotalWhenMissing = false,
}: NormalizeUsageMetricsOptions): CanonicalUsageMetrics {
	const promptTokens = toFiniteNumber(usage.inputTokens) ?? 0
	const outputTokens = toFiniteNumber(usage.outputTokens) ?? 0
	const raw = usage.raw
	const rawInputTokenDetails = asRecord(raw?.input_tokens_details)
	const rawOutputTokenDetails = asRecord(raw?.output_tokens_details)

	const cacheWriteTokens =
		firstNumber([
			...cacheWriteCandidates,
			usage.inputTokenDetails?.cacheWriteTokens,
			usage.cacheCreationInputTokens,
			usage.cache_creation_input_tokens,
			raw?.cache_creation_input_tokens as NumberLike,
			raw?.cacheCreationInputTokens as NumberLike,
		]) ?? 0

	const cacheReadTokens =
		firstNumber([
			...cacheReadCandidates,
			usage.inputTokenDetails?.cacheReadTokens,
			usage.details?.cachedInputTokens,
			usage.cachedInputTokens,
			usage.cached_tokens,
			raw?.cache_read_input_tokens as NumberLike,
			raw?.cacheReadInputTokens as NumberLike,
			raw?.cached_tokens as NumberLike,
			rawInputTokenDetails?.cached_tokens as NumberLike,
		]) ?? 0

	const reasoningTokens = firstNumber([
		...reasoningCandidates,
		(rawOutputTokenDetails?.reasoning_tokens as NumberLike) ?? undefined,
	])

	const explicitNoCacheTokens = firstNumber([...inputNonCachedCandidates, usage.inputTokenDetails?.noCacheTokens])

	let inputTokensNonCached = explicitNoCacheTokens
	if (inputTokensNonCached === undefined) {
		if (apiProtocol === "anthropic" && deriveAnthropicNoCacheFromTotalWhenMissing) {
			inputTokensNonCached = Math.max(0, promptTokens - cacheWriteTokens - cacheReadTokens)
		} else if (apiProtocol === "openai") {
			inputTokensNonCached = Math.max(0, promptTokens - cacheWriteTokens - cacheReadTokens)
		}
	}

	return {
		inputTokensTotal: promptTokens,
		inputTokensNonCached,
		outputTokens,
		cacheWriteTokens,
		cacheReadTokens,
		reasoningTokens,
		totalCostCandidate: firstNumber(costCandidates),
	}
}

export function toFiniteNumber(value: NumberLike): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value
	}
	if (typeof value === "string") {
		const parsed = Number(value)
		if (Number.isFinite(parsed)) {
			return parsed
		}
	}
	return undefined
}

export function getValueAtPath(source: unknown, path: string): unknown {
	if (!path) return source
	const normalized = path.replace(/\[(\d+)\]/g, ".$1")
	const segments = normalized.split(".").filter(Boolean)

	let cursor: unknown = source
	for (const segment of segments) {
		if (cursor === null || cursor === undefined) {
			return undefined
		}
		if (typeof cursor !== "object") {
			return undefined
		}
		cursor = (cursor as Record<string, unknown>)[segment]
	}

	return cursor
}

export function firstNumberFromPaths(source: unknown, paths: string[]): number | undefined {
	for (const path of paths) {
		const value = getValueAtPath(source, path)
		const asNumber = toFiniteNumber(value as NumberLike)
		if (asNumber !== undefined) {
			return asNumber
		}
	}
	return undefined
}

function firstNumber(values: NumberLike[]): number | undefined {
	for (const value of values) {
		const asNumber = toFiniteNumber(value)
		if (asNumber !== undefined) {
			return asNumber
		}
	}
	return undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined
}
