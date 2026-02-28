import fs from "fs"
import path from "path"

export interface ApprovalRequest {
	request_id: string
	timestamp: string
	change_summary: string
	diff: string
	files_affected: string[]
	intent_id?: string
	turn_id?: string
}

export interface ApprovalDecision {
	request_id: string
	timestamp: string
	approved: boolean
	approver: string
	approver_notes?: string
	requires_override?: boolean
}

export interface ApprovalLogEntry extends ApprovalRequest {
	decision?: ApprovalDecision
}

/**
 * Human-In-The-Loop Approval Manager
 *
 * Manages approval workflows for critical changes:
 * 1. Agent proposes change with summary + diff
 * 2. Tool blocks execution until human approves/rejects
 * 3. Decision recorded in approval_log.jsonl with metadata
 *
 * Benefits:
 * - Prevents accidental or out-of-scope changes
 * - Creates audit trail of human decisions
 * - Enables scope override with explicit human consent
 * - Tracks approval patterns for ML training
 */
export class ApprovalManager {
	private orchestrationDir = ".orchestration"
	private approvalLogPath = ".orchestration/approval_log.jsonl"
	private pendingRequests: Map<string, ApprovalRequest> = new Map()
	private approvedRequests: Map<string, ApprovalDecision> = new Map()

	constructor() {
		// Ensure orchestration directory exists
		if (!fs.existsSync(this.orchestrationDir)) {
			fs.mkdirSync(this.orchestrationDir, { recursive: true })
		}
		this.loadApprovalLog()
	}

	/**
	 * Load approval log from disk
	 */
	private loadApprovalLog(): void {
		try {
			if (!fs.existsSync(this.approvalLogPath)) return

			const content = fs.readFileSync(this.approvalLogPath, "utf8")
			const lines = content.trim().split("\n").filter((l) => l.length > 0)

			for (const line of lines) {
				const entry: ApprovalLogEntry = JSON.parse(line)
				if (entry.decision) {
					this.approvedRequests.set(entry.request_id, entry.decision)
				}
			}
		} catch (err) {
			console.warn("ApprovalManager: failed to load approval log:", err)
		}
	}

	/**
	 * Create a new approval request
	 */
	static createRequest(
		changeSummary: string,
		diff: string,
		filesAffected: string[],
		intentId?: string,
		turnId?: string,
	): ApprovalRequest {
		const requestId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		return {
			request_id: requestId,
			timestamp: new Date().toISOString(),
			change_summary: changeSummary,
			diff,
			files_affected: filesAffected,
			intent_id: intentId,
			turn_id: turnId,
		}
	}

	/**
	 * Submit an approval request and block until decision
	 * In production, this would interface with a UI/API for human approval
	 */
	async submitForApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
		// Store the pending request
		this.pendingRequests.set(request.request_id, request)

		// Log the request
		this.logRequest(request)

		// In a real system, this would:
		// 1. Send to approval UI/webhook
		// 2. Wait for human response via polling/websocket
		// 3. Return the decision

