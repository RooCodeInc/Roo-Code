import { IToolHook, HookType, HookContext, HookResponse } from "../types"

/**
 * Validates that an active intent is selected before executing destructive tools.
 */
export class IntentValidationHook implements IToolHook {
	name = "IntentValidationHook"
	type = HookType.PRE

	private destructiveTools = [
		"write_to_file",
		"execute_command",
		"apply_diff",
		"edit",
		"search_and_replace",
		"search_replace",
		"edit_file",
		"apply_patch",
	]

	async execute(context: HookContext): Promise<HookResponse | void> {
		const { task, toolName, intentId, arguments: toolArgs } = context

		if (this.destructiveTools.includes(toolName)) {
			let shouldBlock = !intentId

			// If it's a command, check if it's actually destructive
			if (toolName === "execute_command") {
				const command = toolArgs.command || ""
				shouldBlock = shouldBlock && task.intentController.isDestructiveCommand(command)
			}

			if (shouldBlock) {
				// Only block if the project actually has intents defined (governance is active)
				const hasIntents = task.intentController.getAllActiveIntents().length > 0
				if (hasIntents) {
					return {
						allow: false,
						reason: `Access Denied: This project is under architectural governance. You MUST select an active intent from the catalog using 'select_active_intent' BEFORE you can use destructive tools like '${toolName}'. Your very next action MUST be to call 'select_active_intent'.`,
					}
				}
			}
		}
	}
}
