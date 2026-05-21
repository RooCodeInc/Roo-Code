/**
 * Pre-Hook: Intent Gate
 *
 * The fundamental governance rule: an agent CANNOT mutate the codebase
 * without first declaring a valid active intent via select_active_intent().
 *
 * If the agent tries to write a file or run a command without having
 * declared an intent, this hook BLOCKS the action and returns an error
 * that the LLM can understand and self-correct from.
 */

import { HookContext, HookResult, MUTATING_TOOLS } from "../types"

/**
 * Run the intent gate check.
 * Returns { blocked: true } if a mutating tool is called without an active intent.
 */
export async function runIntentGate(ctx: HookContext): Promise<HookResult> {
	// Only enforce on mutating tools
	if (!MUTATING_TOOLS.has(ctx.toolName as any)) {
		return { blocked: false }
	}

	// If there is no active intent, block and explain clearly
	if (!ctx.activeIntentId) {
		return {
			blocked: true,
			reason:
				`[Intent Gate] BLOCKED: You attempted to call '${ctx.toolName}' without a declared intent.\n` +
				`You MUST first call 'select_active_intent' with a valid intent ID from ` +
				`.orchestration/active_intents.yaml before modifying any files.\n` +
				`Example: select_active_intent({ intent_id: "INT-001" })`,
		}
	}

	return { blocked: false }
}
