import fs from "fs/promises"
import * as path from "path"
import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id } = params
		const { handleError, pushToolResult } = callbacks

		try {
			const intentsPath = path.join(task.cwd, ".orchestration", "active_intents.yaml")
			let content: string
			try {
				content = await fs.readFile(intentsPath, "utf-8")
			} catch (error) {
				pushToolResult("ERROR: Intent ID not found in .orchestration/active_intents.yaml")
				return
			}

			// Simple YAML parsing for INT-001 pattern
			const lines = content.split("\n")
			let intentStartIndex = -1
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].includes(`id: "${intent_id}"`)) {
					// Found the intent ID, now find the next intent or end of file
					intentStartIndex = i
					break
				}
			}

			if (intentStartIndex === -1) {
				pushToolResult(`ERROR: Intent ID '${intent_id}' not found in .orchestration/active_intents.yaml`)
				return
			}

			// Extract intent block (assuming it starts with - id: and everything until next - id: or indentation change)
			// For this specific yaml, it's fairly structured.

			// We need to extract: name, status, owned_scope, constraints, acceptance_criteria
			// But the user wants it in XML strictly as <intent_context>

			// Let's just find the scope and constraints for now as requested.
			// Actually, let's just grab the whole block for that ID.

			let intentBlock = ""
			// Find start of intent entry (the line with - id:)
			let realStart = intentStartIndex
			while (realStart >= 0 && !lines[realStart].trim().startsWith("- id:")) {
				realStart--
			}

			if (realStart < 0) realStart = intentStartIndex

			let j = realStart
			intentBlock += lines[j] + "\n"
			j++
			while (j < lines.length && !lines[j].trim().startsWith("- id:")) {
				intentBlock += lines[j] + "\n"
				j++
			}

			// Helper to extract yaml fields
			const getField = (name: string) => {
				const regex = new RegExp(`${name}:\\s*([\\s\\S]*?)(?:\\n\\s*\\w+:|$)`)
				const match = intentBlock.match(regex)
				if (!match) return ""
				let val = match[1].trim()
				if (val.startsWith("-")) {
					// It's a list
					return val
						.split("\n")
						.map((l) => l.replace(/^\s*-\s*/, "").trim())
						.join("\n      ")
				}
				return val.replace(/^"|"$/g, "")
			}

			const name = getField("name")
			const scope = getField("owned_scope")
			const constraints = getField("constraints")

			const xmlResult = `<intent_context>
  <id>${intent_id}</id>
  <name>${name}</name>
  <scope>
    ${scope}
  </scope>
  <constraints>
    ${constraints}
  </constraints>
</intent_context>`

			task.activeIntentId = intent_id
			pushToolResult(xmlResult)
		} catch (error) {
			await handleError("selecting active intent", error as Error)
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
