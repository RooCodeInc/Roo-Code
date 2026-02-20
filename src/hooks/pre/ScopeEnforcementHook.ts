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
			const intent = task.intentController.getIntent(intentId)

			if (intent && filePath) {
				const isScoped = intent.owned_scope.some((scope) => filePath.includes(scope))
				if (!isScoped) {
					return {
						allow: false,
						reason: `Security Violation: File '${filePath}' is outside the owned scope of intent '${intentId}'. You MUST either select a different intent that covers this file or ask the user to adjust the scope in '.orchestration/intent_map.yaml'.`,
					}
				}
			}
		}
	}
}
