// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage-hooks.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock dependencies that are noisy / unrelated to these tests
vi.mock("../../task/Task")
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

// Mock a tool that uses askApproval so we can exercise the PermissionRequest integration.
vi.mock("../../tools/ListFilesTool", () => ({
	listFilesTool: {
		handle: vi.fn(async (_task: any, block: any, callbacks: any) => {
			// Allow tests to trigger a failure path without real side effects.
			if (block?.params?.path === "FAIL") {
				await callbacks.handleError("listing files", new Error("boom"))
				return
			}

			const didApprove = await callbacks.askApproval("tool", `list_files:${String(block?.params?.path ?? "")}`)
			if (!didApprove) {
				return
			}
			callbacks.pushToolResult("ok")
		}),
	},
}))

let presentAssistantMessage: (task: any) => Promise<void>

describe("presentAssistantMessage - hooks integration", () => {
	let mockTask: any

	beforeEach(async () => {
		if (!presentAssistantMessage) {
			;({ presentAssistantMessage } = await import("../presentAssistantMessage"))
		}

		mockTask = {
			taskId: "test-task-id",
			instanceId: "test-instance",
			cwd: "/project",
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
			api: {
				getModel: () => ({ id: "test-model", info: {} }),
			},
			browserSession: {
				closeBrowser: vi.fn().mockResolvedValue(undefined),
			},
			recordToolUsage: vi.fn(),
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({ allowExecution: true }),
			},
			toolExecutionHooks: {
				executePermissionRequest: vi.fn().mockResolvedValue({ proceed: true, hookResult: {} }),
				executePreToolUse: vi.fn().mockResolvedValue({ proceed: true, hookResult: {} }),
				executePostToolUse: vi.fn().mockResolvedValue({ results: [], blocked: false, totalDuration: 0 }),
				executePostToolUseFailure: vi.fn().mockResolvedValue({ results: [], blocked: false, totalDuration: 0 }),
			},
			providerRef: {
				deref: () => ({
					getState: vi.fn().mockResolvedValue({
						mode: "code",
						customModes: [],
					}),
				}),
			},
			say: vi.fn().mockResolvedValue(undefined),
			// ask() is called by presentAssistantMessage via askApproval
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
		}

		mockTask.pushToolResultToUserContent = vi.fn().mockImplementation((toolResult: any) => {
			const existingResult = mockTask.userMessageContent.find(
				(block: any) => block.type === "tool_result" && block.tool_use_id === toolResult.tool_use_id,
			)
			if (existingResult) {
				return false
			}
			mockTask.userMessageContent.push(toolResult)
			return true
		})
	})

	it("PreToolUse can block execution", async () => {
		const toolCallId = "tool_call_block"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "list_files",
				params: { path: "." },
			},
		]

		mockTask.toolExecutionHooks.executePreToolUse.mockResolvedValue({
			proceed: false,
			blockReason: "nope",
			hookResult: { results: [], blocked: true, totalDuration: 1 },
		})

		await presentAssistantMessage(mockTask)

		expect(mockTask.toolExecutionHooks.executePreToolUse).toHaveBeenCalledTimes(1)
		// Should not even attempt to show approval prompt
		expect(mockTask.toolExecutionHooks.executePermissionRequest).not.toHaveBeenCalled()
		// Should emit a tool_result (native protocol) with the denial message
		const toolResult = mockTask.userMessageContent.find(
			(item: any) => item.type === "tool_result" && item.tool_use_id === toolCallId,
		)
		expect(toolResult).toBeDefined()
		expect(toolResult.content).toContain("nope")
	})

	it("PreToolUse can modify tool input", async () => {
		const toolCallId = "tool_call_modify"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "list_files",
				params: { path: "original" },
			},
		]

		mockTask.toolExecutionHooks.executePreToolUse.mockResolvedValue({
			proceed: true,
			modifiedInput: { path: "modified" },
			hookResult: { results: [], blocked: false, totalDuration: 1 },
		})

		let askedPartialMessage: string | undefined
		mockTask.ask = vi.fn().mockImplementation(async (_type: string, partialMessage?: string) => {
			askedPartialMessage = partialMessage
			return { response: "yesButtonClicked" }
		})

		await presentAssistantMessage(mockTask)

		expect(mockTask.toolExecutionHooks.executePreToolUse).toHaveBeenCalledTimes(1)
		// list_files should invoke askApproval via our mock; its message should contain the modified path.
		expect(askedPartialMessage).toContain("modified")
	})

	it("PostToolUse is invoked on success", async () => {
		const toolCallId = "tool_call_post_success"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "list_files",
				params: { path: "." },
			},
		]

		mockTask.ask = vi.fn().mockResolvedValue({ response: "yesButtonClicked" })

		await presentAssistantMessage(mockTask)

		expect(mockTask.toolExecutionHooks.executePostToolUse).toHaveBeenCalledTimes(1)
		expect(mockTask.toolExecutionHooks.executePostToolUseFailure).not.toHaveBeenCalled()
	})

	it("PostToolUseFailure is invoked on tool failure", async () => {
		const toolCallId = "tool_call_post_failure"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "list_files",
				params: { path: "FAIL" },
			},
		]

		await presentAssistantMessage(mockTask)

		expect(mockTask.toolExecutionHooks.executePostToolUseFailure).toHaveBeenCalledTimes(1)
	})

	it("PermissionRequest hook runs before approval prompt", async () => {
		const toolCallId = "tool_call_permission_request"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "list_files",
				params: { path: "." },
			},
		]

		const calls: string[] = []

		mockTask.toolExecutionHooks.executePermissionRequest = vi.fn().mockImplementation(async () => {
			calls.push("permission")
			return { proceed: true, hookResult: {} }
		})

		mockTask.ask = vi.fn().mockImplementation(async () => {
			calls.push("ask")
			return { response: "yesButtonClicked" }
		})

		await presentAssistantMessage(mockTask)

		expect(calls[0]).toBe("permission")
		expect(calls[1]).toBe("ask")
	})

	it("PermissionRequest hook can block showing approval prompt", async () => {
		const toolCallId = "tool_call_permission_block"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "list_files",
				params: { path: "." },
			},
		]

		mockTask.toolExecutionHooks.executePermissionRequest = vi.fn().mockResolvedValue({
			proceed: false,
			blockReason: "blocked by policy",
			hookResult: { results: [], blocked: true, totalDuration: 1 },
		})

		await presentAssistantMessage(mockTask)

		// ask() should never be called if hook blocks the permission prompt
		expect(mockTask.ask).not.toHaveBeenCalled()

		const toolResult = mockTask.userMessageContent.find(
			(item: any) => item.type === "tool_result" && item.tool_use_id === toolCallId,
		)
		expect(toolResult).toBeDefined()
		expect(toolResult.content).toContain("blocked by policy")
	})
})
