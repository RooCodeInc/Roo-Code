/**
 * Intent API / Registry - Core logic for intent-related MCP tools
 * Handles intent discovery and selection
 */

import { IntentContextLoader } from "../hooks/IntentContextLoader"
import { IntentMetadata } from "../hooks/types"

export class IntentApi {
	private intentLoader: IntentContextLoader

	constructor(workspaceRoot: string) {
		this.intentLoader = new IntentContextLoader(workspaceRoot)
	}

	/**
	 * List all active intents for the LLM
	 * @returns List of available intents
	 */
	async listIntents(): Promise<string> {
		const intents = await this.intentLoader.loadActiveIntents()
		if (intents.length === 0) {
			const yamlPath = require("path").resolve(
				(this.intentLoader as any).workspaceRoot,
				".orchestration/active_intents.yaml",
			)
			return `No active intents found. I checked for the configuration at: ${yamlPath}\n\nYou must define an intent in this file before proceeding with codebase mutations.`
		}

		const formattedList = intents
			.map((i) => `- ${i.id}: ${i.name} [Status: ${i.status}] (Scope: ${i.owned_scope.join(", ")})`)
			.join("\n")

		return `Available Intent Specifications:\n\n${formattedList}\n\nCall select_active_intent(intent_id) to begin working on one of these.`
	}

	/**
	 * Implementation plan for select_active_intent is actually handled by the PreToolUse hook.
	 * This API provides the backend data access.
	 */
	async getIntent(intentId: string): Promise<IntentMetadata | undefined> {
		return await this.intentLoader.loadIntent(intentId)
	}
}
