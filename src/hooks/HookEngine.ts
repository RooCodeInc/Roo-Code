/**
 * HookEngine.ts
 * ─────────────────────────────────────────────────────────────
 * Core middleware runner for the Intent-Driven Hook System.
 *
 * Every tool call in the extension passes through:
 *   Pre-Hooks  → (may block or enrich context)
 *   Tool runs  → (original tool executes)
 *   Post-Hooks → (audit, trace, documentation side-effects)
 *
 * Design: composable, fail-safe, privilege-separated.
 * ─────────────────────────────────────────────────────────────
 */

// ── Types ──────────────────────────────────────────────────────

export interface ToolContext {
	/** Name of the tool being called e.g. "write_file" */
	toolName: string

	/** Parameters passed by the LLM to the tool */
	params: Record<string, unknown>

	/** Absolute path to the VS Code workspace root */
	workspacePath: string

	/** The intent ID declared by the agent this turn (set by ContextInjector) */
	intentId?: string

	/** The mutation class determined by the hook (not agent self-reported) */
	mutationClass?: "AST_REFACTOR" | "INTENT_EVOLUTION" | "UNKNOWN"

	/** Snapshot of the file content BEFORE the write (set by OptimisticLockGuard) */
	__oldContent__?: string

	/** The injected intent context XML block (set by ContextInjector) */
	__injectedContext__?: string

	/** Current git SHA (populated lazily) */
	__gitSha__?: string
}

/**
 * Returning a BlockSignal from any Pre-Hook short-circuits the entire chain.
 * The reason string is returned to the LLM as a tool error.
 */
export class BlockSignal {
	constructor(
		public readonly reason: string,
		public readonly code: BlockCode = "GENERIC_BLOCK",
	) {}
}

export type BlockCode = "NO_INTENT_DECLARED" | "SCOPE_VIOLATION" | "STALE_FILE" | "UNKNOWN_INTENT" | "GENERIC_BLOCK"

export type HookFn = (ctx: ToolContext) => Promise<ToolContext | BlockSignal>

// ── HookEngine ─────────────────────────────────────────────────

export class HookEngine {
	private preHooks: Array<{ name: string; fn: HookFn }> = []
	private postHooks: Array<{ name: string; fn: HookFn }> = []

	registerPre(name: string, fn: HookFn): void {
		this.preHooks.push({ name, fn })
	}

	registerPost(name: string, fn: HookFn): void {
		this.postHooks.push({ name, fn })
	}

	/**
	 * Run all pre-hooks in registration order.
	 * Returns enriched ToolContext on success, BlockSignal on any block.
	 */
	async runPreHooks(ctx: ToolContext): Promise<ToolContext | BlockSignal> {
		for (const { name, fn } of this.preHooks) {
			try {
				const result = await fn(ctx)
				if (result instanceof BlockSignal) {
					console.log(`[HookEngine] PRE-HOOK "${name}" BLOCKED: ${result.reason}`)
					return result
				}
				ctx = result
			} catch (err) {
				console.error(`[HookEngine] PRE-HOOK "${name}" threw:`, err)
				// Fail-safe: block on unexpected hook errors
				return new BlockSignal(`Hook "${name}" encountered an internal error.`)
			}
		}
		return ctx
	}

	/**
	 * Run all post-hooks in registration order.
	 * Post-hooks never block — errors are logged and swallowed.
	 */
	async runPostHooks(ctx: ToolContext): Promise<void> {
		for (const { name, fn } of this.postHooks) {
			try {
				await fn(ctx)
			} catch (err) {
				console.error(`[HookEngine] POST-HOOK "${name}" threw:`, err)
				// Never crash on post-hook failure — side-effects are best-effort
			}
		}
	}
}

// Singleton instance used across the extension
export const hookEngine = new HookEngine()
