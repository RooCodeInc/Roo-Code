import { ToolName } from "@roo-code/types"
import { Task } from "../task/Task"
import { ToolMiddleware, MiddlewareResult } from "./ToolMiddleware"

export class IntentValidationMiddleware implements ToolMiddleware {
	name = "intentValidation"

	async beforeExecute(_params: any, task: Task, toolName: ToolName): Promise<MiddlewareResult> {
		if (toolName === "select_active_intent" || toolName === "list_active_intents") {
			return { allow: true }
		}

		const selectedIntentId = task.getSelectedIntentId()
		if (!selectedIntentId) {
			return {
				allow: false,
				error: "No active intent selected. Use select_active_intent first.",
			}
		}

		return { allow: true }
	}
}
