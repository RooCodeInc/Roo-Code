import type { DiffStats } from "@roo-code/types"

/**
 * Type guard to check if a value is a finite number
 * @param value - The value to check
 * @returns true if the value is a number and is finite
 */
export function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value)
}

/**
 * Type guard to check if a value conforms to the DiffStats interface
 * @param value - The value to check
 * @returns true if the value has valid `added` and `removed` properties that are finite numbers
 */
export function isDiffStats(value: unknown): value is DiffStats {
	if (!value || typeof value !== "object") return false

	const v = value as { added?: unknown; removed?: unknown }
	return isFiniteNumber(v.added) && isFiniteNumber(v.removed)
}
