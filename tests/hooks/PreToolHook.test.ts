// npx vitest run tests/hooks/PreToolHook.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { PreToolHook } from "../../src/hooks/PreToolHook"
import { IntentManager } from "../../src/hooks/IntentManager"
import { HookEngine } from "../../src/hooks/HookEngine"
import type { ToolExecutionContext, PreHookResult } from "../../specs/001-intent-hook-middleware/contracts/hook-engine"
import type { ActiveIntent } from "../../src/hooks/types"

vi.mock("../../src/hooks/IntentManager")

describe("PreToolHook", () => {
	let preToolHook: PreToolHook
	let mockIntentManager: vi.Mocked<IntentManager>
	let mockHookEngine: HookEngine

	const destructiveTools = ["write_to_file", "execute_command", "edit_file", "search_replace"]

	beforeEach(() => {
		mockIntentManager = {
			getActiveIntent: vi.fn().mockResolvedValue(null),
			getIntent: vi.fn().mockResolvedValue(null),
		} as unknown as vi.Mocked<IntentManager>

		mockHookEngine = new HookEngine()
		preToolHook = new PreToolHook(mockIntentManager)
		mockHookEngine.registerPreHook((context) => preToolHook.run(context))

		vi.clearAllMocks()
	})

	describe("run", () => {
		it("should allow non-destructive tools without active intent", async () => {
			const context: ToolExecutionContext = {
				toolName: "read_file",
				toolParams: { path: "test.ts" },
				taskId: "task-123",
				workspacePath: "/workspace",
			}

			const result = await preToolHook.run(context)

			expect(result.allowed).toBe(true)
			expect(mockIntentManager.getActiveIntent).not.toHaveBeenCalled()
		})

		it("should block destructive tools without active intent", async () => {
			for (const toolName of destructiveTools) {
				const context: ToolExecutionContext = {
					toolName,
					toolParams: { path: "test.ts", content: "test" },
					taskId: "task-123",
					workspacePath: "/workspace",
				}

				const result = await preToolHook.run(context)

				expect(result.allowed).toBe(false)
				expect(result.error).toContain("active intent")
			}
		})

		it("should allow destructive tools with active intent", async () => {
			const mockIntent: ActiveIntent = {
				id: "INT-001",
				name: "Feature A",
				description: "Implement feature A",
				status: "IN_PROGRESS",
				ownedScope: ["src/features/a/**"],
				constraints: [],
				acceptanceCriteria: [],
			}

			mockIntentManager.getActiveIntent.mockResolvedValue(mockIntent)

			const context: ToolExecutionContext = {
				toolName: "write_to_file",
				toolParams: { path: "src/features/a/test.ts", content: "test" },
				taskId: "task-123",
				workspacePath: "/workspace",
				activeIntentId: "INT-001",
			}

			const result = await preToolHook.run(context)

			expect(result.allowed).toBe(true)
			expect(mockIntentManager.getActiveIntent).toHaveBeenCalledWith("task-123")
		})

		it("should provide clear error message when intent is missing", async () => {
			const context: ToolExecutionContext = {
				toolName: "write_to_file",
				toolParams: { path: "test.ts", content: "test" },
				taskId: "task-123",
				workspacePath: "/workspace",
			}

			const result = await preToolHook.run(context)

			expect(result.allowed).toBe(false)
			expect(result.error).toContain("select_active_intent")
			expect(result.error).toContain("write_to_file")
		})
	})
})
