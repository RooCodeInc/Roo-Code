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

			const intent = task.intentController.getIntent(intent_id)

			if (!intent) {
				pushToolResult(`Error: Intent ID '${intent_id}' not found in intent_map.yaml.`)
				return
			}

			task.intentController.setActiveIntentId(intent_id)

			const contextBlock = [
				`<intent_context>`,
				`ID: ${intent.id}`,
				`Description: ${intent.description}`,
				`Constraints:`,
				...intent.constraints.map((c) => `- ${c}`),
				`Scope:`,
				...intent.owned_scope.map((s) => `- ${s}`),
				`</intent_context>`,
			].join("\n")

			pushToolResult(contextBlock)
		} catch (error) {
			await handleError("selecting active intent", error as Error)
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
