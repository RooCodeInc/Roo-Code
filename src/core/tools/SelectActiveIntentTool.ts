import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { OrchestrationStore } from "../orchestration/OrchestrationStore"
import { IntentContextService } from "../orchestration/IntentContextService"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { handleError, pushToolResult } = callbacks
		const intentId = params.intent_id?.trim()

		try {
			if (!intentId) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "intent_id"))
				return
			}

			const store = new OrchestrationStore(task.cwd)
			const intentContextService = new IntentContextService(store)
			const result = await intentContextService.selectIntent(intentId)

			if (!result.found || !result.context) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError(result.message))
				return
			}

			task.setActiveIntentId(result.context.intent_id)
			task.consecutiveMistakeCount = 0
			pushToolResult(result.message)
		} catch (error) {
			await handleError("selecting active intent", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"select_active_intent">): Promise<void> {
		const intentId = block.params.intent_id ?? ""
		await task.ask("tool", JSON.stringify({ tool: "selectActiveIntent", intentId }), block.partial).catch(() => {})
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
