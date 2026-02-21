import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { IntentManager } from "../../hooks/IntentManager"

interface SelectActiveIntentParams {
	intent_id: string
}

/**
 * SelectActiveIntentTool allows the AI or user to select an active intent
 * that governs subsequent tool operations. Only one intent can be active per task.
 */
export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	constructor(private intentManager: IntentManager) {
		super()
	}

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id } = params
		const { pushToolResult, handleError } = callbacks

		try {
			if (!intent_id || intent_id.trim() === "") {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				pushToolResult(formatResponse.toolError("intent_id parameter is required and cannot be empty."))
				return
			}

			// Verify intent exists in this task's workspace (.orchestration/active_intents.yaml)
			const workspaceRoot = task.workspacePath
			const intent = await this.intentManager.getIntent(intent_id, workspaceRoot)
			if (!intent) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				pushToolResult(
					formatResponse.toolError(
						`Intent ${intent_id} not found. Please select a valid intent from .orchestration/active_intents.yaml in this workspace.`,
					),
				)
				return
			}

			// Set active intent for this task
			await this.intentManager.setActiveIntent(task.taskId, intent_id, workspaceRoot)

			// Update task's activeIntentId property
			task.activeIntentId = intent_id

			console.log(
				`[SelectActiveIntentTool] Set active intent: taskId=${task.taskId}, intentId=${intent_id}, task.activeIntentId=${task.activeIntentId}`,
			)

			task.consecutiveMistakeCount = 0

			pushToolResult(
				`Active intent set to: ${intent.name} (${intent_id})\n` +
					`Description: ${intent.description}\n` +
					`Scope: ${intent.ownedScope.join(", ")}`,
			)
		} catch (error) {
			await handleError("selecting active intent", error as Error)
		}
	}
}

// Export singleton instance - will be initialized in extension.ts
let selectActiveIntentToolInstance: SelectActiveIntentTool | null = null

export function initializeSelectActiveIntentTool(intentManager: IntentManager): void {
	selectActiveIntentToolInstance = new SelectActiveIntentTool(intentManager)
}

export const selectActiveIntentTool = new Proxy({} as SelectActiveIntentTool, {
	get(target, prop) {
		if (!selectActiveIntentToolInstance) {
			throw new Error("SelectActiveIntentTool not initialized. Call initializeSelectActiveIntentTool() first.")
		}
		return (selectActiveIntentToolInstance as any)[prop]
	},
})
