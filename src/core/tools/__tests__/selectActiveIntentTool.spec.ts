import { describe, it, expect, vi, beforeEach } from "vitest"
import { selectActiveIntentTool } from "../SelectActiveIntentTool"
import { ToolUse } from "../../../shared/tools"
import * as activeIntents from "../../context/activeIntents"

// Mock the activeIntents module
vi.mock("../../context/activeIntents", async () => {
	const actual = await vi.importActual("../../context/activeIntents")
	return {
		...actual,
		isGovernedWorkspace: vi.fn(),
		loadActiveIntents: vi.fn(),
	}
})

const mockIsGoverned = activeIntents.isGovernedWorkspace as ReturnType<typeof vi.fn>
const mockLoadIntents = activeIntents.loadActiveIntents as ReturnType<typeof vi.fn>

describe("selectActiveIntentTool", () => {
	let mockTask: any
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let toolResult: any

	const SAMPLE_INTENTS: activeIntents.ActiveIntent[] = [
		{
			id: "refactor-auth",
			goal: "Refactor the authentication module",
			status: "IN_PROGRESS",
			constraints: ["Must maintain backward compatibility"],
			scope: ["src/auth/**"],
		},
		{
			id: "add-logging",
			goal: "Add structured logging",
			status: "COMPLETED",
			constraints: [],
			scope: ["src/**"],
		},
		{
			id: "fix-bug",
			goal: "Fix a critical bug",
			status: "IN_PROGRESS",
			constraints: [],
			scope: ["src/core/**"],
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()

		mockTask = {
			cwd: "/test/workspace",
			consecutiveMistakeCount: 0,
			activeIntentId: undefined,
			activeIntentContext: undefined,
			intentTraceLog: [],
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
		}

		toolResult = undefined
		mockPushToolResult = vi.fn((result) => {
			toolResult = result
		})
		mockHandleError = vi.fn()
	})

	it("should handle missing intent_id parameter", async () => {
		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: {},
			nativeArgs: { intent_id: "" },
			partial: false,
		}

		await selectActiveIntentTool.handle(mockTask, block, {
			askApproval: vi.fn(),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(mockTask.activeIntentId).toBeUndefined()
	})

	it("should error when workspace is not governed", async () => {
		mockIsGoverned.mockReturnValue(false)

		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: {},
			nativeArgs: { intent_id: "some-intent" },
			partial: false,
		}

		await selectActiveIntentTool.handle(mockTask, block, {
			askApproval: vi.fn(),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(toolResult).toContain("not governed")
		expect(mockTask.activeIntentId).toBeUndefined()
	})

	it("should error when YAML has no intents", async () => {
		mockIsGoverned.mockReturnValue(true)
		mockLoadIntents.mockResolvedValue([])

		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: {},
			nativeArgs: { intent_id: "some-intent" },
			partial: false,
		}

		await selectActiveIntentTool.handle(mockTask, block, {
			askApproval: vi.fn(),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(toolResult).toContain("no valid intents")
		expect(mockTask.activeIntentId).toBeUndefined()
	})

	it("should error when intent_id is not found in YAML", async () => {
		mockIsGoverned.mockReturnValue(true)
		mockLoadIntents.mockResolvedValue(SAMPLE_INTENTS)

		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: {},
			nativeArgs: { intent_id: "nonexistent" },
			partial: false,
		}

		await selectActiveIntentTool.handle(mockTask, block, {
			askApproval: vi.fn(),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(toolResult).toContain("not found")
		expect(toolResult).toContain("refactor-auth")
		expect(toolResult).toContain("add-logging")
		expect(toolResult).toContain("fix-bug")
		expect(mockTask.activeIntentId).toBeUndefined()
	})

	it("should error when intent is not IN_PROGRESS", async () => {
		mockIsGoverned.mockReturnValue(true)
		mockLoadIntents.mockResolvedValue(SAMPLE_INTENTS)

		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: {},
			nativeArgs: { intent_id: "add-logging" },
			partial: false,
		}

		await selectActiveIntentTool.handle(mockTask, block, {
			askApproval: vi.fn(),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(toolResult).toContain("COMPLETED")
		expect(toolResult).toContain("IN_PROGRESS")
		expect(toolResult).toContain("refactor-auth")
		expect(toolResult).toContain("fix-bug")
		expect(mockTask.activeIntentId).toBeUndefined()
	})

	it("should succeed with valid IN_PROGRESS intent", async () => {
		mockIsGoverned.mockReturnValue(true)
		mockLoadIntents.mockResolvedValue(SAMPLE_INTENTS)

		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: {},
			nativeArgs: { intent_id: "refactor-auth" },
			partial: false,
		}

		await selectActiveIntentTool.handle(mockTask, block, {
			askApproval: vi.fn(),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		expect(mockTask.consecutiveMistakeCount).toBe(0)
		expect(mockTask.activeIntentId).toBe("refactor-auth")
		expect(mockTask.activeIntentContext).toBeDefined()
		expect(toolResult).toContain("<intent_context>")
		expect(toolResult).toContain("<intent_id>refactor-auth</intent_id>")
		expect(toolResult).toContain("<goal>Refactor the authentication module</goal>")
		expect(toolResult).toContain("<status>IN_PROGRESS</status>")
		expect(toolResult).toContain("Must maintain backward compatibility")
		expect(toolResult).toContain("src/auth/**")
	})

	it("should store intent context on task for pre-hook injection", async () => {
		mockIsGoverned.mockReturnValue(true)
		mockLoadIntents.mockResolvedValue(SAMPLE_INTENTS)

		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: {},
			nativeArgs: { intent_id: "refactor-auth" },
			partial: false,
		}

		await selectActiveIntentTool.handle(mockTask, block, {
			askApproval: vi.fn(),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		// activeIntentContext should be stored on task (for system prompt injection)
		expect(mockTask.activeIntentContext).toContain("<intent_context>")
		expect(mockTask.activeIntentContext).toContain("refactor-auth")
		// The tool result should match the stored context
		expect(toolResult).toBe(mockTask.activeIntentContext)
	})

	it("should include trace entries in context when prior activity exists", async () => {
		mockIsGoverned.mockReturnValue(true)
		mockLoadIntents.mockResolvedValue(SAMPLE_INTENTS)

		// Pre-populate trace log with events for this intent
		mockTask.intentTraceLog = [
			{
				toolName: "write_to_file",
				summary: "write_to_file executed successfully",
				outcome: "success",
				timestamp: "2026-02-18T14:00:00Z",
				intentId: "refactor-auth",
			},
			{
				toolName: "execute_command",
				summary: "execute_command failed: permission denied",
				outcome: "error",
				timestamp: "2026-02-18T14:01:00Z",
				intentId: "refactor-auth",
			},
			{
				// Different intent — should be excluded
				toolName: "read_file",
				summary: "read_file executed successfully",
				outcome: "success",
				timestamp: "2026-02-18T14:02:00Z",
				intentId: "other-intent",
			},
		]

		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: {},
			nativeArgs: { intent_id: "refactor-auth" },
			partial: false,
		}

		await selectActiveIntentTool.handle(mockTask, block, {
			askApproval: vi.fn(),
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		// Should include trace section with the 2 matching events
		expect(toolResult).toContain("<trace>")
		expect(toolResult).toContain('tool="write_to_file"')
		expect(toolResult).toContain('tool="execute_command"')
		// Should NOT include the other-intent event
		expect(toolResult).not.toContain('tool="read_file"')
	})
})
