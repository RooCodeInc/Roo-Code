// npx vitest run src/shared/__tests__/experiments.spec.ts

import type { ExperimentId } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap, experiments as Experiments } from "../experiments"

describe("experiments", () => {
	describe("MULTI_FILE_APPLY_DIFF", () => {
		it("is configured correctly", () => {
			expect(EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF).toBe("multiFileApplyDiff")
			expect(experimentConfigsMap.MULTI_FILE_APPLY_DIFF).toMatchObject({
				enabled: false,
			})
		})
	})

	describe("isEnabled", () => {
		it("returns false when MULTI_FILE_APPLY_DIFF experiment is not enabled", () => {
			const experiments: Record<ExperimentId, boolean> = {
				multiFileApplyDiff: false,
				preventFocusDisruption: false,
				imageGeneration: false,
				runSlashCommand: false,
				multipleNativeToolCalls: false,
				customTools: false,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF)).toBe(false)
		})

		it("returns true when experiment MULTI_FILE_APPLY_DIFF is enabled", () => {
			const experiments: Record<ExperimentId, boolean> = {
				multiFileApplyDiff: true,
				preventFocusDisruption: false,
				imageGeneration: false,
				runSlashCommand: false,
				multipleNativeToolCalls: false,
				customTools: false,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF)).toBe(true)
		})

		it("returns false when experiment is not present", () => {
			const experiments: Record<ExperimentId, boolean> = {
				multiFileApplyDiff: false,
				preventFocusDisruption: false,
				imageGeneration: false,
				runSlashCommand: false,
				multipleNativeToolCalls: false,
				customTools: false,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF)).toBe(false)
		})
	})
})
