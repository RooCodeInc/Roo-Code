// npx vitest run src/core/assistant-message/__tests__/presentAssistantMessage-validation-errors.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { presentAssistantMessage } from "../presentAssistantMessage"

// Mock validateToolUse to ensure we don't depend on its behavior for this test.
vi.mock("../../tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

describe("presentAssistantMessage - validation/missing-param handling", () => {
	let mockTask: any

	beforeEach(() => {
		mockTask = {
			taskId: "test-task-id",
			instanceId: "test-instance",
			abort: false,
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [],
			userMessageContent: [],
			didCompleteReadingStream: true,
			userMessageContentReady: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			diffEnabled: false,
			consecutiveMistakeCount: 0,
			didToolFailInCurrentTurn: false,
			clineMessages: [],
			api: {
				getModel: () => ({ id: "test-model", info: {} }),
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
					getState: vi.fn().mockResolvedValue({
						mode: "orchestrator",
						customModes: [],
					}),
				}),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("missing param"),
		}
	})

	it("treats missing codebase_search.path as missing param when read fileRegex is present (native protocol)", async () => {
		const toolCallId = "tool_call_missing_path"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "codebase_search",
				params: { query: "x" },
				partial: false,
			},
		]

		// Make orchestrator mode config discoverable via shared/modes.getModeBySlug() (built-in DEFAULT_MODES)
		await presentAssistantMessage(mockTask)

		expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("codebase_search", "path")
		const toolResult = mockTask.userMessageContent.find(
			(item: any) => item.type === "tool_result" && item.tool_use_id === toolCallId,
		)
		expect(toolResult).toBeDefined()
		expect(toolResult.is_error).toBe(true)
		expect(mockTask.userMessageContentReady).toBe(true)
	})
})
