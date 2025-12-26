// npx vitest run core/assistant-message/__tests__/presentAssistantMessage-tool-usage-variants.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("../../tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
			captureException: vi.fn(),
		},
	},
}))

const { mockEditToolHandle } = vi.hoisted(() => ({
	mockEditToolHandle: vi.fn(async (_task: unknown, _toolUse: unknown, callbacks: any) => {
		callbacks.pushToolResult("ok")
	}),
}))

vi.mock("../../tools/EditFileRooTool", () => ({
	editFileRooTool: { handle: mockEditToolHandle },
}))

vi.mock("../../tools/EditFileAnthropicTool", () => ({
	editFileAnthropicTool: { handle: mockEditToolHandle },
}))

vi.mock("../../tools/EditFileGrokTool", () => ({
	editFileGrokTool: { handle: mockEditToolHandle },
}))

vi.mock("../../tools/EditFileGeminiTool", () => ({
	editFileGeminiTool: { handle: mockEditToolHandle },
}))

vi.mock("../../tools/EditFileCodexTool", () => ({
	editFileCodexTool: { handle: mockEditToolHandle },
}))

// Import AFTER mocks
import { TelemetryService } from "@roo-code/telemetry"
import { presentAssistantMessage } from "../presentAssistantMessage"

describe("presentAssistantMessage - tool usage analytics names", () => {
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
			diffEnabled: false,
			consecutiveMistakeCount: 0,
			consecutiveMistakeLimit: 3,
			clineMessages: [],
			currentStreamingDidCheckpoint: false,
			checkpointSave: vi.fn().mockResolvedValue(undefined),
			apiConfiguration: { apiProvider: "openai" },
			api: {
				getModel: () => ({ id: "test-model", info: { editToolVariant: "roo" } }),
			},
			browserSession: {
				closeBrowser: vi.fn().mockResolvedValue(undefined),
			},
			recordToolUsage: vi.fn(),
			recordToolError: vi.fn(),
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({ allowExecution: true }),
			},
			providerRef: {
				deref: () => ({
					getState: vi.fn().mockResolvedValue({ mode: "code", customModes: [], experiments: {} }),
				}),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
		}
	})

	it.each([
		["roo", "edit_file_roo"],
		["anthropic", "edit_file_anthropic"],
		["grok", "edit_file_grok"],
		["gemini", "edit_file_gemini"],
		["codex", "edit_file_codex"],
	] as const)("records derived analytics tool name for edit_file (%s)", async (variant, expected) => {
		mockTask.api.getModel = () => ({ id: "test-model", info: { editToolVariant: variant } })

		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_call_123",
				name: "edit_file",
				params: { path: "file.txt" },
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		expect(mockTask.recordToolUsage).toHaveBeenCalledWith(expected)
		expect(TelemetryService.instance.captureToolUsage).toHaveBeenCalledWith(
			mockTask.taskId,
			expected,
			expect.any(String),
		)
	})

	it("does not change other tool names", async () => {
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_call_456",
				name: "read_file",
				params: { path: "file.txt" },
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		expect(mockTask.recordToolUsage).toHaveBeenCalledWith("read_file")
		expect(TelemetryService.instance.captureToolUsage).toHaveBeenCalledWith(
			mockTask.taskId,
			"read_file",
			expect.any(String),
		)
	})
})
