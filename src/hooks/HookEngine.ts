/**
 * Hook Engine — The Governance Middleware
 *
 * This is the central middleware layer that intercepts ALL tool executions.
 * It is a singleton: one instance exists per extension activation.
 *
 * Architecture:
 *   Pre-Hooks  → run BEFORE a tool executes → can BLOCK execution
 *   Post-Hooks → run AFTER a tool executes  → record trace, update state
 *
 * Per-task state (which intent is active) is tracked in a Map<taskId, IntentState>.
 * The Task object is NOT modified — state lives entirely in this engine.
 *
 * Insertion point in Roo Code:
 *   src/core/assistant-message/presentAssistantMessage.ts
 *   → before switch(block.name) [Pre-Hook]
 *   → after write_to_file completes [Post-Hook]
 */

import { HookContext, HookResult, IntentState } from "./types"
import { runIntentGate } from "./preHooks/intentGate"
import { runScopeGuard } from "./preHooks/scopeGuard"
import { appendTraceRecord } from "./postHooks/traceLedger"

export class HookEngine {
	private static _instance: HookEngine | null = null

	/**
	 * Per-task active intent state.
	 * Key: taskId  Value: IntentState (what was declared via select_active_intent)
	 */
	private intentStateMap = new Map<string, IntentState>()

	private constructor() {}

	/**
	 * Singleton accessor — always use this, never `new HookEngine()`.
	 */
	static getInstance(): HookEngine {
		if (!HookEngine._instance) {
			HookEngine._instance = new HookEngine()
		}
		return HookEngine._instance
	}

	// ─── Intent State Management ────────────────────────────────────────────────

	/**
	 * Set the active intent for a task (called when select_active_intent is executed).
	 */
	setActiveIntent(taskId: string, state: IntentState): void {
		this.intentStateMap.set(taskId, state)
	}

	/**
	 * Get the active intent ID for a task, or null if none is set.
	 */
	getActiveIntentId(taskId: string): string | null {
		return this.intentStateMap.get(taskId)?.intentId ?? null
	}

	/**
	 * Get the full intent state for a task.
	 */
	getIntentState(taskId: string): IntentState | null {
		return this.intentStateMap.get(taskId) ?? null
	}

	/**
	 * Clear the active intent for a task (called on task completion/reset).
	 */
	clearIntent(taskId: string): void {
		this.intentStateMap.delete(taskId)
	}

	// ─── Pre-Hook Chain ──────────────────────────────────────────────────────────

	/**
	 * Run all pre-hooks for a tool call.
	 * Returns the first blocking result found, or { blocked: false } if all pass.
	 *
	 * Pre-hooks run in order:
	 *   1. IntentGate   — Is there any intent declared?
	 *   2. ScopeGuard   — Is the target file in scope?
	 */
	async runPreHook(
		toolName: string,
		toolParams: Record<string, unknown>,
		taskId: string,
		cwd: string,
	): Promise<HookResult> {
		const ctx: HookContext = {
			taskId,
			cwd,
			toolName,
			toolParams,
			activeIntentId: this.getActiveIntentId(taskId),
		}

		// 1. Intent Gate: no intent = no mutating actions
		const gateResult = await runIntentGate(ctx)
		if (gateResult.blocked) {
			return gateResult
		}

		// 2. Scope Guard: file must be within declared scope
		const scopeResult = await runScopeGuard(ctx)
		if (scopeResult.blocked) {
			return scopeResult
		}

		return { blocked: false }
	}

	// ─── Post-Hook Chain ─────────────────────────────────────────────────────────

	/**
	 * Run all post-hooks after a tool completes.
	 * Currently: append a trace record for file-writing tools.
	 * Post-hooks NEVER block — they record and move on.
	 */
	async runPostHook(
		toolName: string,
		toolParams: Record<string, unknown>,
		taskId: string,
		cwd: string,
		modelId: string,
	): Promise<void> {
		// Only trace file-writing operations
		const fileWriteTools = new Set([
			"write_to_file",
			"apply_diff",
			"edit",
			"search_and_replace",
			"search_replace",
			"edit_file",
			"apply_patch",
		])

		if (!fileWriteTools.has(toolName)) {
			return
		}

		const filePath = (toolParams.path as string | undefined) ?? ""
		const content = (toolParams.content as string | undefined) ?? ""

		if (!filePath) {
			return
		}

		await appendTraceRecord({
			taskId,
			cwd,
			intentId: this.getActiveIntentId(taskId),
			filePath,
			content,
			modelId,
		})
	}
}

// Export the singleton for use across the codebase
export const hookEngine = HookEngine.getInstance()
