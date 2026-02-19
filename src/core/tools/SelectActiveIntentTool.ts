import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { OrchestrationStore } from "../../hooks/OrchestrationStore"
import { IntentContextService } from "../../hooks/IntentContextService"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	private resolveWorkspacePath(task: Task): string | undefined {
		const fromWorkspacePath = (task as Task & { workspacePath?: string }).workspacePath
		if (typeof fromWorkspacePath === "string" && fromWorkspacePath.trim().length > 0) {
			return fromWorkspacePath.trim()
		}

		const cwd = task.cwd
		if (typeof cwd === "string" && cwd.trim().length > 0) {
			return cwd.trim()
		}

		return undefined
	}

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

			const workspacePath = this.resolveWorkspacePath(task)
			if (!workspacePath) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError("Cannot resolve workspace path for select_active_intent."))
				return
			}

			const store = new OrchestrationStore(workspacePath)
			const intentContextService = new IntentContextService(store)
			const result = await intentContextService.selectIntent(intentId)

			if (!result.found || !result.context) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError(result.message))
				return
			}

			task.setActiveIntentId(result.context.id)
			task.authorizeIntentCheckoutForTurn(result.context.id)
			await intentContextService.markIntentInProgress(result.context.id)
			task.consecutiveMistakeCount = 0
			const interceptedContext = task.consumePendingIntentHandshakeContext()
			pushToolResult(interceptedContext ?? result.message)
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
