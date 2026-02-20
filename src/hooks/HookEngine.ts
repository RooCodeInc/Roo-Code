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
		const safeParams = params ?? {}

		// Mandatory handshake.
		if (toolName === "select_active_intent") {
			const intentId = safeParams.intent_id
			if (!intentId || typeof intentId !== "string") {
				return { allowed: false, error: "Invalid Intent ID: missing intent_id" }
			}

			const intent = await this.intentManager.getIntent(intentId)
			if (!intent) return { allowed: false, error: `Invalid Intent ID: ${intentId}` }

			this.activeIntentId = intentId

			const constraints = Array.isArray(intent.constraints) ? intent.constraints : []
			const scope = Array.isArray(intent.owned_scope) ? intent.owned_scope : []

			const ctx = `<intent_context>
  <id>${intent.id}</id>
  <name>${intent.name}</name>
  <constraints>${constraints.join(" | ")}</constraints>
  <scope>${scope.join(" | ")}</scope>
</intent_context>`

			return { allowed: true, injectedContext: ctx }
		}

		// Gatekeeper for all other tools.
		if (!this.activeIntentId) {
			return {
				allowed: false,
				error: "YOU MUST FIRST CALL select_active_intent(intent_id) - Intent-Driven Protocol enforced.",
			}
		}

		// Scope enforcement on writes.
		if (["write_to_file", "apply_diff", "edit_file"].includes(toolName)) {
			const file = safeParams.path || safeParams.file || safeParams.targetFile
			const intent = await this.intentManager.getIntent(this.activeIntentId)
			const ownedScope = Array.isArray(intent?.owned_scope) ? intent.owned_scope : []
			const inScope = ownedScope.some((pattern: string) => file?.includes?.(pattern.replace("**", "")))
			if (!inScope) {
				return { allowed: false, error: `Scope Violation: ${this.activeIntentId} cannot edit ${file}` }
			}
		}

		return { allowed: true }
	}

	async postToolUse(toolName: string, params: any, result: any) {
		const safeParams = params ?? {}

		if (["write_to_file", "apply_diff", "edit_file"].includes(toolName)) {
			const file = safeParams.path || safeParams.file || safeParams.targetFile
			const start = safeParams.startLine || 1
			const end = safeParams.endLine || 999999

			if (!file || !this.activeIntentId) {
				return
			}

			await this.traceLogger.logWrite(this.activeIntentId, file, start, end)
		}
	}
}
