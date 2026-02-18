import type { ToolParamName } from "../shared/tools"
import { IntentValidator } from "./IntentValidator"

export interface PreToolUseContext {
	taskId: string
	cwd: string
	toolName: string
	params: Partial<Record<ToolParamName, string>>
}

export interface PreToolUseDecision {
	allowed: boolean
	reason: string
	intentId?: string
}

const SIDE_EFFECT_TOOLS = new Set<string>([
	"write_to_file",
	"execute_command",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"new_task",
])

export class PreToolUse {
	constructor(private readonly validator = new IntentValidator()) {}

	async evaluate(context: PreToolUseContext): Promise<PreToolUseDecision> {
		const selectedIntentId = context.params.intent_id?.trim()

		// Scope gating focuses on side-effect tools only.
		if (!SIDE_EFFECT_TOOLS.has(context.toolName)) {
			return { allowed: true, reason: "read-only or non-side-effect tool" }
		}

		if (!selectedIntentId) {
			return { allowed: false, reason: "No selected intent. Call select_active_intent first." }
		}

		const validation = await this.validator.validate(context.cwd, context.toolName, context.params)
		if (!validation.allowed) {
			return { allowed: false, reason: validation.reason, intentId: validation.intentId }
		}

		return { allowed: true, reason: "intent + scope validated", intentId: validation.intentId }
	}
}
