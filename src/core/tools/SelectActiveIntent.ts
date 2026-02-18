import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntent extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	override execute(_params: SelectActiveIntentParams, _task: Task, _callbacks: ToolCallbacks): Promise<void> {
		throw new Error("Method not implemented.")
	}
}

export const selectActiveIntentTool = new SelectActiveIntent()
