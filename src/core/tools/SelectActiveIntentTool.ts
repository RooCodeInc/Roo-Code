import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks
		const { intent_id } = params

		try {
			if (!task.intentController) {
				throw new Error("IntentController not initialized")
			}

			// In this advanced model, search for the intent in the active list first
			let intent = task.intentController.getIntent(intent_id)

			if (!intent) {
				pushToolResult(
					`Error: Intent ID '${intent_id}' not found in .orchestration/active_intents.yaml. You may need to ask the user to add it or use an existing one from .orchestration/intent_map.md.`,
				)
				return
			}

			// Update status if it's not already in progress
			if (intent.status !== "IN_PROGRESS") {
				await task.intentController.updateIntentStatus(intent_id, "IN_PROGRESS")
			}

			// Essential: Set the session-level active intent ID for the Hook Engine
			task.intentController.setActiveIntentId(intent_id)

			const contextBlock = [
				`<intent_context>`,
				`ID: ${intent.id}`,
				`Name: ${intent.name}`,
				`Status: ${intent.status}`,
				`Description: ${intent.description}`,
				`Constraints:`,
				...(intent.constraints || []).map((c) => `- ${c}`),
				`Owned Scope:`,
				...(intent.owned_scope || []).map((s) => `- ${s}`),
				`Acceptance Criteria:`,
				...(intent.acceptance_criteria || []).map((ac) => `- ${ac}`),
				`</intent_context>`,
			].join("\n")

			pushToolResult(contextBlock)
		} catch (error) {
			await handleError("selecting active intent", error as Error)
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
