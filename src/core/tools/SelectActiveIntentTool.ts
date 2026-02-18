import * as path from "path"
import type { ToolUse } from "../../shared/tools"
import { Task } from "../task/Task"
import { BaseTool, type ToolCallbacks } from "./BaseTool"
import { loadActiveIntents } from "../../hooks/sidecarWriter"

type SelectActiveIntentParams = { intent_id: string }

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	public name = "select_active_intent" as const

	public override async execute(
		params: SelectActiveIntentParams,
		task: Task,
		callbacks: ToolCallbacks,
	): Promise<void> {
		const { pushToolResult } = callbacks
		const intentId = params.intent_id?.trim()
		if (!intentId) {
			task.recordToolError("select_active_intent")
			pushToolResult("Missing parameter intent_id")
			return
		}
		const cwd = task.cwd ?? ""
		const orchestrationDir = path.join(cwd, ".orchestration")
		const intents = await loadActiveIntents(orchestrationDir)
		const intent = intents.find((i) => i.id === intentId)
		task.activeIntentId = intentId
		// TRP1: return <intent_context> so the model has constraints and scope for the selected intent.
		if (intent) {
			const scope = (intent.owned_scope ?? []).join(", ") || "(no scope defined)"
			const constraints = (intent.constraints ?? []).join("; ") || "(no constraints)"
			const xml = `<intent_context>
<intent_id>${intent.id}</intent_id>
<name>${intent.name ?? intent.id}</name>
<owned_scope>${scope}</owned_scope>
<constraints>${constraints}</constraints>
</intent_context>`
			pushToolResult(`Active intent set to ${intentId}.\n\n${xml}`)
		} else {
			pushToolResult(
				`Active intent set to ${intentId}. (Add ${intentId} to .orchestration/active_intents.yaml for constraints and scope.)`,
			)
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
