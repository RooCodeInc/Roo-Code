/**
 * Type guard to check if a value is a finite number
 * @param value - The value to check
 * @returns true if the value is a number and is finite
 */
export function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value)
}
