/**
 * Pre-Hook: Scope Guard
 *
 * Enforces the owned_scope declared in active_intents.yaml.
 * Even if an intent is declared, the agent can only modify files
 * that are explicitly within that intent's scope.
 *
 * This prevents agents from "drifting" into unrelated code while
 * claiming to work on a specific intent.
 */

import { HookContext, HookResult } from "../types"
import { findIntentById, isPathInScope } from "../utils/intentLoader"

// Tools that write to a specific file path (we check their 'path' param)
const FILE_WRITE_TOOLS = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
])

/**
 * Run the scope guard check.
 * Returns { blocked: true } if the target file is outside the active intent's scope.
 */
export async function runScopeGuard(ctx: HookContext): Promise<HookResult> {
	// Only enforce on file-writing tools
	if (!FILE_WRITE_TOOLS.has(ctx.toolName)) {
		return { blocked: false }
	}

	// No active intent means intentGate already blocked this — skip
	if (!ctx.activeIntentId) {
		return { blocked: false }
	}

	// Extract the target file path from tool params
	const targetPath = (ctx.toolParams.path as string | undefined) ?? ""
	if (!targetPath) {
		return { blocked: false }
	}

	// Load the active intent to get its scope
	const intent = await findIntentById(ctx.cwd, ctx.activeIntentId)
	if (!intent) {
		return {
			blocked: true,
			reason:
				`[Scope Guard] BLOCKED: Active intent '${ctx.activeIntentId}' not found in ` +
				`.orchestration/active_intents.yaml. The intent may have been removed or renamed. ` +
				`Call select_active_intent again with a valid ID.`,
		}
	}

	// If scope is undefined or empty, allow (no restriction defined)
	if (!intent.owned_scope || intent.owned_scope.length === 0) {
		return { blocked: false }
	}

	// Check if the target file is within the declared scope
	if (!isPathInScope(targetPath, intent.owned_scope)) {
		return {
			blocked: true,
			reason:
				`[Scope Guard] BLOCKED: Scope Violation.\n` +
				`Intent '${ctx.activeIntentId}' (${intent.name}) is NOT authorized to edit: ${targetPath}\n` +
				`Authorized scope:\n` +
				intent.owned_scope.map((s) => `  - ${s}`).join("\n") +
				`\nTo modify this file, either:\n` +
				`  1. Switch to a different intent that owns this file, or\n` +
				`  2. Request a scope expansion for intent ${ctx.activeIntentId}.`,
		}
	}

	return { blocked: false }
}
