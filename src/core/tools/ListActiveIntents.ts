import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

export class ListActiveIntents extends BaseTool<"list_active_intents"> {
	readonly name = "list_active_intents" as const

	override execute(_params: any, _task: Task, _callbacks: ToolCallbacks): Promise<void> {
		throw new Error("Method not implemented.")
	}
}

export const listActiveIntentsTool = new ListActiveIntents()
