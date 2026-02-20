import fs from "fs"
import yaml from "js-yaml"

export interface Intent {
	id: string
	name: string
	status: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

export class IntentHookEngine {
	private intents: Record<string, Intent> = {}
	private currentSessionIntent: Intent | null = null
	private orchestrationDir = ".orchestration"
	private intentsPath = ".orchestration/active_intents.yaml"
	private tracePath = ".orchestration/agent_trace.jsonl"

	constructor() {
		this.intents = this.loadIntents()
	}

	private loadIntents(): Record<string, Intent> {
		try {
			if (!fs.existsSync(this.intentsPath)) return {}
			const file = fs.readFileSync(this.intentsPath, "utf8")
			const data = yaml.load(file) as any
			const intents: Record<string, Intent> = {}
			if (Array.isArray(data?.active_intents)) {
				for (const item of data.active_intents) {
					if (item?.id) intents[item.id] = item as Intent
				}
			}
			return intents
		} catch (err) {
			console.warn("IntentHookEngine: failed to load intents:", err)
			return {}
		}
	}

	/**
	 * Gatekeeper: check whether a tool is allowed given current session
	 */
	gatekeeper(tool: string): { allowed: boolean; message?: string } {
		const restrictedTools = ["write_file", "apply_diff", "execute_command", "write_to_file"]
		if (restrictedTools.includes(tool)) {
			if (!this.currentSessionIntent) {
				return {
					allowed: false,
					message:
						"You must cite a valid active Intent ID via select_active_intent before performing structural changes.",
				}
			}
		}
		return { allowed: true }
	}

	/**
	 * Handle select_active_intent: validate and return XML context
	 */
	preHook(tool: string, payload: any): string | { allowed: boolean; message: string } {
		if (tool === "select_active_intent") {
			const intentId = payload?.intent_id
			const intents = this.loadIntents()
			const intent = intents?.[intentId]
			if (!intent) {
				throw new Error(
					`Invalid Intent ID: "${intentId}". You must cite a valid active Intent ID from .orchestration/active_intents.yaml`,
				)
			}

			this.currentSessionIntent = intent

			const intentContextBlock = `<intent_context>\n  <intent_id>${intent.id}</intent_id>\n  <intent_name>${intent.name}</intent_name>\n  <status>${intent.status}</status>\n  <constraints>${intent.constraints.join(", ")}</constraints>\n  <scope>${intent.owned_scope.join(", ")}</scope>\n</intent_context>`
			return intentContextBlock
		}

		return { allowed: true }
	}

	getCurrentSessionIntent(): Intent | null {
		return this.currentSessionIntent
	}

	clearSessionIntent(): void {
		this.currentSessionIntent = null
	}

	logTrace(path: string, content: string): void {
		try {
			const hash = require("crypto").createHash("sha256").update(content, "utf8").digest("hex")
			const entry = {
				intent_id: this.currentSessionIntent?.id ?? null,
				path,
				sha256: hash,
				ts: new Date().toISOString(),
			}
			if (!fs.existsSync(this.orchestrationDir)) fs.mkdirSync(this.orchestrationDir)
			fs.appendFileSync(this.tracePath, JSON.stringify(entry) + "\n")
		} catch (err) {
			console.warn("IntentHookEngine: failed to log trace", err)
		}
	}
}

export const intentHookEngine = new IntentHookEngine()
