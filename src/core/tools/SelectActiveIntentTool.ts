import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { selectActiveIntentForTask } from "../orchestration/ToolHookEngine"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id } = params
		const { pushToolResult } = callbacks

		if (!intent_id) {
			task.consecutiveMistakeCount++
			task.recordToolError("select_active_intent")
			pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "intent_id"))
			return
		}

		const result = await selectActiveIntentForTask(task, intent_id)
		if (!result.ok) {
			task.consecutiveMistakeCount++
			task.recordToolError("select_active_intent")
			pushToolResult(result.errorResult)
			return
		}

		task.consecutiveMistakeCount = 0
		pushToolResult(result.context)
	}

	override async handlePartial(task: Task, block: ToolUse<"select_active_intent">): Promise<void> {
		const intentId = block.params.intent_id ?? ""
		const partialMessage = JSON.stringify({
			tool: "selectActiveIntent",
			intent_id: intentId,
		})

		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()

