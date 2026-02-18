import type { PreHookContext, PreHookResult } from "./types"

/**
 * Pre-Hook: Executes before tool execution
 * Phase 1: No-op implementation (just logs)
 */
export class PreToolHook {
	async execute(context: PreHookContext): Promise<PreHookResult> {
		console.log(`[PreToolHook] Tool: ${context.toolName}`)
		return { blocked: false }
	}
}
