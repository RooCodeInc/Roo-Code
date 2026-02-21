import * as fs from "fs/promises"
import * as path from "path"

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

		const intentManager = this.getIntentManager()

		// Distinguish "no intents defined in YAML" vs "no intent selected"
		const intents = await intentManager.loadIntents()
		if (intents.length === 0) {
			return {
				allowed: false,
				error: "No intents are defined in active_intents.yaml. Please create an intent before performing modifications.",
			}
		}

		let activeIntent: ActiveIntent | null = null
		if (context.activeIntentId) {
			activeIntent = await intentManager.getIntent(context.activeIntentId)
			if (activeIntent) {
				console.log(`[PreToolHook] Found active intent via context.activeIntentId: ${context.activeIntentId}`)
			}
		}

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
		const filePath = (context.toolParams.path as string) || (context.toolParams.file_path as string)
		if ((context.toolName === "write_to_file" || context.toolName === "edit_file") && filePath) {
			const isInScope = await this.scopeValidator.validatePath(filePath, activeIntent.ownedScope)
			if (!isInScope) {
				return {
					allowed: false,
					error: `Scope Violation: Intent ${activeIntent.id} (${activeIntent.name}) is not authorized to edit ${filePath}. Allowed scope: ${activeIntent.ownedScope.join(", ")}`,
				}
			}

			// Optimistic locking: block write if file was modified since last read
			const store = (global as any).__fileStateLockStore as
				| {
						checkStale(filePath: string, currentContent: string): boolean
						getExpectedHash(filePath: string): string | undefined
				  }
				| undefined
			const workspaceRoot = context.workspacePath
			if (workspaceRoot) {
				const absolutePath = path.resolve(workspaceRoot, filePath)
				if (store && store.getExpectedHash(filePath) !== undefined) {
					try {
						const currentContent = await fs.readFile(absolutePath, "utf-8")
						if (store.checkStale(filePath, currentContent)) {
							return {
								allowed: false,
								error: "Stale file detected. Please re-read file before writing.",
							}
						}
					} catch (err) {
						// File does not exist (create flow) - no stale check
					}
				}
				// Record whether file existed before write (for trace classification in PostToolHook)
				try {
					await fs.access(absolutePath)
					;(global as any).__lastWriteMutationByPath = (global as any).__lastWriteMutationByPath || {}
					;(global as any).__lastWriteMutationByPath[`${context.taskId}:${filePath}`] = "MODIFY"
				} catch {
					;(global as any).__lastWriteMutationByPath = (global as any).__lastWriteMutationByPath || {}
					;(global as any).__lastWriteMutationByPath[`${context.taskId}:${filePath}`] = "CREATE"
				}
			}
		}

		return { allowed: true }
	}
}
