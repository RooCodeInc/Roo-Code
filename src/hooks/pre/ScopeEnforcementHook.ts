import { IToolHook, HookType, HookContext, HookResponse } from "../types"

/**
 * Enforces that file modifications stay within the intent's owned scope.
 */
export class ScopeEnforcementHook implements IToolHook {
	name = "ScopeEnforcementHook"
	type = HookType.PRE

	async execute(context: HookContext): Promise<HookResponse | void> {
		const { task, toolName, intentId, arguments: toolArgs } = context

		if (!intentId) return

		if (toolName === "write_to_file" || toolName === "apply_diff") {
			const filePath = (toolArgs.path || "") as string
			if (filePath) {
				const isScoped = task.intentController.validateScope(filePath, intentId)
				if (!isScoped) {
					return {
						allow: false,
						reason: `Security Violation: File '${filePath}' is outside the owned scope of intent '${intentId}'. You MUST either select a different intent that covers this file or ask the user to adjust the scope in '.orchestration/active_intents.yaml'.`,
					}
				}
			}
		}
	}
}
