import type { PostHookContext } from "./types"

/**
 * Post-Hook: Executes after tool execution
 * Phase 1: No-op implementation (just logs)
 */
export class PostToolHook {
	async execute(context: PostHookContext): Promise<void> {
		console.log(`[PostToolHook] Tool: ${context.toolName} completed`)
	}
}
