/**
 * Utility functions for task4-mixed test fixture
 */

/**
 * Formats a timestamp to ISO string
 */
export function formatTimestamp(date: Date): string {
	return date.toISOString()
}

/**
 * Validates if a string is a valid email
 */
export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

/**
 * Delays execution for the specified milliseconds
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generates a random ID string
 */
export function generateId(prefix: string = "id"): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Safely parses JSON with error handling
 */
export function safeJsonParse<T>(json: string): T | null {
	try {
		return JSON.parse(json) as T
	} catch (error) {
		console.error("JSON parse error:", error)
		return null
	}
}

/**
 * Capitalizes the first letter of a string
 */
export function capitalize(str: string): string {
	if (!str || str.length === 0) {
		return str
	}
	return str.charAt(0).toUpperCase() + str.slice(1)
}
