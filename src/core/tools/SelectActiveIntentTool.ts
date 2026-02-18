import { formatResponse } from "../prompts/responses"
import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { IntentManager } from "../../hooks/IntentManager"
import { OrchestrationStorage } from "../../hooks/OrchestrationStorage"

interface SelectActiveIntentParams {
	intent_id: string
}

function getIntentManager(): IntentManager {
	const globalObj = global as any
	if (!globalObj.__intentManager) {
		globalObj.__intentManager = new IntentManager(new OrchestrationStorage())
	}
	return globalObj.__intentManager as IntentManager
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id } = params
		const { pushToolResult, handleError } = callbacks

		try {
			if (!intent_id) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "intent_id"))
				return
			}

			const intentManager = getIntentManager()
			intentManager.invalidateCache()

			const intent = await intentManager.getIntent(intent_id)
			if (!intent) {
				const availableIntents = (await intentManager.loadIntents()).map((i) => i.id).join(", ")
				task.recordToolError("select_active_intent")
				task.didToolFailInCurrentTurn = true
				pushToolResult(
					formatResponse.toolError(
						availableIntents.length > 0
							? `Intent ${intent_id} not found. Available intents: ${availableIntents}.`
							: `Intent ${intent_id} not found. No intents are defined. Create .orchestration/active_intents.yaml.`,
					),
				)
				return
			}

			if (intent.status === "COMPLETED" || intent.status === "BLOCKED") {
				task.recordToolError("select_active_intent")
				task.didToolFailInCurrentTurn = true
				pushToolResult(
					formatResponse.toolError(
						`Intent ${intent.id} cannot be activated because its status is ${intent.status}.`,
					),
				)
				return
			}

			await intentManager.setActiveIntent(task.taskId, intent.id)
			task.consecutiveMistakeCount = 0

			pushToolResult(
				[
					`Active intent set to ${intent.id}: ${intent.name}`,
					`Status: ${intent.status}`,
					`Scope: ${intent.ownedScope.join(", ") || "(none)"}`,
					`Constraints: ${intent.constraints.join(" | ") || "(none)"}`,
				].join("\n"),
			)
		} catch (error) {
			await handleError("selecting active intent", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"select_active_intent">): Promise<void> {
		const partialMessage = JSON.stringify({
			tool: "selectActiveIntent",
			intentId: block.params.intent_id ?? "",
		})

		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
