import { HookContext, HookDecision, PreToolHook } from "../types"

const MUTATING_TOOLS = new Set(["write_to_file", "execute_command"])

export class RequireIntentPreHook implements PreToolHook {
	name = "require-intent-pre-hook"

	run(context: HookContext): HookDecision {
		if (!MUTATING_TOOLS.has(context.toolName)) {
			return { allow: true }
		}

		// Placeholder behavior for Phase 1 wiring:
		// intentId should be set by select_active_intent before mutating calls.
		const intentId = context.toolArgs.intent_id
		if (!intentId || typeof intentId !== "string") {
			return {
				allow: false,
				code: "INTENT_REQUIRED",
				reason: "Mutating tool call blocked: select_active_intent(intent_id) is required first.",
			}
		}

		return {
			allow: true,
			contextPatch: { active_intent_id: intentId },
		}
	}
}
