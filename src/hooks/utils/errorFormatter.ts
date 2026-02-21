/**
 * Structured error format for LLM recovery.
 * Used by hooks and presentAssistantMessage to return parseable tool errors.
 */

/**
 * Structured error format for LLM recovery
 */
export interface ToolError {
	error: string
	reason: string
	suggestion?: string
	recoverable: boolean
}

/**
 * Format a tool error for LLM consumption
 * @param error - Short error type/code
 * @param reason - Detailed explanation
 * @param suggestion - Optional suggestion for recovery
 * @param recoverable - Whether the LLM can recover from this error
 * @returns JSON string that LLM can parse
 */
export function formatToolError(
	error: string,
	reason: string,
	suggestion?: string,
	recoverable: boolean = true,
): string {
	const errorObject: ToolError = {
		error,
		reason,
		recoverable,
	}

	if (suggestion) {
		errorObject.suggestion = suggestion
	}

	return JSON.stringify(errorObject, null, 2)
}

/**
 * Pre-defined error formatters for common scenarios
 */
export const ErrorFormatters = {
	missingIntent: () =>
		formatToolError(
			"MISSING_INTENT",
			"No active intent selected",
			"Call select_active_intent with a valid intent ID before any file-modifying operations",
		),

	intentNotFound: (intentId: string) =>
		formatToolError(
			"INTENT_NOT_FOUND",
			`Intent ${intentId} does not exist in .orchestration/active_intents.yaml`,
			"Check the intent ID or create it in active_intents.yaml",
		),

	scopeViolation: (intentName: string, intentId: string, filePath: string) =>
		formatToolError(
			"SCOPE_VIOLATION",
			`Intent '${intentName}' (${intentId}) cannot modify ${filePath}`,
			"Select a different intent or request scope expansion in active_intents.yaml",
		),

	userRejected: (action: string) =>
		formatToolError(
			"USER_REJECTED",
			`User rejected the action: ${action}`,
			"Review the action and try again with user approval",
		),

	noScope: (intentId: string) =>
		formatToolError(
			"NO_SCOPE_DEFINED",
			`Intent ${intentId} has no owned_scope defined`,
			"Add owned_scope patterns to the intent in active_intents.yaml",
		),
}
