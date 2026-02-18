import { IntentManager } from "./IntentManager"
import { ScopeValidator } from "./ScopeValidator"
import type { ToolExecutionContext, PreHookResult, ActiveIntent } from "./types"

/**
 * Destructive tools that require an active intent before execution.
 */
const DESTRUCTIVE_TOOLS = new Set([
	"write_to_file",
	"execute_command",
	"edit_file",
	"search_replace",
	"apply_diff",
	"apply_patch",
])

/**
 * PreToolHook validates that an active intent is selected before destructive tool operations.
 * This enforces the intent-first architecture principle.
 * Also validates file paths against the active intent's scope (User Story 2).
 */
export class PreToolHook {
	private scopeValidator: ScopeValidator
	private intentManager: IntentManager

	constructor(intentManager: IntentManager) {
		this.intentManager = intentManager
		this.scopeValidator = new ScopeValidator()
	}

	/**
	 * Gets the IntentManager instance, preferring the global one if available.
	 * This ensures we're using the same instance across the application.
	 */
	private getIntentManager(): IntentManager {
		// Prefer global instance if available (from extension.ts)
		const globalIntentManager = (global as any).__intentManager as IntentManager | undefined
		return globalIntentManager || this.intentManager
	}

	/**
	 * Runs pre-execution validation.
	 * Blocks destructive tools if no active intent is selected.
	 * @param context The tool execution context
	 * @returns Validation result
	 */
	async run(context: ToolExecutionContext): Promise<PreHookResult> {
		// Non-destructive tools don't require intent
		if (!DESTRUCTIVE_TOOLS.has(context.toolName)) {
			return { allowed: true }
		}

		// Check if active intent exists for this task
		// Use the global IntentManager instance to ensure consistency
		const intentManager = this.getIntentManager()

		// First check if activeIntentId is provided in context (from task.activeIntentId)
		// Then fall back to looking it up in IntentManager by taskId
		let activeIntent: ActiveIntent | null = null
		if (context.activeIntentId) {
			activeIntent = await intentManager.getIntent(context.activeIntentId)
			if (activeIntent) {
				console.log(`[PreToolHook] Found active intent via context.activeIntentId: ${context.activeIntentId}`)
			}
		}

		// If not found via activeIntentId, try looking up by taskId
		if (!activeIntent) {
			activeIntent = await intentManager.getActiveIntent(context.taskId)
			if (activeIntent) {
				console.log(
					`[PreToolHook] Found active intent via taskId lookup: ${context.taskId} -> ${activeIntent.id}`,
				)
			} else {
				console.log(
					`[PreToolHook] No active intent found for taskId: ${context.taskId}, activeIntentId from context: ${context.activeIntentId || "undefined"}`,
				)
			}
		}

		if (!activeIntent) {
			return {
				allowed: false,
				error: `No active intent selected. Please use the select_active_intent tool to select an intent before performing ${context.toolName} operations.`,
			}
		}

		// Validate scope for file operations
		if (context.toolName === "write_to_file" || context.toolName === "edit_file") {
			const filePath = (context.toolParams.path as string) || (context.toolParams.file_path as string)
			if (filePath) {
				const isInScope = await this.scopeValidator.validatePath(filePath, activeIntent.ownedScope)
				if (!isInScope) {
					return {
						allowed: false,
						error: `Scope Violation: Intent ${activeIntent.id} (${activeIntent.name}) is not authorized to edit ${filePath}. Allowed scope: ${activeIntent.ownedScope.join(", ")}`,
					}
				}
			}
		}

		// Intent is active and scope is valid, allow execution
		return { allowed: true }
	}
}
