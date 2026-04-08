// npx vitest run src/shared/__tests__/experiments.spec.ts

import type { ExperimentId } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap, experiments as Experiments } from "../experiments"

describe("experiments", () => {
	describe("PREVENT_FOCUS_DISRUPTION", () => {
		it("is configured correctly", () => {
			expect(EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION).toBe("preventFocusDisruption")
			expect(experimentConfigsMap.PREVENT_FOCUS_DISRUPTION).toMatchObject({
				enabled: false,
			})
		})
	})

	describe("RE_ANCHOR_BEFORE_EDIT", () => {
		it("is configured correctly", () => {
			expect(EXPERIMENT_IDS.RE_ANCHOR_BEFORE_EDIT).toBe("reAnchorBeforeEdit")
			expect(experimentConfigsMap.RE_ANCHOR_BEFORE_EDIT).toMatchObject({
				enabled: false,
			})
		})

		it("returns false when not enabled", () => {
			const experiments: Record<ExperimentId, boolean> = {
				preventFocusDisruption: false,
				imageGeneration: false,
				runSlashCommand: false,
				customTools: false,
				reAnchorBeforeEdit: false,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.RE_ANCHOR_BEFORE_EDIT)).toBe(false)
		})

		it("returns true when enabled", () => {
			const experiments: Record<ExperimentId, boolean> = {
				preventFocusDisruption: false,
				imageGeneration: false,
				runSlashCommand: false,
				customTools: false,
				reAnchorBeforeEdit: true,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.RE_ANCHOR_BEFORE_EDIT)).toBe(true)
		})
	})

	describe("isEnabled", () => {
		it("returns false when experiment is not enabled", () => {
			const experiments: Record<ExperimentId, boolean> = {
				preventFocusDisruption: false,
				imageGeneration: false,
				runSlashCommand: false,
				customTools: false,
				reAnchorBeforeEdit: false,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)).toBe(false)
		})

		it("returns true when experiment is enabled", () => {
			const experiments: Record<ExperimentId, boolean> = {
				preventFocusDisruption: true,
				imageGeneration: false,
				runSlashCommand: false,
				customTools: false,
				reAnchorBeforeEdit: false,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)).toBe(true)
		})

		it("returns false when experiment is not present", () => {
			const experiments: Record<ExperimentId, boolean> = {
				preventFocusDisruption: false,
				imageGeneration: false,
				runSlashCommand: false,
				customTools: false,
				reAnchorBeforeEdit: false,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)).toBe(false)
		})
	})
})
