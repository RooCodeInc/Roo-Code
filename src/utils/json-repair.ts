/**
 * JSON repair utility for fixing malformed LLM responses.
 *
 * This module provides functionality to repair common JSON malformation issues
 * that occur when LLMs (especially models like Grok) struggle with strict
 * JSON formatting requirements.
 *
 * Common issues handled:
 * - Missing or trailing commas
 * - Unquoted property names or strings
 * - Missing closing brackets/braces
 * - Comments in JSON (single-line and block)
 * - Newlines in strings
 * - Escape character issues
 * - Mixed quote styles
 *
 * @see https://github.com/josdejong/jsonrepair
 */
import { jsonrepair, JSONRepairError } from "jsonrepair"

/**
 * Result of a JSON repair attempt.
 */
export interface JsonRepairResult {
	/** Whether the repair was successful */
	success: boolean
	/** The repaired JSON string (if successful) */
	repaired?: string
	/** The parsed JSON object (if successful) */
	parsed?: unknown
	/** Whether the original JSON was already valid */
	wasAlreadyValid: boolean
	/** Error message if repair failed */
	error?: string
}

/**
 * Attempt to repair malformed JSON and parse it.
 *
 * @param input - The potentially malformed JSON string
 * @returns A result object containing the repair status and parsed data
 */
export function tryRepairJson(input: string): JsonRepairResult {
	// First, try to parse as-is to avoid unnecessary repair
	try {
		const parsed = JSON.parse(input)
		return {
			success: true,
			repaired: input,
			parsed,
			wasAlreadyValid: true,
		}
	} catch {
		// JSON is malformed, attempt repair
	}

	// Attempt to repair the JSON
	try {
		const repaired = jsonrepair(input)
		const parsed = JSON.parse(repaired)
		return {
			success: true,
			repaired,
			parsed,
			wasAlreadyValid: false,
		}
	} catch (err) {
		const errorMessage =
			err instanceof JSONRepairError ? err.message : err instanceof Error ? err.message : String(err)

		return {
			success: false,
			wasAlreadyValid: false,
			error: `Failed to repair JSON: ${errorMessage}`,
		}
	}
}

/**
 * Repair malformed JSON string.
 * Returns the repaired string, or null if repair is not possible.
 *
 * @param input - The potentially malformed JSON string
 * @returns The repaired JSON string, or null if repair failed
 */
export function repairJson(input: string): string | null {
	const result = tryRepairJson(input)
	return result.success ? (result.repaired ?? null) : null
}

/**
 * Parse potentially malformed JSON, repairing if necessary.
 * Returns the parsed object, or null if parsing/repair failed.
 *
 * @param input - The potentially malformed JSON string
 * @returns The parsed JSON object, or null if parsing failed
 */
export function parseWithRepair<T = unknown>(input: string): T | null {
	const result = tryRepairJson(input)
	return result.success ? (result.parsed as T) : null
}

/**
 * Check if a string is valid JSON without attempting repair.
 *
 * @param input - The string to check
 * @returns true if the string is valid JSON, false otherwise
 */
export function isValidJson(input: string): boolean {
	try {
		JSON.parse(input)
		return true
	} catch {
		return false
	}
}
