import { describe, it, expect } from "vitest"
import { pickObjectiveDefaultModelV1 } from "../objective-default-models-v1"
import type { EvalOutcomeId } from "../eval-outcomes"

const ALL_OUTCOME_IDS: EvalOutcomeId[] = [
	"prototype_to_pr",
	"paper_cuts",
	"sentry_triage",
	"repro_to_fix",
	"review_guardrails",
	"issue_to_pr",
]

const ALL_MODES = ["best", "fastest", "cost"] as const

describe("pickObjectiveDefaultModelV1", () => {
	it("returns a non-null result for every outcome and mode combination", () => {
		for (const outcomeId of ALL_OUTCOME_IDS) {
			for (const mode of ALL_MODES) {
				const result = pickObjectiveDefaultModelV1(outcomeId, mode)
				expect(result).not.toBeNull()
				expect(result!.modelId).toBeTruthy()
				expect(result!.weighted).toBeDefined()
				expect(result!.weighted.score).toBeGreaterThan(0)
				expect(result!.weighted.costUsd).toBeGreaterThanOrEqual(0)
				expect(result!.weighted.runtimeS).toBeGreaterThan(0)
			}
		}
	})

	it("best mode picks the highest-scoring model", () => {
		for (const outcomeId of ALL_OUTCOME_IDS) {
			const best = pickObjectiveDefaultModelV1(outcomeId, "best")
			const fastest = pickObjectiveDefaultModelV1(outcomeId, "fastest")
			const cheapest = pickObjectiveDefaultModelV1(outcomeId, "cost")

			// The best-quality model should have a score >= any other mode's pick
			expect(best!.weighted.score).toBeGreaterThanOrEqual(fastest!.weighted.score)
			expect(best!.weighted.score).toBeGreaterThanOrEqual(cheapest!.weighted.score)
		}
	})

	it("fastest mode picks a model with lower or equal runtime than best", () => {
		for (const outcomeId of ALL_OUTCOME_IDS) {
			const best = pickObjectiveDefaultModelV1(outcomeId, "best")
			const fastest = pickObjectiveDefaultModelV1(outcomeId, "fastest")

			expect(fastest!.weighted.runtimeS).toBeLessThanOrEqual(best!.weighted.runtimeS)
		}
	})

	it("cost mode picks a model with lower or equal cost than best", () => {
		for (const outcomeId of ALL_OUTCOME_IDS) {
			const best = pickObjectiveDefaultModelV1(outcomeId, "best")
			const cheapest = pickObjectiveDefaultModelV1(outcomeId, "cost")

			expect(cheapest!.weighted.costUsd).toBeLessThanOrEqual(best!.weighted.costUsd)
		}
	})

	it("speed/cost picks stay within 85% quality floor of the best model", () => {
		for (const outcomeId of ALL_OUTCOME_IDS) {
			const best = pickObjectiveDefaultModelV1(outcomeId, "best")
			const fastest = pickObjectiveDefaultModelV1(outcomeId, "fastest")
			const cheapest = pickObjectiveDefaultModelV1(outcomeId, "cost")
			const qualityFloor = best!.weighted.score * 0.85

			expect(fastest!.weighted.score).toBeGreaterThanOrEqual(qualityFloor)
			expect(cheapest!.weighted.score).toBeGreaterThanOrEqual(qualityFloor)
		}
	})
})
