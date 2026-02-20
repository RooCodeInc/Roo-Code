import { BaseTool, ToolCallbacks } from "./BaseTool"
import { Task } from "../task/Task"

export class SelectActiveIntentTool extends BaseTool<any> {
	readonly name = "select_active_intent" as const

	async execute(params: any, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const intentId = params.intent_id

		await callbacks.pushToolResult(
			JSON.stringify({
				intent_selected: intentId,
				status: "success",
				message: "Intent context synchronized.",
				intent_context: params.intent_context ?? null,
			}),
		)
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
