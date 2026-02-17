import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id } = params
		const { handleError, pushToolResult } = callbacks

		try {
			if (!intent_id) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent", "Missing required parameter: intent_id")
				pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "intent_id"))
				return
			}

			task.consecutiveMistakeCount = 0

			const intentContext = [
				"<intent_context>",
				`\t<intent_id>${intent_id}</intent_id>`,
				"\t<status>loaded</status>",
				"</intent_context>",
			].join("\n")

			pushToolResult(intentContext)
		} catch (error) {
			await handleError("loading intent context", error as Error)
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
