import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "js-yaml"
import { ToolUse, HandleError, PushToolResult } from "../../shared/tools"

export class ListActiveIntentsTool {
	async handle(
		cline: any,
		block: ToolUse<"list_active_intents">,
		options: {
			taskApproval: any
			handleError: HandleError
			pushToolResult: PushToolResult
		},
	) {
		try {
			const configPath = path.resolve(cline.cwd, ".orchestration/active_intents.yaml")
			const fileContent = await fs.readFile(configPath, "utf-8")
			const config: any = yaml.load(fileContent)

			if (!config || !config.active_intents) {
				options.pushToolResult("No active intents found in configuration.")
				return
			}

			const intentList = config.active_intents
				.map(
					(intent: any) =>
						`- ${intent.id}: ${intent.name} [Status: ${intent.status}] (Scope: ${intent.owned_scope?.join(", ") || "N/A"})`,
				)
				.join("\n")
			options.pushToolResult(
				`Available Intent Specifications:\n\n${intentList}\n\nUse select_active_intent(intent_id) to activate one.`,
			)
		} catch (error) {
			await options.handleError("list_active_intents", error)
		}
	}
}

export const listActiveIntentsTool = new ListActiveIntentsTool()
