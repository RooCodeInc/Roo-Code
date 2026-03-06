/**
 * Minimal tool error formatters for pre-hook.
 * Avoids importing from core/prompts/responses to prevent vscode dependency in Node scripts.
 */
export const toolErrorFormat = {
	toolError: (error?: string) =>
		JSON.stringify({
			status: "error",
			message: "The tool execution failed",
			error,
		}),

	toolErrorScopeViolation: (intentId: string, filename: string) =>
		JSON.stringify({
			status: "error",
			type: "scope_violation",
			message: `Scope Violation: ${intentId} is not authorized to edit [${filename}]. Request scope expansion.`,
			intent_id: intentId,
			path: filename,
			suggestion: "Request scope expansion in .orchestration/active_intents.yaml or choose another intent.",
		}),

	toolErrorUserRejected: (toolName?: string) =>
		JSON.stringify({
			status: "error",
			type: "user_rejected",
			message: "The user rejected this operation.",
			tool: toolName,
			suggestion: "Do not retry the same operation; try a different approach or ask the user for permission.",
		}),
}
