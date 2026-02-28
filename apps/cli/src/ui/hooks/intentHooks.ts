// src/hooks/intentHooks.ts
// @ts-ignore - fs module for Node.js runtime
import fs from "fs"

let yamlModule: any = null

// Dynamically load yaml module with error handling
try {
	// @ts-ignore
	yamlModule = require("js-yaml")
} catch {
	// yaml not available, will handle gracefully in loadIntents()
}

interface Intent {
	id: string
	name: string
	status: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

export class IntentHookEngine {
	private intents: Record<string, Intent>
	private currentSessionIntent: Intent | null = null

	constructor() {
		this.intents = this.loadIntents()
	}

	private loadIntents(): Record<string, Intent> {
		if (!yamlModule || !yamlModule.load) {
			console.warn("YAML module (js-yaml) not available. Intents cannot be loaded.")
			return {}
		}

		try {
			const file = fs.readFileSync(".orchestration/active_intents.yaml", "utf8")
			const data = yamlModule.load(file)
			const intents: Record<string, Intent> = {}
			if (Array.isArray(data?.active_intents)) {
				data.active_intents.forEach((intent: Intent) => {
					intents[intent.id] = intent
				})
			}
			return intents
		} catch (error) {
			console.warn(`Failed to load intents: ${error instanceof Error ? error.message : String(error)}`)
			return {}
		}
	}

	/**
	 * Gatekeeper: Pre-Hook validation before execution
	 * - Blocks write_file and apply_diff without an active session intent
	 * - Validates that the current session intent exists
	 */
	gatekeeper(tool: string): { allowed: boolean; message?: string } {
		const restrictedTools = ["write_file", "apply_diff", "execute_command"]

		const toolIsRestricted = restrictedTools.some((t) => t === tool)
		if (toolIsRestricted) {
			if (!this.currentSessionIntent) {
				return {
					allowed: false,
					message:
						"You must cite a valid active Intent ID via select_active_intent before performing structural changes.",
				}
			}

			// Optional: validate that the tool operation is within owned_scope
			// This would require parsing the file path from the tool payload
			// Implementation deferred to post-hook phase
		}

		return { allowed: true }
	}

	/**
	 * Pre-Hook logic for select_active_intent
	 * - Validates intent_id exists in active_intents.yaml
	 * - Sets currentSessionIntent to track active context
	 * - Injects constraints and scope
	 * - Returns XML <intent_context> block
	 */
	preHook(tool: string, payload: any): string | { allowed: boolean; message: string } {
		// Gatekeeper check for restricted mutations
		const gatekeeperResult = this.gatekeeper(tool)
		if (!gatekeeperResult.allowed) {
			return {
				allowed: false,
				message: gatekeeperResult.message || "Operation blocked: no active intent.",
			}
		}

		// Handle select_active_intent tool
		if (tool === "select_active_intent") {
			const intentId = payload.intent_id
			const intent = this.intents[intentId]

			// Gatekeeper: block if invalid intent_id
			if (!intent) {
				throw new Error(
					`Invalid Intent ID: "${intentId}". You must cite a valid active Intent ID from .orchestration/active_intents.yaml`,
				)
			}

			// Set the current session intent to unlock mutations
			this.currentSessionIntent = intent

			// Construct XML context block with complete intent metadata
			const intentContextBlock = `<intent_context>
  <intent_id>${intent.id}</intent_id>
  <intent_name>${intent.name}</intent_name>
  <status>${intent.status}</status>
  <constraints>
${intent.constraints.map((c) => `    - ${c}`).join("\n")}
  </constraints>
  <owned_scope>
${intent.owned_scope.map((s) => `    - ${s}`).join("\n")}
  </owned_scope>
  <acceptance_criteria>
${intent.acceptance_criteria.map((ac) => `    - ${ac}`).join("\n")}
  </acceptance_criteria>
</intent_context>`

			return intentContextBlock
		}

		return ""
	}

	/**
	 * Retrieve the current active session intent
	 * Useful for post-hook validation and tracing
	 */
	getCurrentSessionIntent(): Intent | null {
		return this.currentSessionIntent
	}

	/**
	 * Clear the current session intent
	 * Called when task is completed or session ends
	 */
	clearSessionIntent(): void {
		this.currentSessionIntent = null
	}
}
