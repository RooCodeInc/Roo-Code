/**
 * Phase 2 — Hook Engine
 *
 * Central orchestrator that wraps all tool execution requests and
 * enforces formal boundaries. Hooks are composable: the engine runs
 * an ordered list of pre-hooks before tool execution and optional
 * post-hooks after.
 *
 * Pre-hook pipeline for destructive tools in governed mode:
 *   1. Scope Enforcement  → check file path against intent owned_scope
 *   2. Authorization      → show Approve/Reject dialog to user
 *
 * If any pre-hook returns `proceed: false`, the pipeline short-circuits
 * and the tool is NOT executed. The standardised JSON error from the
 * blocking hook is returned to the LLM for autonomous recovery.
 */

import type { HookContext, HookResult, PreHookFn, PostHookFn } from "./types"
import { classifyTool } from "./commandClassifier"
import { scopeEnforcerHook } from "./scopeEnforcer"
import { authorizationHook } from "./authorizationHook"
import { isGovernedWorkspace } from "../core/context/activeIntents"

// ---------------------------------------------------------------------------
// HookEngine
// ---------------------------------------------------------------------------

export class HookEngine {
	private preHooks: PreHookFn[] = []
	private postHooks: PostHookFn[] = []

	constructor() {
		// Register default pre-hooks in order of execution.
		// Scope enforcement runs BEFORE authorization so that an out-of-scope
		// write is rejected immediately without wasting the user's attention
		// on the approval dialog.
		this.preHooks = [scopeEnforcerHook, authorizationHook]

		// Post-hooks are optional — none registered by default.
		this.postHooks = []
	}

	// -----------------------------------------------------------------------
	// Pre-hook pipeline
	// -----------------------------------------------------------------------

	/**
	 * Run the pre-hook pipeline for a tool invocation.
	 *
	 * @param ctx - Hook context (tool name, params, intent info, cwd)
	 * @returns HookResult — `proceed: true` if all hooks pass,
	 *          `proceed: false` with error payload if any hook blocks.
	 */
	async runPre(ctx: HookContext): Promise<HookResult> {
		// Step 0: Classify the tool
		ctx.classification = classifyTool(ctx.toolName)

		// SAFE tools bypass all enforcement
		if (ctx.classification === "safe") {
			return { proceed: true }
		}

		// Non-governed workspace → skip enforcement
		if (!isGovernedWorkspace(ctx.cwd)) {
			return { proceed: true }
		}

		// Run each pre-hook in order; short-circuit on first block
		for (const hook of this.preHooks) {
			const result = await hook(ctx)
			if (!result.proceed) {
				return result
			}
		}

		return { proceed: true }
	}

	// -----------------------------------------------------------------------
	// Post-hook pipeline (optional, fire-and-forget)
	// -----------------------------------------------------------------------

	/**
	 * Run post-hooks after tool execution completes.
	 * Post-hooks are fire-and-forget — errors are logged but not propagated.
	 *
	 * @param ctx     - Original hook context
	 * @param outcome - Execution result (success / error)
	 */
	async runPost(ctx: HookContext, outcome: { success: boolean; error?: string }): Promise<void> {
		for (const hook of this.postHooks) {
			try {
				await hook(ctx, outcome)
			} catch (err) {
				console.warn(`[HookEngine] Post-hook error (non-fatal):`, err)
			}
		}
	}

	// -----------------------------------------------------------------------
	// Hook management
	// -----------------------------------------------------------------------

	/**
	 * Register an additional pre-hook (appended to the end of the pipeline).
	 */
	addPreHook(hook: PreHookFn): void {
		this.preHooks.push(hook)
	}

	/**
	 * Register an additional post-hook.
	 */
	addPostHook(hook: PostHookFn): void {
		this.postHooks.push(hook)
	}

	/**
	 * Clear all hooks (useful for testing).
	 */
	clearHooks(): void {
		this.preHooks = []
		this.postHooks = []
	}
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

/**
 * Default shared HookEngine instance.
 * Used by BaseTool.handle() for tool execution wrapping.
 */
export const hookEngine = new HookEngine()

// ---------------------------------------------------------------------------
// Convenience function for integration
// ---------------------------------------------------------------------------

/**
 * Build a HookContext from tool execution parameters.
 *
 * This is the glue between BaseTool.handle() and the hook engine.
 * It reads intent state from the Task instance and constructs the
 * context object that all hooks operate on.
 *
 * @param toolName - Name of the tool being executed
 * @param params   - Tool parameters (nativeArgs)
 * @param task     - Task instance (provides cwd, activeIntentId, scope)
 */
export function buildHookContext(
	toolName: string,
	params: Record<string, unknown>,
	task: {
		cwd: string
		activeIntentId?: string
		activeIntentContext?: string
		// Phase 1 stores scope on the intent YAML; we'll load it if available
	},
): HookContext {
	// TODO: Extract activeIntentScope from the loaded intent.
	// For now, we load it dynamically from the YAML in the scope enforcer hook
	// when needed. The scope is passed through the context if available.
	return {
		toolName,
		params,
		cwd: task.cwd,
		activeIntentId: task.activeIntentId,
		// activeIntentScope is loaded on-demand by scopeEnforcerHook
		// via loadActiveIntents() → findIntentById() → intent.scope
	}
}
