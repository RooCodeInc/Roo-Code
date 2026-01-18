import { describe, it, expect } from "vitest"

import { computeTaskCostsIncludingSubtasks, getTaskHeaderCostTooltipData } from "@src/utils/taskCostBreakdown"

describe("taskCostBreakdown", () => {
	it("sums subtask line-item costs (micros) and produces a stable total", () => {
		const result = computeTaskCostsIncludingSubtasks(0.05, [0.16, 0.13])

		expect(result.ownCostCents).toBe(5)
		expect(result.subtasksCostCents).toBe(29)
		expect(result.totalCostIncludingSubtasksCents).toBe(34)
		expect(result.totalCostIncludingSubtasks).toBeCloseTo(0.34, 10)
	})

	it("prefers derived subtask sum over provided breakdown/aggregatedCost when details are available", () => {
		const data = getTaskHeaderCostTooltipData({
			ownCost: 0.05,
			aggregatedCost: 0.09,
			hasSubtasksProp: true,
			costBreakdownProp: "Own: $0.05 + Subtasks: $0.09",
			subtaskCosts: [0.16, 0.13],
			labels: { own: "Own", subtasks: "Subtasks" },
		})

		expect(data.displayTotalCost).toBeCloseTo(0.34, 10)
		expect(data.displayCostBreakdown).toBe("Own: $0.05 + Subtasks: $0.29")
		expect(data.hasSubtasks).toBe(true)
		expect(data.hasAnyCost).toBe(true)
	})
})
