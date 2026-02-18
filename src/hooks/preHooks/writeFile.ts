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

export interface WriteFilePreHookArgs {
	path: string
	content: string
}

export interface WriteFilePreHookResult {
	blocked: boolean
	error?: string
}

export interface WriteFilePreHookContext {
	intentId: string | null
	workspaceRoot?: string
	ownedScope?: string[]
	[key: string]: unknown
}

export async function writeFilePreHook(
	args: WriteFilePreHookArgs,
	context: WriteFilePreHookContext,
): Promise<WriteFilePreHookResult> {
	// To be implemented in Phase 2:
	// 1. If !context.intentId → return { blocked: true, error: "You must cite a valid active Intent ID." }
	// 2. Load intent's owned_scope from .orchestration/active_intents.yaml (or from context.ownedScope)
	// 3. Resolve args.path relative to workspaceRoot; check against owned_scope globs
	// 4. If out of scope → return { blocked: true, error: "Scope Violation: [intent] is not authorized to edit [path]. Request scope expansion." }
	// 5. return { blocked: false }
	return { blocked: false }
}
