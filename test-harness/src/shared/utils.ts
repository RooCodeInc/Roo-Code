/**
 * Shared Utilities
 *
 * Safe, general-purpose helper functions.
 * These are outside any intent scope and should always be readable.
 */

/**
 * Clamp a number between min and max bounds.
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

/**
 * Generate a random alphanumeric string of a given length.
 */
export function randomId(length: number = 12): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	let result = ""
	for (let i = 0; i < length; i++) {
		result += chars[Math.floor(Math.random() * chars.length)]
	}
	return result
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
	if (!str) return str
	return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Deep freeze an object to prevent mutation.
 */
export function deepFreeze<T extends Record<string, any>>(obj: T): Readonly<T> {
	Object.freeze(obj)
	for (const key of Object.keys(obj)) {
		if (typeof obj[key] === "object" && obj[key] !== null && !Object.isFrozen(obj[key])) {
			deepFreeze(obj[key])
		}
	}
	return obj
}
