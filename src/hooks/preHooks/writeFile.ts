/**
 * Pre-hook for write_file
 *
 * Enforces scope boundaries by:
 * 1. Checking if an intent is active
 * 2. Validating the target file is within the intent's owned_scope
 * 3. Blocking writes outside the scope with clear error messages
 *
 * This is the "Gatekeeper" that prevents scope violations.
 */

import { matchesAnyGlobPattern } from "../utils/pathMatcher"
import { findIntentById, getCachedIntent } from "../utils/yamlLoader"
import type { ActiveIntent } from "../models/orchestration"

export interface WriteFilePreHookArgs {
	path: string
	content: string
}

export interface WriteFilePreHookContext {
	intentId: string | null
	workspaceRoot: string
	ownedScope?: string[] // Optional cached scope
	[key: string]: unknown
}

export interface WriteFilePreHookResult {
	blocked: boolean
	error?: string
	modifiedArgs?: WriteFilePreHookArgs
}

/**
 * Pre-hook for write_file that enforces scope boundaries.
 *
 * This hook validates that the file being written is within the active intent's
 * owned_scope. If not, it blocks the operation with a clear error message.
 *
 * @param args - The write_file arguments (path, content)
 * @param context - Context including intentId and workspaceRoot
 * @returns Result indicating if operation should be blocked
 */
export async function writeFilePreHook(
	args: WriteFilePreHookArgs,
	context: WriteFilePreHookContext,
): Promise<WriteFilePreHookResult> {
	const { intentId, workspaceRoot, ownedScope } = context
	const { path: filePath } = args

	// Step 1: Check if intent is active
	if (!intentId) {
		return {
			blocked: true,
			error: "You must cite a valid active Intent ID using select_active_intent before modifying files.",
		}
	}

	// Step 2: Load the intent (use cached scope if provided)
	let intent: ActiveIntent | null = null

	if (ownedScope) {
		// Use cached scope but still need intent for name/error messages
		intent = getCachedIntent(intentId) ?? (await findIntentById(workspaceRoot, intentId))
	} else {
		intent = await findIntentById(workspaceRoot, intentId)
	}

	if (!intent) {
		return {
			blocked: true,
			error: `Intent ${intentId} not found in .orchestration/active_intents.yaml`,
		}
	}

	// Step 3: Check if owned_scope is defined
	const scope = ownedScope ?? intent.owned_scope
	if (!scope || scope.length === 0) {
		return {
			blocked: true,
			error: `Intent ${intentId} has no owned_scope defined. Cannot enforce scope boundaries.`,
		}
	}

	// Step 4: Validate file path against owned_scope
	const inScope = matchesAnyGlobPattern(filePath, scope, workspaceRoot)

	if (!inScope) {
		return {
			blocked: true,
			error: `Scope Violation: Intent '${intent.name}' (${intentId}) is not authorized to edit '${filePath}'. Request scope expansion or select a different intent.`,
		}
	}

	// Step 5: All checks passed
	return {
		blocked: false,
	}
}
