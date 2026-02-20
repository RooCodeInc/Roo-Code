import { BaseTool, ToolCallbacks } from "./BaseTool" // Both live here!
import { Task } from "../task/Task"

export class SelectActiveIntentTool extends BaseTool<any> {
	readonly name = "select_active_intent" as const

	async execute(params: any, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const intentId = params.intent_id

		// We use pushToolResult as defined in your BaseTool interface
		await callbacks.pushToolResult(
			JSON.stringify({
				intent_selected: intentId,
				status: "success",
				message: "Intent context synchronized.",
			}),
		)
	}
}
