import * as fs from "fs"
import * as path from "path"
import * as yaml from "yaml"

export class SelectActiveIntentTool {
	async handle(params: { intent_id: string }, workspaceRoot: string): Promise<string> {
		if (!params.intent_id?.trim()) {
			return "ERROR: Missing required parameter 'intent_id'."
		}
		try {
			const content = await fs.promises.readFile(
				path.join(workspaceRoot, ".orchestration", "active_intents.yaml"),
				"utf-8",
			)
			const data = yaml.parse(content) as any
			const intents = Array.isArray(data)
				? data
				: Array.isArray(data?.active_intents)
					? data.active_intents
					: Array.isArray(data?.intents)
						? data.intents
						: Object.entries(data ?? {}).map(([intent_id, entry]) => ({ intent_id, ...(entry as object) }))
			const match = intents.find((intent: any) => (intent?.intent_id ?? intent?.id) === params.intent_id)
			if (!match) {
				return `ERROR: Intent '${params.intent_id}' not found in .orchestration/active_intents.yaml.`
			}
			return `<intent_context>${JSON.stringify(match, null, 2)}</intent_context>`
		} catch (error) {
			if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
				return "ERROR: Governance sidecar not found at .orchestration/active_intents.yaml. Please initialize Phase 0 first."
			}
			return `ERROR: Failed to read or parse .orchestration/active_intents.yaml: ${
				error instanceof Error ? error.message : String(error)
			}`
		}
	}
}
