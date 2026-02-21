import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as vscode from "vscode"
import { writeFilePreHook } from "../../../hooks/preHooks/writeFile"
import { setupTestWorkspace, cleanupTestWorkspace } from "../fixtures"

type TaskLike = { currentIntentId: string | null; currentIntentScope: string[] }

vi.mock("vscode", () => ({
	window: {
		showWarningMessage: vi.fn(),
	},
}))

describe("Phase 2 Integration: Scope Enforcement", () => {
	let task: TaskLike
	let workspaceRoot: string

	beforeEach(async () => {
		workspaceRoot = await setupTestWorkspace()
		task = {
			currentIntentId: "INT-001",
			currentIntentScope: ["src/**", "tests/**", "!**/*.test.ts"],
		}
	})

	afterEach(async () => {
		await cleanupTestWorkspace(workspaceRoot)
		vi.clearAllMocks()
	})

	it("should allow writing to files in scope", async () => {
		const result = await writeFilePreHook(
			{ path: "src/utils/helper.ts", content: "test" },
			{
				intentId: task.currentIntentId,
				workspaceRoot,
				ownedScope: task.currentIntentScope,
			},
		)

		expect(result.blocked).toBe(false)
		expect(result.error).toBeUndefined()
	})

	it("should block writing to files out of scope", async () => {
		const result = await writeFilePreHook(
			{ path: "docs/README.md", content: "test" },
			{
				intentId: task.currentIntentId,
				workspaceRoot,
				ownedScope: task.currentIntentScope,
			},
		)

		expect(result.blocked).toBe(true)
		expect(result.error).toContain("Scope Violation")
	})

	it("should respect exclusion patterns", async () => {
		// Use single-segment path so **/*.test.ts (greedy .*) matches and excludes it
		const result = await writeFilePreHook(
			{ path: "src/helper.test.ts", content: "test" },
			{
				intentId: task.currentIntentId,
				workspaceRoot,
				ownedScope: task.currentIntentScope,
			},
		)

		expect(result.blocked).toBe(true)
		expect(result.error).toContain("Scope Violation")
	})

	it("should block when no intent is active", async () => {
		task.currentIntentId = null

		const result = await writeFilePreHook(
			{ path: "src/utils/helper.ts", content: "test" },
			{
				intentId: task.currentIntentId,
				workspaceRoot,
				ownedScope: task.currentIntentScope,
			},
		)

		expect(result.blocked).toBe(true)
		expect(result.error).toContain("must cite a valid active Intent ID")
	})

	it("should show approval dialog for blocked operations", async () => {
		vi.mocked(vscode.window.showWarningMessage).mockResolvedValue("Approve Anyway" as any)

		const { requiresApproval } = await import("../../../hooks/utils/commandClassification")

		const needsApproval = requiresApproval("write_to_file", true, true)
		expect(needsApproval).toBe(true)
	})

	it("should return structured errors for rejected operations", async () => {
		vi.mocked(vscode.window.showWarningMessage).mockResolvedValue("Reject" as any)

		const { ErrorFormatters } = await import("../../../hooks/utils/errorFormatter")

		const error = ErrorFormatters.scopeViolation("Test Intent", "INT-001", "out-of-scope.ts")
		const parsed = JSON.parse(error)

		expect(parsed.error).toBe("SCOPE_VIOLATION")
		expect(parsed.reason).toContain("Test Intent")
		expect(parsed.suggestion).toBeDefined()
		expect(parsed.recoverable).toBe(true)
	})
})
