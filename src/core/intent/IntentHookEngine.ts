import fs from "fs"
import yaml from "js-yaml"
import { ScopeValidator, type ScopeValidationResult } from "./ScopeValidator"
import { ApprovalManager, type ApprovalRequest } from "./ApprovalManager"

export interface Intent {
	id: string
	name: string
	status: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

export interface OutOfScopeError {
	type: "OUT_OF_SCOPE"
	message: string
	files: string[]
	scope: string[]
	requires_approval: boolean
}

/**
 * Intent Hook Engine: Orchestrates intent context and scope enforcement
 *
 * Responsibilities:
 * 1. Load and manage active intents from .orchestration/active_intents.yaml
 * 2. Gate-keep access to restricted tools (write_file, apply_diff, execute_command)
 * 3. Validate proposed changes against intent scope (owned_scope)
 * 4. Require human approval for out-of-scope changes
 * 5. Provide intent context injection for agents
 *
 * Flow:
 * 1. Agent calls select_active_intent(intent_id) → loads context
 * 2. Agent proposes change via write_file/apply_diff
 * 3. Pre-hook validates scope of proposed files
 * 4. If out-of-scope: require request_human_approval before executing
 * 5. If approved with override: log decision and proceed
 * 6. Post-hook logs all changes to agent_trace.jsonl
 */
export class IntentHookEngine {
	private intents: Record<string, Intent> = {}
	private currentSessionIntent: Intent | null = null
	private orchestrationDir = ".orchestration"
	private intentsPath = ".orchestration/active_intents.yaml"
	private tracePath = ".orchestration/agent_trace.jsonl"
	private scopeValidator = ScopeValidator
	private approvalManager = new ApprovalManager()

	constructor() {
		this.intents = this.loadIntents()
	}

	/**
	 * Load intents from active_intents.yaml
	 */
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
	 * Validate that proposed changes are within the current intent's scope
	 * Used as a pre-hook for write_file, apply_diff, etc.
	 *
	 * @param filePaths - Array of file paths that will be modified
	 * @returns validation result with scope check
	 */
	validateScope(filePaths: string[]): ScopeValidationResult {
		if (!this.currentSessionIntent) {
			return {
				isWithinScope: false,
				reason: "No active intent - cannot validate scope",
				attemptedPath: filePaths[0],
			}
		}

		return this.scopeValidator.arePathsInScope(filePaths, this.currentSessionIntent.owned_scope)
	}

	/**
	 * Check if a single file is within scope
	 */
	isFileInScope(filePath: string): boolean {
		if (!this.currentSessionIntent) return false
		const result = this.scopeValidator.isPathInScope(filePath, this.currentSessionIntent.owned_scope)
		return result.isWithinScope
	}

	/**
	 * Require human approval for out-of-scope changes
	 * Blocks execution until approval decision is received
	 */
	async requestApprovalForOutOfScope(
		changeSummary: string,
		diff: string,
		filesAffected: string[],
		outOfScopeFiles: string[],
	): Promise<{ approved: boolean; requiresOverride: boolean }> {
		const fullSummary = `${changeSummary}\n\nWARNING: The following files are outside the current intent's scope:\n${outOfScopeFiles.map((f) => `  - ${f}`).join("\n")}\n\nHuman approval required to override scope enforcement.`

		const request = ApprovalManager.createRequest(
			fullSummary,
			diff,
			filesAffected,
			this.currentSessionIntent?.id,
		)

		const decision = await this.approvalManager.submitForApproval(request)

		return {
			approved: decision.approved,
			requiresOverride: decision.requires_override ?? false,
		}
	}

	/**
	 * Record approval decision
	 * Called by approval service after human review
	 */
	recordApprovalDecision(
		requestId: string,
		approved: boolean,
		approver: string,
		notes?: string,
		requiresOverride?: boolean,
	): void {
		this.approvalManager.recordDecision(requestId, approved, approver, notes, requiresOverride)
	}

	/**
	 * Get pending approval requests
	 */
	getPendingApprovals(): Record<string, ApprovalRequest> {
		const pending = this.approvalManager.getPendingRequests()
		const result: Record<string, ApprovalRequest> = {}
		for (const req of pending) {
			result[req.request_id] = req
		}
		return result
	}

	/**
	 * Pre-Hook: validate intent selection and return context
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

		return { allowed: true }
	}

	/**
	 * Get current active session intent
	 */
	getCurrentSessionIntent(): Intent | null {
		return this.currentSessionIntent
	}

	/**
	 * Clear the current session intent
	 */
	clearSessionIntent(): void {
		this.currentSessionIntent = null
	}

	/**
	 * Log trace entry with intent context
	 */
	logTrace(filePath: string, content: string): void {
		try {
			const hash = require("crypto").createHash("sha256").update(content, "utf8").digest("hex")
			const entry = {
				intent_id: this.currentSessionIntent?.id ?? null,
				path: filePath,
				sha256: hash,
				ts: new Date().toISOString(),
			}
			if (!fs.existsSync(this.orchestrationDir)) {
				fs.mkdirSync(this.orchestrationDir, { recursive: true })
			}
			fs.appendFileSync(this.tracePath, JSON.stringify(entry) + "\n")
		} catch (err) {
			console.warn("IntentHookEngine: failed to log trace:", err)
		}
	}

	/**
	 * Get all approvals for a specific intent
	 */
	getIntentApprovals(intentId: string): any[] {
		return this.approvalManager.getApprovalsByIntent(intentId)
	}

	/**
	 * Check approval status by request ID
	 */
	isApprovalPending(requestId: string): boolean {
		const request = this.approvalManager.getPendingRequest(requestId)
		return !!request
	}
}

export const intentHookEngine = new IntentHookEngine()