		// For now, simulate waiting for approval
		// The decision would be written by a human approval service
		return new Promise((resolve, reject) => {
			const pollInterval = setInterval(() => {
				if (this.approvedRequests.has(request.request_id)) {
					clearInterval(pollInterval)
					const decision = this.approvedRequests.get(request.request_id)!
					this.pendingRequests.delete(request.request_id)
					resolve(decision)
				}
			}, 100) // Poll every 100ms
		})
	}

	/**
	 * Record a human approval decision
	 * Called by approval UI/service after human reviews request
	 */
	recordDecision(
		requestId: string,
		approved: boolean,
		approver: string,
		approverNotes?: string,
		requiresOverride?: boolean,
	): ApprovalDecision {
		const decision: ApprovalDecision = {
			request_id: requestId,
			timestamp: new Date().toISOString(),
			approved,
			approver,
			approver_notes: approverNotes,
			requires_override: requiresOverride,
		}

		this.approvedRequests.set(requestId, decision)

		// Log the decision
		const request = this.pendingRequests.get(requestId) || { request_id: requestId }
		this.logDecision(request as ApprovalRequest, decision)

		return decision
	}

	/**
	 * Get a pending request by ID
	 */
	getPendingRequest(requestId: string): ApprovalRequest | undefined {
		return this.pendingRequests.get(requestId)
	}

	/**
	 * Get all pending requests
	 */
	getPendingRequests(): ApprovalRequest[] {
		return Array.from(this.pendingRequests.values())
	}

	/**
	 * Get a decision by request ID
	 */
	getDecision(requestId: string): ApprovalDecision | undefined {
		return this.approvedRequests.get(requestId)
	}

	/**
	 * Check if a request was approved
	 */
	isApproved(requestId: string): boolean {
		const decision = this.approvedRequests.get(requestId)
		return decision?.approved === true
	}

	/**
	 * Check if approval required an override
	 */
	requiresOverride(requestId: string): boolean {
		const decision = this.approvedRequests.get(requestId)
		return decision?.requires_override === true
	}

	/**
	 * Log approval request to JSONL
	 */
	logRequest(request: ApprovalRequest): void {
		try {
			const entry = {
				...request,
				logged_at: new Date().toISOString(),
			}
			fs.appendFileSync(this.approvalLogPath, JSON.stringify(entry) + "\n")
		} catch (err) {
			console.warn("ApprovalManager: failed to log request:", err)
		}
	}

	/**
	 * Log approval decision to JSONL
	 */
	private logDecision(request: ApprovalRequest, decision: ApprovalDecision): void {
		try {
			const entry: ApprovalLogEntry = {
				...request,
				decision,
				logged_at: new Date().toISOString(),
			}
			fs.appendFileSync(this.approvalLogPath, JSON.stringify(entry) + "\n")
		} catch (err) {
			console.warn("ApprovalManager: failed to log decision:", err)
		}
	}

	/**
	 * Query approvals by intent ID
	 */
	getApprovalsByIntent(intentId: string): ApprovalLogEntry[] {
		try {
			if (!fs.existsSync(this.approvalLogPath)) return []

			const content = fs.readFileSync(this.approvalLogPath, "utf8")
			const lines = content.trim().split("\n").filter((l) => l.length > 0)

			return lines
				.map((line) => JSON.parse(line) as ApprovalLogEntry)
				.filter((entry) => entry.intent_id === intentId)
		} catch (err) {
			console.warn("ApprovalManager: failed to query by intent:", err)
			return []
		}
	}

	/**
	 * Query approvals by turn ID
	 */
	getApprovalsByTurn(turnId: string): ApprovalLogEntry[] {
		try {
			if (!fs.existsSync(this.approvalLogPath)) return []

			const content = fs.readFileSync(this.approvalLogPath, "utf8")
			const lines = content.trim().split("\n").filter((l) => l.length > 0)

			return lines
				.map((line) => JSON.parse(line) as ApprovalLogEntry)
				.filter((entry) => entry.turn_id === turnId)
		} catch (err) {
			console.warn("ApprovalManager: failed to query by turn:", err)
			return []
		}
	}

	/**
	 * Get all approval log entries
	 */
	getAllApprovals(): ApprovalLogEntry[] {
		try {
			if (!fs.existsSync(this.approvalLogPath)) return []

			const content = fs.readFileSync(this.approvalLogPath, "utf8")
			const lines = content.trim().split("\n").filter((l) => l.length > 0)

			return lines.map((line) => JSON.parse(line) as ApprovalLogEntry)
		} catch (err) {
			console.warn("ApprovalManager: failed to get all approvals:", err)
			return []
		}
	}

	/**
	 * Clear all approval logs (for testing)
	 */
	clearAllApprovals(): void {
		try {
			if (fs.existsSync(this.approvalLogPath)) {
				fs.unlinkSync(this.approvalLogPath)
			}
			this.pendingRequests.clear()
			this.approvedRequests.clear()
		} catch (err) {
			console.warn("ApprovalManager: failed to clear approvals:", err)
		}
	}
}

export const approvalManager = new ApprovalManager()
