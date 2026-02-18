/**
 * Select Active Intent Tool
 *
 * This tool allows the agent to "checkout" an intent before performing any
 * destructive operations. This enforces the Reasoning Loop pattern.
 */

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { getHookEngine } from "../../hooks/HookEngine"
import { validateIntentId, formatIntentForDisplay } from "../../hooks/IntentValidator"
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
			pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "intent_id"))
			return
		}

		// Validate intent ID
		const validation = await validateIntentId(task.cwd, intentId)

		if (!validation.valid) {
			task.consecutiveMistakeCount++
			task.recordToolError("select_active_intent")
			pushToolResult(formatResponse.toolError(validation.error || "Invalid intent"))
			return
		}

		// Set the active intent in the hook engine
		const hookEngine = getHookEngine()
		const result = await hookEngine.setActiveIntent(intentId)

		if (!result.allowed) {
			task.consecutiveMistakeCount++
			task.recordToolError("select_active_intent")
			pushToolResult(formatResponse.toolError(result.errorMessage || "Failed to set active intent"))
			return
		}

		task.consecutiveMistakeCount = 0

		// Format the intent context for display
		const intentDisplay = formatIntentForDisplay(validation.intent!)

		const successMessage = `
## Intent Selected Successfully

${intentDisplay}

You now have context to work within this intent's scope. You may proceed with your task.
When making file modifications, ensure they stay within the owned scope listed above.
`.trim()

		pushToolResult(successMessage)
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
