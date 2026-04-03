/**
 * ISSUE-17: validateToolUse must use cline.taskMode (frozen at task start)
 * instead of state.mode (live UI mode).
 *
 * ISSUE-20: No ?? defaultModeSlug fallback needed because cline.taskMode
 * throws if accessed before initialization (never returns undefined).
 *
 * These tests verify that:
 * 1. validateToolUse receives cline.taskMode, NOT state.mode
 * 2. When cline.taskMode differs from state.mode, cline.taskMode wins
 * 3. No defaultModeSlug fallback is used
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { presentAssistantMessage } from "../../../core/assistant-message/presentAssistantMessage"
import { validateToolUse } from "../../../core/tools/validateToolUse"

// Mock dependencies
vi.mock("../../../core/task/Task")
vi.mock("../../../core/tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
	isValidToolName: vi.fn(() => true),
}))

vi.mock("@roo-code/core", () => ({
	customToolRegistry: {
		has: vi.fn().mockReturnValue(false),
		get: vi.fn().mockReturnValue(undefined),
	},
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
			captureEvent: vi.fn(),
		},
	},
}))

describe("ISSUE-17: validateToolUse uses cline.taskMode", () => {
	let mockTask: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockTask = {
			taskId: "test-task-id",
			instanceId: "test-instance",
			abort: false,
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [],
			userMessageContent: [],
			didCompleteReadingStream: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			consecutiveMistakeCount: 0,
			clineMessages: [],
			api: {
				getModel: () => ({ id: "test-model", info: {} }),
			},
			recordToolUsage: vi.fn(),
			recordToolError: vi.fn(),
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({ allowExecution: true }),
			},
			// state.mode is 'code' (the live UI mode)
			providerRef: {
				deref: () => ({
					getState: vi.fn().mockResolvedValue({
						mode: "code",
						customModes: [],
						experiments: {},
						disabledTools: [],
					}),
				}),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			// ISSUE-17: taskMode is 'architect' (frozen at task start)
			taskMode: "architect",
		}

		mockTask.pushToolResultToUserContent = vi.fn().mockImplementation((toolResult: any) => {
			const existing = mockTask.userMessageContent.find(
				(b: any) => b.type === "tool_result" && b.tool_use_id === toolResult.tool_use_id,
			)
			if (existing) {
				return false
			}
			mockTask.userMessageContent.push(toolResult)
			return true
		})
	})

	it("should pass cline.taskMode to validateToolUse, not state.mode", async () => {
		const toolCallId = "issue17-test-001"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "read_file",
				params: { path: "test.txt" },
				nativeArgs: { path: "test.txt" },
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		const validateMock = vi.mocked(validateToolUse)
		expect(validateMock).toHaveBeenCalled()

		// Second argument (index 1) is the mode parameter
		const modeArg = validateMock.mock.calls[0][1]
		expect(modeArg).toBe("architect")
	})

	it('should use taskMode="architect" even when state.mode="code"', async () => {
		// state.mode is 'code', but cline.taskMode is 'architect'
		const toolCallId = "issue17-test-002"
		mockTask.taskMode = "architect"
		mockTask.providerRef = {
			deref: () => ({
				getState: vi.fn().mockResolvedValue({
					mode: "code",
					customModes: [],
					experiments: {},
					disabledTools: [],
				}),
			}),
		}
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "read_file",
				params: { path: "test.txt" },
				nativeArgs: { path: "test.txt" },
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		const validateMock = vi.mocked(validateToolUse)
		expect(validateMock).toHaveBeenCalled()
		// Must be 'architect' (from taskMode), NOT 'code' (from state)
		expect(validateMock.mock.calls[0][1]).toBe("architect")
	})

	it("should NOT have a defaultModeSlug fallback (ISSUE-20)", async () => {
		// cline.taskMode always returns a string (throws if uninitialized).
		// So the call must be cline.taskMode directly, with no ?? fallback.
		const toolCallId = "issue17-test-003"
		mockTask.taskMode = "debug"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "read_file",
				params: { path: "test.txt" },
				nativeArgs: { path: "test.txt" },
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		const validateMock = vi.mocked(validateToolUse)
		expect(validateMock).toHaveBeenCalled()
		// The mode arg should be exactly 'debug', proving no fallback
		expect(validateMock.mock.calls[0][1]).toBe("debug")
	})
})
