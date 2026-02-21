import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { IntentManager } from "../../hooks/IntentManager"

/**
 * GetActiveIntentTool allows the AI or user to query the currently active intent for a task.
 * This is useful for checking which intent is governing operations.
 */
export class GetActiveIntentTool extends BaseTool<"get_active_intent"> {
	readonly name = "get_active_intent" as const

	constructor(private intentManager: IntentManager) {
		super()
	}

	async execute(params: Record<string, never>, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks

		try {
			const workspaceRoot = task.workspacePath
			const intents = await this.intentManager.loadIntents(workspaceRoot)
			if (intents.length === 0) {
				pushToolResult(
					`No intents are defined in active_intents.yaml.\n\n` +
						`Please create at least one intent in .orchestration/active_intents.yaml before selecting or querying an intent.`,
				)
				return
			}

			const activeIntent = await this.intentManager.getActiveIntent(task.taskId)
			if (!activeIntent) {
				pushToolResult(
					`No active intent is currently selected for this task.\n\n` +
						`To select an intent, use the select_active_intent tool with an intent_id from active_intents.yaml (e.g. INT-001).`,
				)
				return
			}

			// Format intent information
			const scopePatterns = activeIntent.ownedScope.length > 0 ? activeIntent.ownedScope.join(", ") : "None"
			const constraints = activeIntent.constraints.length > 0 ? activeIntent.constraints.join("\n  - ") : "None"
			const acceptanceCriteria =
				activeIntent.acceptanceCriteria.length > 0 ? activeIntent.acceptanceCriteria.join("\n  - ") : "None"

			const result = `Active Intent: ${activeIntent.id} - ${activeIntent.name}

Description: ${activeIntent.description}

Status: ${activeIntent.status}

Scope (authorized file paths):
  ${scopePatterns}

Constraints:
  - ${constraints}

Acceptance Criteria:
  - ${acceptanceCriteria}`

			pushToolResult(result)
		} catch (error) {
			await handleError("getting active intent", error as Error)
		}
	}
}

// Export singleton instance - will be initialized in extension.ts
let getActiveIntentToolInstance: GetActiveIntentTool | null = null

export function initializeGetActiveIntentTool(intentManager: IntentManager): void {
	getActiveIntentToolInstance = new GetActiveIntentTool(intentManager)
}

export const getActiveIntentTool = new Proxy({} as GetActiveIntentTool, {
	get(target, prop) {
		if (!getActiveIntentToolInstance) {
			throw new Error("GetActiveIntentTool not initialized. Call initializeGetActiveIntentTool() first.")
		}
		return (getActiveIntentToolInstance as any)[prop]
	},
})
