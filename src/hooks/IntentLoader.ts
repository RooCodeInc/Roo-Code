import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"

export class IntentLoader {
	private orchestrationPath: string

	constructor(cwd: string) {
		this.orchestrationPath = path.join(cwd, ".orchestration", "active_intents.yaml")
	}

	async load(intentId: string): Promise<string> {
		try {
			const content = await fs.readFile(this.orchestrationPath, "utf8")
			const data = yaml.load(content) as any
			const intent = data.intents?.find((i: any) => i.id === intentId)

			if (!intent) return `ERROR: Intent ID ${intentId} not found.`

			// Prepare the consolidated XML context for Step 4
			return `
<intent_context id="${intent.id}">
    <description>${intent.description}</description>
    <constraints>${intent.constraints?.join("; ")}</constraints>
    <owned_scope>${intent.owned_scope?.join(", ")}</owned_scope>
</intent_context>`
		} catch (error) {
			return `ERROR: Failed to load orchestration data: ${error}`
		}
	}
}
