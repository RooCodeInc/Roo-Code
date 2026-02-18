import type { ToolUse } from "../../shared/tools"

import { formatResponse } from "../prompts/responses"
import { Task } from "../task/Task"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult } = callbacks
		const intentId = params.intent_id

		if (!intentId) {
			task.consecutiveMistakeCount++
			task.recordToolError("select_active_intent")
			pushToolResult(formatResponse.missingToolParameterError("intent_id"))
			return
		}

		// Execution handling is implemented via the intent orchestration hook engine.
		// This tool exists to provide a concrete runtime handler and a tool_result payload.
		pushToolResult(
			JSON.stringify({
				status: "ok",
				message: `Active intent selected: ${intentId}`,
				intent_id: intentId,
			}),
		)
		return
	}

	override async handlePartial(task: Task, block: ToolUse<"select_active_intent">): Promise<void> {
		// No streaming UI needed.
		void task
		void block
		return
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
