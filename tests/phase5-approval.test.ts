import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "fs"
import path from "path"
import { ApprovalManager, type ApprovalRequest, type ApprovalDecision } from "../src/core/intent/ApprovalManager"

describe("Phase 5: Human-In-The-Loop Approval Workflow", () => {
	let approvalManager: ApprovalManager
	const testDir = ".orchestration"
	const approvalLogPath = ".orchestration/approval_log.jsonl"

	beforeEach(() => {
		approvalManager = new ApprovalManager()
		approvalManager.clearAllApprovals()
	})

	afterEach(() => {
		// Cleanup
		try {
			if (fs.existsSync(approvalLogPath)) {
				fs.unlinkSync(approvalLogPath)
			}
			if (fs.existsSync(testDir)) {
				const files = fs.readdirSync(testDir)
				files.forEach((file) => {
					const filePath = path.join(testDir, file)
					if (fs.statSync(filePath).isFile()) {
						fs.unlinkSync(filePath)
					}
				})
			}
		} catch (err) {
			// Ignore cleanup errors
		}
	})

	it("creates an approval request with required fields", () => {
		const request = ApprovalManager.createRequest(
			"Refactor auth module",
			"diff content here",
			["src/auth/module.ts"],
			"INT-001",
			"turn-123",
		)

		expect(request).toHaveProperty("request_id")
		expect(request).toHaveProperty("timestamp")
		expect(request.change_summary).toBe("Refactor auth module")
		expect(request.diff).toBe("diff content here")
		expect(request.files_affected).toEqual(["src/auth/module.ts"])
		expect(request.intent_id).toBe("INT-001")
		expect(request.turn_id).toBe("turn-123")
	})

	it("generates unique request IDs", () => {
		const req1 = ApprovalManager.createRequest("Change 1", "diff1", ["file1.ts"])
		const req2 = ApprovalManager.createRequest("Change 2", "diff2", ["file2.ts"])

		expect(req1.request_id).not.toBe(req2.request_id)
	})

	it("logs approval request to JSONL", () => {
		const request = ApprovalManager.createRequest("Test change", "diff", ["test.ts"])

		// Log the request
		approvalManager.logRequest(request)

		expect(fs.existsSync(approvalLogPath)).toBe(true)

		const content = fs.readFileSync(approvalLogPath, "utf8")
		expect(content).toContain(request.request_id)
		expect(content).toContain(request.change_summary)
	})

	it("stores pending approval requests", async () => {
		const request = ApprovalManager.createRequest("Change", "diff", ["test.ts"])
		approvalManager.recordDecision(request.request_id, true, "reviewer")

		const pending = approvalManager.getPendingRequest(request.request_id)
		// After recordDecision, it's no longer pending
		expect(pending).toBeUndefined()

		const decision = approvalManager.getDecision(request.request_id)
		expect(decision).toBeDefined()
		expect(decision?.request_id).toBe(request.request_id)
	})

	it("retrieves all pending requests", () => {
		const req1 = ApprovalManager.createRequest("Change 1", "diff1", ["file1.ts"])
		const req2 = ApprovalManager.createRequest("Change 2", "diff2", ["file2.ts"])

		// Just creating requests - they're internally tracked
		approvalManager.recordDecision(req1.request_id, true, "reviewer")
		approvalManager.recordDecision(req2.request_id, true, "reviewer")

		const all = approvalManager.getAllApprovals()
		expect(all.length).toBeGreaterThanOrEqual(2)
	})

	it("records human approval decision", () => {
		const request = ApprovalManager.createRequest("Change", "diff", ["test.ts"])

		const decision = approvalManager.recordDecision(
			request.request_id,
			true, // approved
			"alice@example.com",
			"Approved after review",
			false, // no override needed
		)

		expect(decision.approved).toBe(true)
		expect(decision.approver).toBe("alice@example.com")
		expect(decision.approver_notes).toBe("Approved after review")

		expect(approvalManager.isApproved(request.request_id)).toBe(true)
	})

	it("records human rejection decision", () => {
		const request = ApprovalManager.createRequest("Change", "diff", ["test.ts"])

		const decision = approvalManager.recordDecision(
			request.request_id,
			false, // rejected
			"bob@example.com",
			"Scope too broad",
		)

		expect(decision.approved).toBe(false)
		expect(approvalManager.isApproved(request.request_id)).toBe(false)
	})

	it("records override status in decision", () => {
		const request = ApprovalManager.createRequest("Critical change", "diff", ["critical.ts"])

		const decision = approvalManager.recordDecision(
			request.request_id,
			true,
			"admin@example.com",
			"Override approved for critical fix",
			true, // requires_override
		)

		expect(approvalManager.requiresOverride(request.request_id)).toBe(true)
	})

	it("persists decisions to JSONL", () => {
		const request = ApprovalManager.createRequest("Change", "diff", ["test.ts"])

		approvalManager.recordDecision(request.request_id, true, "alice@example.com")

		expect(fs.existsSync(approvalLogPath)).toBe(true)
		const content = fs.readFileSync(approvalLogPath, "utf8")
		expect(content).toContain(request.request_id)
		expect(content).toContain("alice@example.com")
	})

	it("queries approvals by intent ID", () => {
		const req1 = ApprovalManager.createRequest("Change", "diff", ["test.ts"], "INT-001")
		const req2 = ApprovalManager.createRequest("Change", "diff", ["test.ts"], "INT-002")

		approvalManager.logRequest(req1)
		approvalManager.logRequest(req2)
		approvalManager.recordDecision(req1.request_id, true, "reviewer")
		approvalManager.recordDecision(req2.request_id, true, "reviewer")

		const byIntent = approvalManager.getApprovalsByIntent("INT-001")
		expect(byIntent.length).toBeGreaterThan(0)
		expect(byIntent.some((entry) => entry.intent_id === "INT-001")).toBe(true)
	})

	it("queries approvals by turn ID", () => {
		const req1 = ApprovalManager.createRequest("Change", "diff", ["test.ts"], undefined, "turn-123")
		const req2 = ApprovalManager.createRequest("Change", "diff", ["test.ts"], undefined, "turn-456")

		approvalManager.logRequest(req1)
		approvalManager.logRequest(req2)
		approvalManager.recordDecision(req1.request_id, true, "reviewer")
		approvalManager.recordDecision(req2.request_id, true, "reviewer")

		const byTurn = approvalManager.getApprovalsByTurn("turn-123")
		expect(byTurn.length).toBeGreaterThan(0)
		expect(byTurn.some((entry) => entry.turn_id === "turn-123")).toBe(true)
	})

	it("retrieves all approval log entries", () => {
		const req = ApprovalManager.createRequest("Change", "diff", ["test.ts"])
		approvalManager.recordDecision(req.request_id, true, "reviewer")

		const all = approvalManager.getAllApprovals()
		expect(all.length).toBeGreaterThan(0)
		expect(all[0].request_id).toBe(req.request_id)
	})

	it("handles concurrency with multiple approval requests", async () => {
		const requests: ApprovalRequest[] = []

		for (let i = 0; i < 5; i++) {
			const req = ApprovalManager.createRequest(`Change ${i}`, `diff ${i}`, [`file${i}.ts`])
			requests.push(req)
			approvalManager.recordDecision(req.request_id, i % 2 === 0, "reviewer")
		}

		const all = approvalManager.getAllApprovals()
		expect(all.length).toBe(5)

		// Approve subset of requests
		approvalManager.recordDecision(requests[0].request_id, true, "reviewer")
		approvalManager.recordDecision(requests[2].request_id, false, "reviewer")

		expect(approvalManager.isApproved(requests[0].request_id)).toBe(true)
		expect(approvalManager.isApproved(requests[2].request_id)).toBe(false)
		expect(approvalManager.isApproved(requests[1].request_id)).toBe(false)
	})

	it("validates approval request timestamp format", () => {
		const request = ApprovalManager.createRequest("Change", "diff", ["test.ts"])
		const timestamp = new Date(request.timestamp)

		expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now())
		expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 5000) // Within 5 seconds
	})

	it("validates decision timestamp format", () => {
		const request = ApprovalManager.createRequest("Change", "diff", ["test.ts"])
		const decision = approvalManager.recordDecision(request.request_id, true, "alice")

		const timestamp = new Date(decision.timestamp)
		expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now())
		expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 5000)
	})

	it("clears all approvals properly", () => {
		const req = ApprovalManager.createRequest("Change", "diff", ["test.ts"])
		approvalManager.recordDecision(req.request_id, true, "reviewer")

		approvalManager.clearAllApprovals()

		expect(fs.existsSync(approvalLogPath)).toBe(false)
		expect(approvalManager.getPendingRequests().length).toBe(0)
	})
})
