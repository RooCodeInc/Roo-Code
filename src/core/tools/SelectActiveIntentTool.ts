import fs from "fs/promises"
import path from "path"

import { ACTIVE_INTENTS_RELATIVE_PATH, loadIntentContext, renderIntentContextXml } from "../intent/IntentContextLoader"

export class SelectActiveIntentTool {
	async handle(params: { intent_id: string }, workspaceRoot: string, provider?: any): Promise<string> {
		const intentId = params.intent_id?.trim()

		if (!intentId) {
			return "ERROR: Missing required parameter 'intent_id'."
		}

		try {
			const context = await loadIntentContext(workspaceRoot, intentId)

			if (!context) {
				return `ERROR: Intent '${intentId}' not found in .orchestration/active_intents.yaml.`
			}

			await provider?.updateGlobalState("activeIntentId", intentId)

			const tracePath = path.join(workspaceRoot, ".roo-tool-trace.log")
			await fs
				.appendFile(
					tracePath,
					`[${new Date().toISOString()}] TOOL EXECUTED: select_active_intent [intent:${intentId}] intent_id=${intentId}\n`,
					"utf8",
				)
				.catch(() => {})

			return renderIntentContextXml(context)
		} catch (error) {
			if ((error as any)?.code === "ENOENT") {
				if ((error as any)?.path?.toString()?.includes(ACTIVE_INTENTS_RELATIVE_PATH)) {
					return "ERROR: Governance sidecar not found at .orchestration/active_intents.yaml. Please initialize Phase 0 first."
				}
				return "ERROR: Governance sidecar not found. Please ensure .orchestration/active_intents.yaml exists."
			}
			return `ERROR: Failed to read sidecar: ${error instanceof Error ? error.message : String(error)}`
		}
	}
}
