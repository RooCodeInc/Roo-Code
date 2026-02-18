import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "js-yaml"
import { ToolUse, HandleError, PushToolResult } from "../../shared/tools"

export class SelectActiveIntentTool {
	async handle(
		cline: any,
		block: ToolUse<"select_active_intent">,
		options: {
			taskApproval: any
			handleError: HandleError
			pushToolResult: PushToolResult
		},
	) {
		const intentId = block.nativeArgs?.intent_id || block.params.intent_id
		if (!intentId) {
			await options.handleError("select_active_intent", new Error("intent_id is required"))
			return
		}

		try {
			const configPath = path.resolve(cline.cwd, ".orchestration/active_intents.yaml")
			const fileContent = await fs.readFile(configPath, "utf-8")
			const config: any = yaml.load(fileContent)

			const intent = config.active_intents.find((i: any) => i.id === intentId)
			if (!intent) {
				options.pushToolResult(`Error: Intent ID "${intentId}" not found in .orchestration/active_intents.yaml`)
				return
			}

			// Inject into task context
			cline.activeIntentId = intent.id
			cline.activeIntentMetadata = intent

			options.pushToolResult(`SUCCESS: Intent "${intent.id}" (${intent.name}) selected.
Architectural constraints and owned scope have been loaded.
Mode: ${intent.mode}
Definition of Done: ${intent.definition_of_done}`)
		} catch (error) {
			await options.handleError("select_active_intent", error)
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
