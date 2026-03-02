import type { EvalOutcomeId } from "./eval-outcomes"

type ObjectiveMetric = { score: number; costUsd: number; runtimeS: number }

type ModelObjectiveMetrics = {
	modelId: string
	issueResolution: ObjectiveMetric
	frontend: ObjectiveMetric
	greenfield: ObjectiveMetric
	testing: ObjectiveMetric
	infoGathering: ObjectiveMetric
}

type EvalOptimizationModeV1 = "best" | "fastest" | "cost"

type ObjectiveWeights = {
	issueResolution: number
	frontend: number
	greenfield: number
	testing: number
	infoGathering: number
}

type WeightedObjectiveMetrics = { score: number; costUsd: number; runtimeS: number }

export type ObjectiveDefaultModelV1 = {
	modelId: string
	weighted: WeightedObjectiveMetrics
}

const MODEL_METRICS_V1: ModelObjectiveMetrics[] = [
	{
		modelId: "claude-opus-4-6",
		issueResolution: { score: 74.8, costUsd: 0.56, runtimeS: 178 },
		frontend: { score: 41.8, costUsd: 2.37, runtimeS: 602 },
		greenfield: { score: 43.8, costUsd: 2.5, runtimeS: 388 },
		testing: { score: 78.8, costUsd: 0.43, runtimeS: 138 },
		infoGathering: { score: 80, costUsd: 1.33, runtimeS: 526 },
	},
	{
		modelId: "GPT-5.2-Codex",
		issueResolution: { score: 73.8, costUsd: 0.94, runtimeS: 438 },
		frontend: { score: 35.9, costUsd: 2.97, runtimeS: 1434 },
		greenfield: { score: 62.5, costUsd: 2.5, runtimeS: 838 },
		testing: { score: 62.5, costUsd: 0.66, runtimeS: 343 },
		infoGathering: { score: 70.9, costUsd: 1.66, runtimeS: 799 },
	},
	{
		modelId: "claude-opus-4-5",
		issueResolution: { score: 76.6, costUsd: 1.82, runtimeS: 325 },
		frontend: { score: 41.2, costUsd: 2.54, runtimeS: 671 },
		greenfield: { score: 37.5, costUsd: 4.65, runtimeS: 495 },
		testing: { score: 78.5, costUsd: 1.38, runtimeS: 268 },
		infoGathering: { score: 69.1, costUsd: 0.55, runtimeS: 97 },
	},
	{
		modelId: "MiniMax-M2.5",
		issueResolution: { score: 72.6, costUsd: 0.1, runtimeS: 455 },
		frontend: { score: 25, costUsd: 0.15, runtimeS: 611 },
		greenfield: { score: 50, costUsd: 0.16, runtimeS: 376 },
		testing: { score: 68.1, costUsd: 0.07, runtimeS: 389 },
		infoGathering: { score: 47.9, costUsd: 0.06, runtimeS: 716 },
	},
	{
		modelId: "GPT-5.2",
		issueResolution: { score: 74.6, costUsd: 0.86, runtimeS: 476 },
		frontend: { score: 30.9, costUsd: 2.77, runtimeS: 1571 },
		greenfield: { score: 18.8, costUsd: 0.71, runtimeS: 397 },
		testing: { score: 73.2, costUsd: 0.56, runtimeS: 347 },
		infoGathering: { score: 65.5, costUsd: 0.48, runtimeS: 189 },
	},
	{
		modelId: "claude-sonnet-4-5",
		issueResolution: { score: 74.2, costUsd: 1.19, runtimeS: 534 },
		frontend: { score: 36.8, costUsd: 1.89, runtimeS: 787 },
		greenfield: { score: 12.5, costUsd: 2.65, runtimeS: 744 },
		testing: { score: 68.8, costUsd: 0.98, runtimeS: 488 },
		infoGathering: { score: 58.8, costUsd: 0.38, runtimeS: 126 },
	},
	{
		modelId: "Kimi-K2.5",
		issueResolution: { score: 68.8, costUsd: 0.48, runtimeS: 707 },
		frontend: { score: 32.8, costUsd: 1.58, runtimeS: 921 },
		greenfield: { score: 18.8, costUsd: 0.96, runtimeS: 814 },
		testing: { score: 61.9, costUsd: 0.42, runtimeS: 385 },
		infoGathering: { score: 63.6, costUsd: 0.39, runtimeS: 602 },
	},
	{
		modelId: "Gemini-3-Flash",
		issueResolution: { score: 74.6, costUsd: 0.42, runtimeS: 343 },
		frontend: { score: 22.1, costUsd: 0.8, runtimeS: 1152 },
		greenfield: { score: 18.8, costUsd: 0.82, runtimeS: 399 },
		testing: { score: 70.7, costUsd: 0.3, runtimeS: 213 },
		infoGathering: { score: 58.8, costUsd: 0.38, runtimeS: 398 },
	},
	{
		modelId: "DeepSeek-V3.2-Reasoner",
		issueResolution: { score: 71.6, costUsd: 0.16, runtimeS: 1429 },
		frontend: { score: 27.9, costUsd: 0.19, runtimeS: 1515 },
		greenfield: { score: 31.2, costUsd: 0.12, runtimeS: 1411 },
		testing: { score: 53.6, costUsd: 0.12, runtimeS: 1215 },
		infoGathering: { score: 50.3, costUsd: 0.06, runtimeS: 427 },
	},
	{
		modelId: "Gemini-3-Pro",
		issueResolution: { score: 70.6, costUsd: 0.95, runtimeS: 343 },
		frontend: { score: 36.8, costUsd: 1.46, runtimeS: 710 },
		greenfield: { score: 12.5, costUsd: 2.68, runtimeS: 554 },
		testing: { score: 68.6, costUsd: 1.01, runtimeS: 386 },
		infoGathering: { score: 44.2, costUsd: 1.5, runtimeS: 1775 },
	},
	{
		modelId: "MiniMax-M2.1",
		issueResolution: { score: 68.8, costUsd: 0.14, runtimeS: 579 },
		frontend: { score: 16.2, costUsd: 0.21, runtimeS: 1417 },
		greenfield: { score: 25, costUsd: 0.33, runtimeS: 826 },
		testing: { score: 61.4, costUsd: 0.11, runtimeS: 473 },
		infoGathering: { score: 40.6, costUsd: 0.06, runtimeS: 641 },
	},
	{
		modelId: "GLM-4.7",
		issueResolution: { score: 73.4, costUsd: 0.56, runtimeS: 1007 },
		frontend: { score: 22.1, costUsd: 0.66, runtimeS: 1519 },
		greenfield: { score: 12.5, costUsd: 0.54, runtimeS: 578 },
		testing: { score: 49.4, costUsd: 0.37, runtimeS: 744 },
		infoGathering: { score: 53.9, costUsd: 0.46, runtimeS: 1138 },
	},
	{
		modelId: "Kimi-K2-Thinking",
		issueResolution: { score: 69.2, costUsd: 2, runtimeS: 1325 },
		frontend: { score: 32.4, costUsd: 2.31, runtimeS: 1641 },
		greenfield: { score: 18.8, costUsd: 6.78, runtimeS: 2314 },
		testing: { score: 47.3, costUsd: 1.39, runtimeS: 1253 },
		infoGathering: { score: 43.6, costUsd: 0.65, runtimeS: 279 },
	},
	{
		modelId: "Qwen3-Coder-480B",
		issueResolution: { score: 62.4, costUsd: 1.26, runtimeS: 680 },
		frontend: { score: 23.5, costUsd: 2.09, runtimeS: 1006 },
		greenfield: { score: 0, costUsd: 1.79, runtimeS: 924 },
		testing: { score: 34.9, costUsd: 0.97, runtimeS: 626 },
		infoGathering: { score: 33.9, costUsd: 0.28, runtimeS: 197 },
	},
]

