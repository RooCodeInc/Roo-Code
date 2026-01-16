import { formatCostBreakdown } from "@src/utils/costFormatting"

const MICROS_PER_DOLLAR = 1_000_000
const MICROS_PER_CENT = 10_000

function dollarsToMicros(amount: number): number {
	if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
		return 0
	}
	return Math.round(amount * MICROS_PER_DOLLAR)
}

function microsToDollars(micros: number): number {
	return micros / MICROS_PER_DOLLAR
}

export interface TaskCostsIncludingSubtasks {
	ownCost: number
	ownCostMicros: number
	ownCostCents: number

	subtasksCost: number
	subtasksCostMicros: number
	subtasksCostCents: number

	totalCostIncludingSubtasks: number
	totalCostIncludingSubtasksMicros: number
	totalCostIncludingSubtasksCents: number
}

/**
 * Computes task costs using integer micros for stable aggregation.
 *
 * Note: we only have access to floating-dollar amounts in the webview.
 * Converting to micros and summing avoids most floating point drift.
 */
export function computeTaskCostsIncludingSubtasks(ownCost: number, subtaskCosts: number[]): TaskCostsIncludingSubtasks {
	const ownCostMicros = dollarsToMicros(ownCost)
	const subtasksCostMicros = (subtaskCosts ?? []).reduce((sum, cost) => sum + dollarsToMicros(cost), 0)
	const totalCostIncludingSubtasksMicros = ownCostMicros + subtasksCostMicros

	const ownCostCents = Math.round(ownCostMicros / MICROS_PER_CENT)
	const subtasksCostCents = Math.round(subtasksCostMicros / MICROS_PER_CENT)
	const totalCostIncludingSubtasksCents = Math.round(totalCostIncludingSubtasksMicros / MICROS_PER_CENT)

	return {
		ownCost: microsToDollars(ownCostMicros),
		ownCostMicros,
		ownCostCents,
		subtasksCost: microsToDollars(subtasksCostMicros),
		subtasksCostMicros,
		subtasksCostCents,
		totalCostIncludingSubtasks: microsToDollars(totalCostIncludingSubtasksMicros),
		totalCostIncludingSubtasksMicros,
		totalCostIncludingSubtasksCents,
	}
}

export interface TaskHeaderCostTooltipData {
	/** Total cost to display (includes subtasks when details provided). */
	displayTotalCost: number
	/** Breakdown string to show in tooltip, if subtasks exist. */
	displayCostBreakdown?: string
	/** Whether the UI should show the "includes subtasks" marker. */
	hasSubtasks: boolean
	/** Whether there is any cost to render. */
	hasAnyCost: boolean
}

/**
 * Cost display logic for TaskHeader tooltip.
 *
 * When subtask details are available, this derives subtasks cost as the sum of
 * subtask line-item totals (same source as the accordion list), rather than
 * trusting any derived deltas.
 */
export function getTaskHeaderCostTooltipData(params: {
	ownCost: number
	aggregatedCost?: number
	hasSubtasksProp?: boolean
	costBreakdownProp?: string
	subtaskCosts?: number[]
	labels: { own: string; subtasks: string }
}): TaskHeaderCostTooltipData {
	const { ownCost, aggregatedCost, hasSubtasksProp, costBreakdownProp, subtaskCosts, labels } = params

	const computed = computeTaskCostsIncludingSubtasks(ownCost, subtaskCosts ?? [])
	const hasComputedSubtasks = computed.subtasksCostCents > 0
	const hasSubtasks = !!hasSubtasksProp || hasComputedSubtasks

	const displayTotalCost = hasComputedSubtasks ? computed.totalCostIncludingSubtasks : (aggregatedCost ?? ownCost)
	const displayCostBreakdown = hasComputedSubtasks
		? formatCostBreakdown(computed.ownCost, computed.subtasksCost, labels)
		: costBreakdownProp

	const hasAnyCost = typeof displayTotalCost === "number" && Number.isFinite(displayTotalCost) && displayTotalCost > 0

	return {
		displayTotalCost,
		displayCostBreakdown,
		hasSubtasks,
		hasAnyCost,
	}
}
