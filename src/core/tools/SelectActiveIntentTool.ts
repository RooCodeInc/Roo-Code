import type { Task } from "../task/Task"
import { IntentManager } from "../../hooks/IntentManager"

export interface SelectActiveIntentParams {
	intent_id: string
}

export const selectActiveIntentTool = {
	async handle(
		task: Task,
		params: SelectActiveIntentParams,
		callbacks: {
			pushToolResult: (result: string) => void
			handleError: (action: string, error: Error) => void
		},
	): Promise<void> {
		try {
			console.log(`[SelectActiveIntentTool] Loading intent: ${params.intent_id}`)

			const intentManager = new IntentManager(task.cwd)
			const intents = await intentManager.loadIntents()
			const intent = intents.find((i) => i.id === params.intent_id)

			if (!intent) {
				callbacks.pushToolResult(
					`Error: Intent ${params.intent_id} not found. Available intents: ${intents.map((i) => i.id).join(", ")}`,
				)
				return
			}

			// Store selected intent in task for PreHook to check
			;(task as any).selectedIntentId = params.intent_id

			// Build context XML
			const contextXml = `<intent_context>
  <intent_id>${intent.id}</intent_id>
  <description>${intent.description}</description>
  <scope>
${intent.scope.map((s) => `    - ${s}`).join("\n")}
  </scope>
</intent_context>`

			callbacks.pushToolResult(
				`Intent ${params.intent_id} loaded successfully.\n\n${contextXml}\n\nYou may now proceed with file operations within the specified scope.`,
			)
		} catch (error) {
			callbacks.handleError("selecting active intent", error as Error)
		}
	},
}
