import { Task } from "../task/Task"
import type { Intent } from "../intents/types"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { ToolUse } from "../../shared/tools"

export class ListActiveIntents extends BaseTool<"list_active_intents"> {
	readonly name = "list_active_intents" as const

	async execute(_params: any, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks

		try {
			const provider = task.providerRef.deref()
			if (!provider) {
				// TODO: Figure out what to do when provider becomes undefined
				return
			}

			const intentLoader = provider.getIntentLoader()
			await intentLoader.ensureLoaded()

			const intents = intentLoader.getAllIntents()
			if (intents.length === 0) {
				pushToolResult("No active intents found in .orchestration/active_intents.json")
				return
			}

			pushToolResult(`Available intents:\n\n${this.formatIntentList(intents)}`)
		} catch (error) {
			handleError("list active intents", error)
		}
	}

	private formatIntentList(intents: Array<Intent>) {
		return intents
			.map(
				(intent) =>
					`- ${intent.id}: ${intent.name} (${intent.status})\n  Scope: ${intent.owned_scopes?.join(", ") || "None"}\n  Constraints: ${intent.constraints?.join(", ") || "None"}`,
			)
			.join("\n\n")
	}

	override async handlePartial(_task: Task, _block: ToolUse<"list_active_intents">): Promise<void> {}
}

export const listActiveIntentsTool = new ListActiveIntents()
