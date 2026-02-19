import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { Task } from "../task/Task"
import fs from "fs/promises"
import path from "path"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks
		try {
			const orchestrationPath = path.join(task.cwd, ".orchestration", "active_intents.yaml")
			const yamlRaw = await fs.readFile(orchestrationPath, "utf-8")
			// Simple YAML parse (replace with a YAML parser if available)
			const match = new RegExp(`- id: "${params.intent_id}"([\s\S]*?)(?=\n\s*- id:|$)`, "m").exec(yamlRaw)
			if (!match) {
				pushToolResult(`<error>You must cite a valid active Intent ID</error>`)
				return
			}
			const block = match[1]
			// Extract constraints and scope
			const constraints =
				/constraints:\n([\s\S]*?)\n\s*acceptance_criteria:/m
					.exec(block)?.[1]
					?.trim()
					.split("\n")
					.map((l) => l.replace(/^- /, "").trim()) || []
			const scope =
				/owned_scope:\n([\s\S]*?)\n\s*constraints:/m
					.exec(block)?.[1]
					?.trim()
					.split("\n")
					.map((l) => l.replace(/^- /, "").trim()) || []
			// Build XML
			const xml = `<intent_context id="${params.intent_id}">\n  <scope>${scope.join(", ")}</scope>\n  <constraints>${constraints.join(", ")}</constraints>\n</intent_context>`
			pushToolResult(xml)
		} catch (e) {
			await handleError("select_active_intent", e as Error)
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
