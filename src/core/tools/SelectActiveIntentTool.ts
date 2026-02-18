import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { formatResponse } from "../prompts/responses"
import { loadActiveIntents, findIntentById, buildIntentContextXml, isGovernedWorkspace } from "../context/activeIntents"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id } = params
		const { handleError, pushToolResult } = callbacks

		try {
			// Validate required parameter
			if (!intent_id) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent", "Missing required parameter: intent_id")
				pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "intent_id"))
				return
			}

			// Check if workspace is governed
			if (!isGovernedWorkspace(task.cwd)) {
				task.consecutiveMistakeCount++
				const errorMsg =
					"ERROR: No .orchestration/active_intents.yaml found in workspace. " +
					"This workspace is not governed — intent selection is not required. " +
					"Proceed with your task without calling select_active_intent."
				task.recordToolError("select_active_intent", errorMsg)
				pushToolResult(formatResponse.toolError(errorMsg))
				return
			}

			// Load intents from YAML
			const intents = await loadActiveIntents(task.cwd)

			if (intents.length === 0) {
				task.consecutiveMistakeCount++
				const errorMsg =
					"ERROR: .orchestration/active_intents.yaml exists but contains no valid intents. " +
					"Check the file format and ensure it contains a valid 'intents:' block."
				task.recordToolError("select_active_intent", errorMsg)
				pushToolResult(formatResponse.toolError(errorMsg))
				return
			}

			// Look up the requested intent
			const intent = findIntentById(intents, intent_id)

			if (!intent) {
				task.consecutiveMistakeCount++
				const validIds = intents.map((i) => i.id).join(", ")
				const errorMsg =
					`ERROR: Intent "${intent_id}" not found in active_intents.yaml. ` +
					`Valid intent IDs are: [${validIds}]. ` +
					`Please call select_active_intent with one of these IDs.`
				task.recordToolError("select_active_intent", errorMsg)
				pushToolResult(formatResponse.toolError(errorMsg))
				return
			}

			// Validate intent is IN_PROGRESS
			if (intent.status !== "IN_PROGRESS") {
				task.consecutiveMistakeCount++
				const inProgressIntents = intents.filter((i) => i.status === "IN_PROGRESS").map((i) => i.id)
				const validIdsMsg =
					inProgressIntents.length > 0
						? `Available IN_PROGRESS intents: [${inProgressIntents.join(", ")}]`
						: "No IN_PROGRESS intents available."
				const errorMsg =
					`ERROR: Intent "${intent_id}" has status "${intent.status}" — only IN_PROGRESS intents can be selected. ` +
					validIdsMsg
				task.recordToolError("select_active_intent", errorMsg)
				pushToolResult(formatResponse.toolError(errorMsg))
				return
			}

			// Success: set the active intent and return context
			task.consecutiveMistakeCount = 0
			task.activeIntentId = intent_id

			// Filter trace entries for this specific intent
			const relevantTrace = task.intentTraceLog.filter((e) => e.intentId === intent_id)

			// Store the loaded intent context on the task for pre-hook injection
			task.activeIntentContext = buildIntentContextXml(intent, relevantTrace)

			pushToolResult(task.activeIntentContext)
		} catch (error) {
			await handleError("loading intent context", error as Error)
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
