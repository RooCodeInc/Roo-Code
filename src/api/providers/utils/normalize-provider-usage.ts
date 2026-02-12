import type { ModelInfo } from "@roo-code/types"

import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "../../../shared/cost"
import type { ApiStreamUsageChunk } from "../../transform/stream"
import { type CanonicalUsageMetrics, type UsageLike, toFiniteNumber, getValueAtPath } from "./usage-metrics"
import { type UsageMetricPaths, type UsageProtocol, getUsageProfile } from "./usage-profiles"

interface UsageSources {
	providerMetadata?: Record<string, unknown>
	usage?: Record<string, unknown>
	raw?: Record<string, unknown>
}

export interface NormalizeProviderUsageOptions {
	provider: string
	apiProtocol?: UsageProtocol
	usage: UsageLike
	providerMetadata?: Record<string, unknown>
	modelInfo?: ModelInfo
	totalCostOverride?: number
	emitZeroCacheTokens?: boolean
	deriveNonCachedInputFromTotalMinusCache?: boolean
}

export interface NormalizeProviderUsageResult {
	canonical: CanonicalUsageMetrics
	chunk: ApiStreamUsageChunk
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined
}

function readMetricFromPaths(sources: UsageSources, paths?: UsageMetricPaths): number | undefined {
	if (!paths) return undefined

	// Precedence policy: providerMetadata > usage > raw
	const providerMetadataNumber =
		paths.providerMetadata && paths.providerMetadata.length > 0
			? firstNumberFromPathsWithArraySupport(sources.providerMetadata, paths.providerMetadata)
			: undefined
	if (providerMetadataNumber !== undefined) {
		return providerMetadataNumber
	}

	const usageNumber =
		paths.usage && paths.usage.length > 0
			? firstNumberFromPathsWithArraySupport(sources.usage, paths.usage)
			: undefined
	if (usageNumber !== undefined) {
		return usageNumber
	}

	const rawNumber =
		paths.raw && paths.raw.length > 0 ? firstNumberFromPathsWithArraySupport(sources.raw, paths.raw) : undefined
	if (rawNumber !== undefined) {
		return rawNumber
	}

	return undefined
}

function firstNumberFromPathsWithArraySupport(source: unknown, paths: string[]): number | undefined {
	if (!source) return undefined

	for (const path of paths) {
		const value = getValueAtPath(source, path)
		const num = toFiniteNumber(value as number | string | null | undefined)
		if (num !== undefined) {
			return num
		}

		if (Array.isArray(value)) {
			const sum = value.reduce((acc, item) => {
				if (typeof item !== "object" || item === null) return acc
				const maybeTokenCount = toFiniteNumber((item as Record<string, unknown>).tokenCount as any) ?? 0
				return acc + maybeTokenCount
			}, 0)
			if (sum > 0) {
				return sum
			}
		}
	}

	return undefined
}

function buildCanonicalMetrics(options: NormalizeProviderUsageOptions): CanonicalUsageMetrics {
	const profile = getUsageProfile(options.provider, options.apiProtocol)
	const usageRecord = toRecord(options.usage) ?? {}

	const sources: UsageSources = {
		providerMetadata: options.providerMetadata,
		usage: usageRecord,
		raw: toRecord(options.usage.raw),
	}

	const cacheWriteTokens = readMetricFromPaths(sources, profile.metrics.cacheWriteTokens) ?? 0
	const cacheReadTokens = readMetricFromPaths(sources, profile.metrics.cacheReadTokens) ?? 0
	const outputTokens = readMetricFromPaths(sources, profile.metrics.outputTokens) ?? 0
	const reasoningTokens = readMetricFromPaths(sources, profile.metrics.reasoningTokens)
	const totalCostCandidate = readMetricFromPaths(sources, profile.metrics.totalCostCandidate)

	let inputTokensTotal = readMetricFromPaths(sources, profile.metrics.inputTokensTotal)
	let inputTokensNonCached = readMetricFromPaths(sources, profile.metrics.inputTokensNonCached)

	const shouldDeriveNonCached =
		options.deriveNonCachedInputFromTotalMinusCache ??
		profile.deriveNonCachedInputFromTotalMinusCache ??
		profile.apiProtocol === "openai"

	if (inputTokensNonCached === undefined && shouldDeriveNonCached) {
		if (inputTokensTotal !== undefined) {
			inputTokensNonCached = Math.max(0, inputTokensTotal - cacheWriteTokens - cacheReadTokens)
		}
	}

	if (inputTokensTotal === undefined) {
		if (inputTokensNonCached !== undefined) {
			inputTokensTotal = inputTokensNonCached + cacheWriteTokens + cacheReadTokens
		} else {
			inputTokensTotal = 0
		}
	}

	return {
		inputTokensTotal,
		inputTokensNonCached,
		outputTokens,
		cacheWriteTokens,
		cacheReadTokens,
		reasoningTokens,
		totalCostCandidate,
	}
}

function computeFallbackCost(
	modelInfo: ModelInfo | undefined,
	apiProtocol: UsageProtocol,
	canonical: CanonicalUsageMetrics,
): number | undefined {
	if (!modelInfo) return undefined

	if (apiProtocol === "anthropic") {
		const nonCached =
			canonical.inputTokensNonCached ??
			Math.max(0, canonical.inputTokensTotal - canonical.cacheWriteTokens - canonical.cacheReadTokens)

		return calculateApiCostAnthropic(
			modelInfo,
			nonCached,
			canonical.outputTokens,
			canonical.cacheWriteTokens,
			canonical.cacheReadTokens,
		).totalCost
	}

	return calculateApiCostOpenAI(
		modelInfo,
		canonical.inputTokensTotal,
		canonical.outputTokens,
		canonical.cacheWriteTokens,
		canonical.cacheReadTokens,
	).totalCost
}

export function normalizeProviderUsage(options: NormalizeProviderUsageOptions): NormalizeProviderUsageResult {
	const profile = getUsageProfile(options.provider, options.apiProtocol)
	const canonical = buildCanonicalMetrics(options)

	const totalCost =
		options.totalCostOverride ??
		canonical.totalCostCandidate ??
		computeFallbackCost(options.modelInfo, profile.apiProtocol, canonical)

	const emitZeroCacheTokens = options.emitZeroCacheTokens ?? profile.emitZeroCacheTokens ?? false

	return {
		canonical,
		chunk: {
			type: "usage",
			inputTokens: canonical.inputTokensTotal,
			nonCachedInputTokens: canonical.inputTokensNonCached,
			outputTokens: canonical.outputTokens,
			cacheWriteTokens:
				emitZeroCacheTokens || canonical.cacheWriteTokens > 0 ? canonical.cacheWriteTokens : undefined,
			cacheReadTokens:
				emitZeroCacheTokens || canonical.cacheReadTokens > 0 ? canonical.cacheReadTokens : undefined,
			reasoningTokens: canonical.reasoningTokens,
			totalCost,
		},
	}
}
