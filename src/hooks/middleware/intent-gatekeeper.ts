import { IHook, ToolCall, HookResult, ToolHookContext } from "../types"
import { loadActiveIntents, isWithinScope } from "../utils/yaml-store"

export class IntentGatekeeper implements IHook {
	name = "IntentGatekeeper"

	async execute(toolCall: ToolCall, context?: ToolHookContext): Promise<HookResult> {
		if (!context) {
			return { blocked: false }
		}

		if (toolCall.name === "select_active_intent") {
			return { blocked: false }
		}

		const mutableTools = [
			"write_file",
			"delete_file",
			"execute_command",
			"apply_diff",
			"edit",
			"edit_file",
			"search_replace",
			"apply_patch",
		]
		if (mutableTools.includes(toolCall.name)) {
			if (!context.activeIntentId) {
				return {
					blocked: true,
					reason: "GOVERNANCE_VIOLATION: No active intent checked out. Call select_active_intent() first.",
					recoveryHint:
						"This prevents Cognitive Debt by enforcing intent alignment. Select a valid intent from .orchestration/active_intents.yaml",
				}
			}

			const intents = await loadActiveIntents(context.workspacePath)
			const intent = intents.find((i) => i.id === context.activeIntentId)

			if (!intent) {
				return {
					blocked: true,
					reason: `INVALID_INTENT: Intent ${context.activeIntentId} not found in active_intents.yaml`,
					recoveryHint: "Select a valid intent ID from the specification file",
				}
			}

			const targetFile = (toolCall.parameters.file_path ||
				toolCall.parameters.path ||
				toolCall.parameters.file) as string | undefined
			if (targetFile && !isWithinScope(targetFile, intent.owned_scope)) {
				return {
					blocked: true,
					reason: `SCOPE_VIOLATION: Intent ${intent.id} is not authorized to edit ${targetFile}. Request scope expansion.`,
					recoveryHint:
						"Either select a different intent with appropriate scope, or request scope expansion in active_intents.yaml",
				}
			}
		}

		return { blocked: false }
	}
}
