import { PreToolHook } from "./PreToolHook"
import { PostToolHook } from "./PostToolHook"
import type { PreHookContext, PreHookResult, PostHookContext } from "./types"

/**
 * HookEngine: Singleton orchestrator for Pre and Post hooks
 * Provides fail-safe execution - hooks never crash the agent
 */
export class HookEngine {
	private static instance: HookEngine
	private preHook: PreToolHook
	private postHook: PostToolHook

	private constructor() {
		this.preHook = new PreToolHook()
		this.postHook = new PostToolHook()
	}

	static getInstance(): HookEngine {
		if (!HookEngine.instance) {
			HookEngine.instance = new HookEngine()
		}
		return HookEngine.instance
	}

	/**
	 * Execute Pre-Hook before tool execution
	 * @param context - Tool execution context
	 * @returns Result indicating if execution should proceed
	 */
	async executePreHook(context: PreHookContext): Promise<PreHookResult> {
		try {
			return await this.preHook.execute(context)
		} catch (error) {
			console.error("[HookEngine] Pre-hook error:", error)
			return { blocked: false } // Fail-safe: allow execution
		}
	}

	/**
	 * Execute Post-Hook after tool execution
	 * @param context - Tool execution context with result
	 */
	async executePostHook(context: PostHookContext): Promise<void> {
		try {
			await this.postHook.execute(context)
		} catch (error) {
			console.error("[HookEngine] Post-hook error:", error)
			// Fail-safe: don't throw
		}
	}
}
