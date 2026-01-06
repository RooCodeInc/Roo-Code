/**
 * JSON Repair Utility
 *
 * Attempts to repair malformed JSON that may be produced by LLMs.
 * Common issues include:
 * - Missing closing brackets/braces
 * - Trailing commas
 * - Unquoted keys
 * - Unescaped special characters
 * - Missing quotes around string values
 * - Single quotes instead of double quotes
 * - Control characters in strings
 *
 * @see Issue #10481 - Use of BAML for parsing llm output to correct malformed responses
 */

export interface RepairResult {
	/** Whether repair was attempted (original JSON was invalid) */
	repaired: boolean
	/** The repaired JSON string (or original if repair was not needed or failed) */
	json: string
	/** The parsed JSON object (or undefined if parsing still failed) */
	parsed?: any
	/** Error message if repair failed */
	error?: string
}

/**
 * Attempt to repair and parse malformed JSON.
 *
 * @param input - The potentially malformed JSON string
 * @returns RepairResult with repaired JSON and/or parsed object
 */
export function repairJson(input: string): RepairResult {
	// First, try to parse as-is
	try {
		const parsed = JSON.parse(input)
		return { repaired: false, json: input, parsed }
	} catch {
		// JSON is invalid, attempt repair
	}

	// Attempt repair
	try {
		const repaired = attemptRepair(input)
		const parsed = JSON.parse(repaired)
		return { repaired: true, json: repaired, parsed }
	} catch (error) {
		return {
			repaired: true,
			json: input,
			error: `Failed to repair JSON: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

/**
 * Attempt to repair malformed JSON string.
 */
function attemptRepair(input: string): string {
	let json = input.trim()

	// Step 1: Handle common prefix issues
	// Sometimes LLMs add explanatory text before JSON
	json = stripNonJsonPrefix(json)

	// Step 2: Handle control characters in strings
	json = escapeControlCharacters(json)

	// Step 3: Replace single quotes with double quotes (but preserve escaped singles)
	json = replaceSingleQuotes(json)

	// Step 4: Quote unquoted keys
	json = quoteUnquotedKeys(json)

	// Step 5: Remove trailing commas
	json = removeTrailingCommas(json)

	// Step 6: Balance brackets and braces
	json = balanceBracketsAndBraces(json)

	// Step 7: Handle common string issues
	json = fixStringIssues(json)

	return json
}

/**
 * Strip non-JSON prefix text that LLMs sometimes add.
 */
function stripNonJsonPrefix(json: string): string {
	// Find the first { or [ character
	const objectStart = json.indexOf("{")
	const arrayStart = json.indexOf("[")

	if (objectStart === -1 && arrayStart === -1) {
		// No JSON structure found, return as-is
		return json
	}

	let startIndex: number
	if (objectStart === -1) {
		startIndex = arrayStart
	} else if (arrayStart === -1) {
		startIndex = objectStart
	} else {
		startIndex = Math.min(objectStart, arrayStart)
	}

	// Only strip if there's non-whitespace before the JSON
	const prefix = json.substring(0, startIndex).trim()
	if (prefix.length > 0) {
		return json.substring(startIndex)
	}

	return json
}

/**
 * Escape control characters that may be present in strings.
 */
function escapeControlCharacters(json: string): string {
	// Replace unescaped control characters (except within already escaped sequences)
	// eslint-disable-next-line no-control-regex
	return json.replace(/[\x00-\x1f]/g, (char) => {
		// Don't replace if it's a newline or tab in a reasonable context
		if (char === "\n" || char === "\t" || char === "\r") {
			return char
		}
		// Escape other control characters
		return "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")
	})
}

/**
 * Replace single quotes with double quotes for JSON compliance.
 * Handles the case where single quotes are used for strings.
 */
function replaceSingleQuotes(json: string): string {
	const result: string[] = []
	let inString = false
	let stringChar = ""
	let i = 0

	while (i < json.length) {
		const char = json[i]
		const prevChar = i > 0 ? json[i - 1] : ""

		if (inString) {
			if (char === stringChar && prevChar !== "\\") {
				// End of string
				result.push(stringChar === "'" ? '"' : char)
				inString = false
			} else if (char === '"' && stringChar === "'") {
				// Escape double quotes inside single-quoted strings
				result.push('\\"')
			} else {
				result.push(char)
			}
		} else {
			if (char === '"' || char === "'") {
				inString = true
				stringChar = char
				result.push('"')
			} else {
				result.push(char)
			}
		}
		i++
	}

	return result.join("")
}

/**
 * Quote unquoted keys in JSON objects.
 * Handles: {key: "value"} -> {"key": "value"}
 */
function quoteUnquotedKeys(json: string): string {
	// Match unquoted keys followed by colon
	// This regex looks for word characters not preceded by quotes
	return json.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3')
}

/**
 * Remove trailing commas before closing brackets/braces.
 * Handles: [1, 2, 3,] -> [1, 2, 3]
 */
function removeTrailingCommas(json: string): string {
	// Remove trailing commas before ] or }
	return json.replace(/,(\s*[}\]])/g, "$1")
}

/**
 * Balance unmatched brackets and braces.
 */
function balanceBracketsAndBraces(json: string): string {
	const stack: string[] = []
	let inString = false
	let stringChar = ""

	for (let i = 0; i < json.length; i++) {
		const char = json[i]
		const prevChar = i > 0 ? json[i - 1] : ""

		if (inString) {
			if (char === stringChar && prevChar !== "\\") {
				inString = false
			}
			continue
		}

		if (char === '"' || char === "'") {
			inString = true
			stringChar = char
			continue
		}

		if (char === "{" || char === "[") {
			stack.push(char)
		} else if (char === "}") {
			if (stack.length > 0 && stack[stack.length - 1] === "{") {
				stack.pop()
			}
		} else if (char === "]") {
			if (stack.length > 0 && stack[stack.length - 1] === "[") {
				stack.pop()
			}
		}
	}

	// If we're still in a string, try to close it
	let result = json
	if (inString) {
		result += stringChar
	}

	// Add missing closing brackets/braces
	while (stack.length > 0) {
		const open = stack.pop()
		if (open === "{") {
			result += "}"
		} else if (open === "[") {
			result += "]"
		}
	}

	return result
}

/**
 * Fix common string-related issues.
 */
function fixStringIssues(json: string): string {
	// Fix unescaped newlines in strings
	// This is tricky because we need to identify strings first
	const result: string[] = []
	let inString = false
	let stringChar = ""
	let i = 0

	while (i < json.length) {
		const char = json[i]
		const prevChar = i > 0 ? json[i - 1] : ""

		if (inString) {
			if (char === stringChar && prevChar !== "\\") {
				// End of string
				result.push(char)
				inString = false
			} else if (char === "\n" && prevChar !== "\\") {
				// Unescaped newline in string - escape it
				result.push("\\n")
			} else if (char === "\r" && prevChar !== "\\") {
				// Unescaped carriage return in string - escape it
				result.push("\\r")
			} else if (char === "\t" && prevChar !== "\\") {
				// Unescaped tab in string - escape it
				result.push("\\t")
			} else {
				result.push(char)
			}
		} else {
			if (char === '"') {
				inString = true
				stringChar = char
			}
			result.push(char)
		}
		i++
	}

	return result.join("")
}

/**
 * Repair JSON specifically for LLM tool call arguments.
 * This is a specialized version that applies additional heuristics
 * for the tool call context.
 *
 * @param input - The potentially malformed tool call arguments JSON
 * @returns RepairResult with repaired JSON and/or parsed object
 */
export function repairToolCallJson(input: string): RepairResult {
	// Handle empty input
	if (!input || input.trim() === "") {
		return { repaired: true, json: "{}", parsed: {} }
	}

	// First try standard repair
	const result = repairJson(input)
	if (result.parsed !== undefined) {
		return result
	}

	// Additional repair strategies for tool calls

	// Strategy 1: Try to extract JSON from markdown code blocks
	const codeBlockMatch = input.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
	if (codeBlockMatch) {
		const extracted = codeBlockMatch[1].trim()
		const extractedResult = repairJson(extracted)
		if (extractedResult.parsed !== undefined) {
			return { ...extractedResult, repaired: true }
		}
	}

	// Strategy 2: Try to find and extract JSON object/array
	const jsonMatch = input.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
	if (jsonMatch) {
		const extracted = jsonMatch[1]
		const extractedResult = repairJson(extracted)
		if (extractedResult.parsed !== undefined) {
			return { ...extractedResult, repaired: true }
		}
	}

	// Return the original repair result if nothing worked
	return result
}
