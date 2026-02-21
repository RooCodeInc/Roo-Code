/**
 * Intent validation hook for enforcing Intent-Driven Architect protocol.
 *
 * This hook runs before destructive tools (write_to_file, execute_command, etc.)
 * and blocks execution if no active intent is declared.
 */

import type { ToolName } from "@roo-code/types"
import type { PreToolUseHook, HookResult } from "./types"
import { registerPreToolUseHook } from "./middleware"
import { getSessionIntent } from "./session-state"
import { findIntentById, validateIntentScope } from "./intent-loader"

/**
 * List of tools that require an active intent before execution.
 * These are considered "destructive" or "mutating" operations.
 */
const INTENT_REQUIRED_TOOLS: ToolName[] = [
	"write_to_file",
	"execute_command",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"apply_diff",
]

/**
 * Validates that an active intent is selected before executing destructive tools.
 *
 * @param context - PreToolUse context
 * @returns Hook result with continue=false if intent is missing
 */
export const validateIntentForTool: PreToolUseHook = async (context) => {
	const toolName = context.toolUse.name

	// Skip validation for non-destructive tools
	if (!INTENT_REQUIRED_TOOLS.includes(toolName)) {
		return { continue: true }
	}

	// Check if task has an active intent
	const activeIntentId = context.task.getActiveIntentId()

	if (!activeIntentId) {
		// CRITICAL: Block execution - no intent declared
		// This is the gatekeeper that enforces Intent Protocol
		return {
			continue: false,
			reason: `🚫 Intent-Driven Architect Protocol Violation: You MUST call select_active_intent() BEFORE using ${toolName}.\n\nWorkflow:\n1. Call select_active_intent({ intent_id: "INT-XXX" })\n2. Wait for confirmation\n3. Then proceed with ${toolName}\n\nThis ensures all code changes are traceable to high-level intents.`,
			contextToInject: `\n\n<intent_protocol_error>\nYou attempted to use ${toolName} without declaring an active intent. This violates the Intent-Driven Architect protocol.\n\nRequired workflow:\n1. Review available intents in .orchestration/active_intents.yaml\n2. Select the appropriate intent using: select_active_intent({ intent_id: "INT-XXX" })\n3. Wait for system confirmation\n4. Only then proceed with code modifications\n\nAll destructive operations must be linked to a declared intent for traceability.\n</intent_protocol_error>`,
		}
	}

	// Validate intent exists in active_intents.yaml
	try {
		const sessionIntent = await getSessionIntent(context.task.taskId)
		if (!sessionIntent || sessionIntent !== activeIntentId) {
			return {
				continue: false,
				reason: `🚫 Intent validation failed: Active intent "${activeIntentId}" not found in session state. Please select a valid intent from .orchestration/active_intents.yaml.`,
			}
		}

		// Additional enforcement: if this is a write operation, validate file path against intent owned_scope
		if (toolName === "write_to_file") {
			const filePath = String((context.params && (context.params.path || context.params.file)) || "")
			if (!filePath) {
				return { continue: false, reason: "write_to_file called without a path parameter" }
			}

			const intent = await findIntentById(activeIntentId, context.task.cwd)
			if (!intent) {
				return { continue: false, reason: `Active intent not found: ${activeIntentId}` }
			}

			const allowed = validateIntentScope(filePath, intent)
			if (!allowed) {
				return {
					continue: false,
					reason: `🚫 Scope Violation: The target file ${filePath} is outside the owned_scope of intent ${activeIntentId}`,
				}
			}
		}
	} catch (error) {
		// Fail-safe: Log error but allow execution
		console.error("[IntentValidationHook] Error checking session intent:", error)
	}

	// Intent is valid - allow execution
	return { continue: true }
}

/**
 * Registers the intent validation hook globally.
 * Call this once during extension activation.
 *
 * @returns Cleanup function to unregister the hook
 */
export function registerIntentValidationHook(): () => void {
	return registerPreToolUseHook(validateIntentForTool)
}
