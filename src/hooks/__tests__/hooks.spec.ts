import * as vscode from "vscode"
import { executePreToolUseHooks } from "../middleware"
import { validateIntentForTool } from "../intent-validation-hook"
import * as intentLoader from "../intent-loader"
import * as sessionState from "../session-state"

describe("Hook middleware and validation", () => {
	afterEach(() => {
		jest.restoreAllMocks()
	})

	test("Optimistic locking blocks write when expected hash mismatches disk", async () => {
		const diskContent = "original disk content"
		// mock fs.readFile
		jest.spyOn(vscode.workspace.fs, "readFile" as any).mockResolvedValue(Buffer.from(diskContent))

		const params = { path: "src/foo.ts", expected_content_hash: "deadbeef" }
		const toolUse: any = { name: "write_to_file" }
		const mockTask: any = { cwd: process.cwd(), taskId: "task-1" }

		const result = await executePreToolUseHooks(mockTask, toolUse, params)

		expect(result.continue).toBe(false)
		expect(typeof result.reason).toBe("string")
		expect(result.reason).toContain("OPTIMISTIC_LOCK_FAIL")
	})

	test("Scope enforcement blocks out-of-scope write", async () => {
		// Prepare context
		const mockTask: any = { cwd: process.cwd(), taskId: "task-2", getActiveIntentId: () => "INT-123" }
		const toolUse: any = { name: "write_to_file" }
		const params = { path: "src/utils/helper.ts" }

		// Mock session state to return same active intent
		jest.spyOn(sessionState, "getSessionIntent" as any).mockResolvedValue("INT-123")

		// Mock findIntentById to return intent with owned_scope that doesn't include utils
		const intent = {
			id: "INT-123",
			name: "Test Intent",
			status: "active",
			owned_scope: ["src/auth/**"],
		}
		jest.spyOn(intentLoader, "findIntentById" as any).mockResolvedValue(intent)

		const context: any = {
			task: mockTask,
			toolUse,
			params,
			timestamp: Date.now(),
			cwd: mockTask.cwd,
		}

		const result = await validateIntentForTool(context)

		expect(result.continue).toBe(false)
		expect(result.reason).toContain("Scope Violation")
	})

	test("HITL rejection returns structured HITL_REJECTED error", async () => {
		// Spy on requestHITLAuthorization exported from middleware
		const mw = await import("../middleware")
		jest.spyOn(mw, "requestHITLAuthorization" as any).mockResolvedValue(false)

		// Ensure classifyToolSafety treats execute_command as DESTRUCTIVE
		jest.spyOn(await import("../security"), "classifyToolSafety" as any).mockReturnValue("DESTRUCTIVE")

		const mockTask: any = { cwd: process.cwd(), taskId: "task-3" }
		const toolUse: any = { name: "execute_command" }
		const params = { command: "rm -rf /tmp/something" }

		const result = await executePreToolUseHooks(mockTask, toolUse, params)

		expect(result.continue).toBe(false)
		expect(result.reason).toContain("HITL_REJECTED")
	})
})