function getOutcomeWeights(outcomeId: EvalOutcomeId): ObjectiveWeights {
	// These are intentionally opinionated. They exist to make the prototype feel realistic
	// before we wire real Roo Code Cloud evals.
	switch (outcomeId) {
		// Idea → Prototype
		case "review_guardrails":
			return { greenfield: 0.5, infoGathering: 0.35, frontend: 0.1, testing: 0.05, issueResolution: 0 }
		// Prototype → PR
		case "prototype_to_pr":
			return { greenfield: 0.35, testing: 0.35, issueResolution: 0.2, frontend: 0.1, infoGathering: 0 }
		// Issue → PR
		case "issue_to_pr":
			return { issueResolution: 0.4, testing: 0.3, infoGathering: 0.2, frontend: 0.1, greenfield: 0 }
		// Customer Escalation → Resolved
		case "sentry_triage":
			return { issueResolution: 0.55, infoGathering: 0.25, testing: 0.2, frontend: 0, greenfield: 0 }
		// Bug Report → Fix
		case "repro_to_fix":
			return { issueResolution: 0.45, testing: 0.4, infoGathering: 0.15, frontend: 0, greenfield: 0 }
		// Paper Cuts → Shipped
		case "paper_cuts":
			return { frontend: 0.6, issueResolution: 0.2, testing: 0.2, greenfield: 0, infoGathering: 0 }
	}
}

