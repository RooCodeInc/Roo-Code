import { Task } from "../core/task/Task"
import { formatResponse } from "../core/prompts/responses"
import { sanitizeToolUseId } from "../utils/tool-id"

// Helper function for glob matching
export function isPathAllowed(path: string, scope: string[]): boolean {
	if (!scope || scope.length === 0) return true
	return scope.some((pattern) => {
		let regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		regexStr = regexStr.replace(/\*\*/g, ".*")
		regexStr = regexStr.replace(/(?<!\.)\*(?!\.)/g, "[^/]*")
		const regex = new RegExp(`^${regexStr}$`)
		return regex.test(path)
	})
}

/**
 * PHASE 2 HOOK ENGINE
 * Validates tool execution against the active governance intent.
 */
export function validateGovernanceHook(
	cline: Task,
	block: any,
	toolCallId: string | undefined,
): { allowed: boolean; error?: string } {
	// 1. Check for Active Intent (Phase 1)
	if (!cline.activeIntentId && block.name !== "select_active_intent") {
		return {
			allowed: false,
			error: "GOVERNANCE VIOLATION: You must call 'select_active_intent(intent_id)' to declare your intent before executing any other tools.",
		}
	}

	// 2. Check for Scope Enforcement (Phase 2)
	if (cline.activeIntentScope && cline.activeIntentScope.length > 0) {
		const targetPath = block.params.path || block.params.file_path
		if (targetPath && !isPathAllowed(targetPath, cline.activeIntentScope)) {
			return {
				allowed: false,
				error: `SCOPE VIOLATION: Intent '${cline.activeIntentId}' is not authorized to edit '${targetPath}'. The active intent is restricted to: [${cline.activeIntentScope.join(", ")}]. Request scope expansion in active_intents.yaml.`,
			}
		}
	}

	return { allowed: true }
}
