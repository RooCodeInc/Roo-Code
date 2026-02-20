import * as vscode from "vscode"
import { IntentManager } from "./IntentManager"
import { TraceLogger } from "./TraceLogger"

export class HookEngine {
	private intentManager: IntentManager
	private traceLogger: TraceLogger
	private activeIntentId: string | null = null

	constructor(workspaceRoot: string) {
		this.intentManager = new IntentManager(workspaceRoot)
		this.traceLogger = new TraceLogger(workspaceRoot)
	}

	async init() {
		await this.intentManager.ensureOrchestrationDir()
	}

	async preToolUse(
		toolName: string,
		params: any,
	): Promise<{ allowed: boolean; injectedContext?: string; error?: string }> {
		// Mandatory Handshake
		if (toolName === "select_active_intent") {
			const intent = await this.intentManager.getIntent(params.intent_id)
			if (!intent) return { allowed: false, error: `Invalid Intent ID: ${params.intent_id}` }

			this.activeIntentId = params.intent_id

			const ctx = `<intent_context>
  <id>${intent.id}</id>
  <name>${intent.name}</name>
  <constraints>${intent.constraints.join(" | ")}</constraints>
  <scope>${intent.owned_scope.join(" | ")}</scope>
</intent_context>`

			return { allowed: true, injectedContext: ctx }
		}

		// Gatekeeper for ALL other tools
		if (!this.activeIntentId) {
			return {
				allowed: false,
				error: "❌ YOU MUST FIRST CALL select_active_intent(intent_id) — Intent-Driven Protocol enforced.",
			}
		}

		// Scope Enforcement on writes
		if (["write_to_file", "apply_diff", "edit_file"].includes(toolName)) {
			const file = params.path || params.file || params.targetFile
			const intent = await this.intentManager.getIntent(this.activeIntentId)
			const inScope = intent!.owned_scope.some((p: string) => file.includes(p.replace("**", "")))
			if (!inScope) {
				return { allowed: false, error: `Scope Violation: ${this.activeIntentId} cannot edit ${file}` }
			}
		}

		return { allowed: true }
	}

	async postToolUse(toolName: string, params: any, result: any) {
		if (["write_to_file", "apply_diff", "edit_file"].includes(toolName)) {
			const file = params.path || params.file || params.targetFile
			const start = params.startLine || 1
			const end = params.endLine || 999999
			await this.traceLogger.logWrite(this.activeIntentId!, file, start, end)
		}
	}
}