function getWeightedMetrics(row: ModelObjectiveMetrics, weights: ObjectiveWeights): WeightedObjectiveMetrics {
	const score =
		row.issueResolution.score * weights.issueResolution +
		row.frontend.score * weights.frontend +
		row.greenfield.score * weights.greenfield +
		row.testing.score * weights.testing +
		row.infoGathering.score * weights.infoGathering
	const costUsd =
		row.issueResolution.costUsd * weights.issueResolution +
		row.frontend.costUsd * weights.frontend +
		row.greenfield.costUsd * weights.greenfield +
		row.testing.costUsd * weights.testing +
		row.infoGathering.costUsd * weights.infoGathering
	const runtimeS =
		row.issueResolution.runtimeS * weights.issueResolution +
		row.frontend.runtimeS * weights.frontend +
		row.greenfield.runtimeS * weights.greenfield +
		row.testing.runtimeS * weights.testing +
		row.infoGathering.runtimeS * weights.infoGathering
	return { score, costUsd, runtimeS }
}

function pickByMode(
	rows: Array<{ modelId: string; weighted: WeightedObjectiveMetrics }>,
	mode: EvalOptimizationModeV1,
): { modelId: string; weighted: WeightedObjectiveMetrics } {
	const bestByQuality = rows.reduce((best, cur) => (cur.weighted.score > best.weighted.score ? cur : best))

	// For speed/cost modes, don't pick a model that is dramatically worse on quality.
	// This keeps the v1 prototype recommendations feeling credible even when a model is
	// extremely cheap or fast but underperforms for the selected objective.
	const QUALITY_FLOOR = 0.85
	const qualityThreshold = bestByQuality.weighted.score * QUALITY_FLOOR
	const qualityGated = rows.filter((r) => r.weighted.score >= qualityThreshold)
	const pool = qualityGated.length > 0 ? qualityGated : rows

	if (mode === "fastest") {
		return pool.reduce((best, cur) => (cur.weighted.runtimeS < best.weighted.runtimeS ? cur : best))
	}
	if (mode === "cost") {
		return pool.reduce((best, cur) => (cur.weighted.costUsd < best.weighted.costUsd ? cur : best))
	}
	return bestByQuality
}

export function pickObjectiveDefaultModelV1(
	outcomeId: EvalOutcomeId,
	mode: EvalOptimizationModeV1,
): ObjectiveDefaultModelV1 | null {
	const weights = getOutcomeWeights(outcomeId)
	const candidates = MODEL_METRICS_V1.map((row) => ({
		modelId: row.modelId,
		weighted: getWeightedMetrics(row, weights),
	}))
	if (candidates.length === 0) return null
	return pickByMode(candidates, mode)
}
