/**
 * Intent Validator
 *
 * Validates intent IDs and scope before allowing tool execution.
 * Part of the Pre-Hook security boundary.
 */

import { loadActiveIntents, getIntentById, isFileInScope, type ActiveIntent, type ActiveIntentsData } from "./types"

/**
 * Validate an intent ID exists and is active
 */
export async function validateIntentId(
	workspacePath: string,
	intentId: string,
): Promise<{ valid: boolean; intent?: ActiveIntent; error?: string }> {
	const intentsData = await loadActiveIntents(workspacePath)

	if (!intentsData) {
		return {
			valid: false,
			error: "No active_intents.yaml found. Please initialize the orchestration directory.",
		}
	}

	const intent = getIntentById(intentsData, intentId)

	if (!intent) {
		const availableIds = intentsData.active_intents.map((i) => i.id).join(", ")
		return {
			valid: false,
			error: `Intent ID '${intentId}' not found. Available intents: ${availableIds || "none"}`,
		}
	}

	if (intent.status === "COMPLETED") {
		return {
			valid: false,
			error: `Intent '${intentId}' has already been completed. Please select a different intent.`,
		}
	}

	if (intent.status === "BLOCKED") {
		return {
			valid: false,
			error: `Intent '${intentId}' is blocked. Please resolve the blocking issue or select a different intent.`,
		}
	}

	return { valid: true, intent }
}

/**
 * Validate that a file is within the intent's owned scope
 */
export function validateFileScope(filePath: string, intent: ActiveIntent): { valid: boolean; error?: string } {
	const isInScope = isFileInScope(filePath, intent.owned_scope)

	if (!isInScope) {
		return {
			valid: false,
			error: `Scope Violation: Intent ${intent.id} is not authorized to edit '${filePath}'. Authorized scope: ${intent.owned_scope.join(", ")}. Request scope expansion in the intent specification.`,
		}
	}

	return { valid: true }
}

/**
 * Get all available intents for display
 */
export async function getAvailableIntents(workspacePath: string): Promise<ActiveIntent[]> {
	const intentsData = await loadActiveIntents(workspacePath)
	if (!intentsData) return []

	return intentsData.active_intents.filter((intent) => intent.status === "PENDING" || intent.status === "IN_PROGRESS")
}

/**
 * Format intent for display to the AI agent
 */
export function formatIntentForDisplay(intent: ActiveIntent): string {
	const scope =
		intent.owned_scope.length > 0
			? `\n  Owned Scope:\n${intent.owned_scope.map((s) => `    - ${s}`).join("\n")}`
			: ""

	const constraints =
		intent.constraints.length > 0
			? `\n  Constraints:\n${intent.constraints.map((c) => `    - ${c}`).join("\n")}`
			: ""

	const acceptance =
		intent.acceptance_criteria.length > 0
			? `\n  Acceptance Criteria:\n${intent.acceptance_criteria.map((a) => `    - ${a}`).join("\n")}`
			: ""

	return `
## Intent: ${intent.name} (${intent.id})
  Status: ${intent.status}
${scope}${constraints}${acceptance}
`.trim()
}
