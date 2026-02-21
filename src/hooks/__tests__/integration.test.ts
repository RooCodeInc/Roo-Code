/**
 * Integration tests for Pre/Post Hook execution in tool workflow.
 * Tests verify that hooks properly intercept tool calls and enforce intent boundaries.
 */

import { describe, test, expect, vi, beforeEach } from "vitest"
import { executePreToolUseHooks, executePostToolUseHooks } from "../middleware"
import type { Task } from "../../task/Task"
import type { ToolUse } from "@roo-code/types"

// Mock Task instance
function createMockTask(): Task {
	return {
		cwd: "/test/workspace",
		taskId: "test-task-123",
		say: vi.fn(),
	} as unknown as Task
}

describe("Hook Integration Tests", () => {
	let mockTask: Task

	beforeEach(() => {
		mockTask = createMockTask()
	})

	describe("PreHook: Intent Validation", () => {
		test("blocks write_file without intent_id", async () => {
			const toolUse: ToolUse<"write_to_file"> = {
				type: "tool_use",
				id: "test-1",
				name: "write_to_file",
				params: {
					path: "src/test.ts",
					content: "console.log('test')",
					// NO intent_id - should be blocked
				},
			}

			const result = await executePreToolUseHooks(mockTask, toolUse, toolUse.params)

			expect(result.continue).toBe(false)
			expect(result.reason).toContain("intent")
		})

		test("blocks write_file with intent_id outside owned_scope", async () => {
			const toolUse: ToolUse<"write_to_file"> = {
				type: "tool_use",
				id: "test-2",
				name: "write_to_file",
				params: {
					path: "src/unrelated/file.ts", // Outside INT-001 scope (src/auth/**)
					content: "// code",
					intent_id: "INT-001",
				},
			}

			const result = await executePreToolUseHooks(mockTask, toolUse, toolUse.params)

			expect(result.continue).toBe(false)
			expect(result.reason).toContain("scope")
		})

		test("allows write_file with valid intent_id within owned_scope", async () => {
			const toolUse: ToolUse<"write_to_file"> = {
				type: "tool_use",
				id: "test-3",
				name: "write_to_file",
				params: {
					path: "src/auth/middleware.ts", // Within INT-001 scope
					content: "// auth code",
					intent_id: "INT-001",
				},
			}

			const result = await executePreToolUseHooks(mockTask, toolUse, toolUse.params)

			expect(result.continue).toBe(true)
		})

		test("classifies dangerous execute_command as high risk", async () => {
			const toolUse: ToolUse<"execute_command"> = {
				type: "tool_use",
				id: "test-4",
				name: "execute_command",
				params: {
					command: "rm -rf /",
				},
			}

			const result = await executePreToolUseHooks(mockTask, toolUse, toolUse.params)

			// Should require HITL approval
			expect(result.continue).toBe(false)
			expect(result.reason?.toLowerCase()).toMatch(/dangerous|risk|approval/)
		})
	})

	describe("PostHook: Trace Logging", () => {
		test("logs trace record after successful write_file", async () => {
			const toolUse: ToolUse<"write_to_file"> = {
				type: "tool_use",
				id: "test-5",
				name: "write_to_file",
				params: {
					path: "src/auth/jwt.ts",
					content: "export const verifyToken = () => {}",
					intent_id: "INT-001",
				},
			}

			const result = { success: true }
			const startTime = Date.now()

			// PostHook should not throw
			await expect(
				executePostToolUseHooks(mockTask, toolUse, toolUse.params, result, true, undefined, startTime),
			).resolves.not.toThrow()

			// Verify trace was written (check .orchestration/agent_trace.jsonl in e2e tests)
		})
	})
})
