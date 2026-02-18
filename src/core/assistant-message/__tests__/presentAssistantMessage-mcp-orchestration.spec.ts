import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../task/Task")

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

vi.mock("../../orchestration/ToolHookEngine", () => ({
	runOrchestrationPreToolHook: vi.fn(),
	runOrchestrationPostToolHook: vi.fn(),
}))

vi.mock("../../tools/UseMcpToolTool", () => ({
	useMcpToolTool: {
		handle: vi.fn(async (_task: any, _toolUse: any, callbacks: any) => {
			await callbacks.askApproval("use_mcp_server", "{}")
			callbacks.pushToolResult("mcp ok")
		}),
	},
}))

import { presentAssistantMessage } from "../presentAssistantMessage"
import { runOrchestrationPostToolHook, runOrchestrationPreToolHook } from "../../orchestration/ToolHookEngine"
import { useMcpToolTool } from "../../tools/UseMcpToolTool"

describe("presentAssistantMessage - MCP orchestration hooks", () => {
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
			recordToolUsage: vi.fn(),
			recordToolError: vi.fn(),
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			providerRef: {
				deref: () => ({
					getState: vi.fn().mockResolvedValue({
						mode: "code",
						customModes: [],
						experiments: {
							customTools: false,
						},
					}),
					getMcpHub: () => ({
						findServerNameBySanitizedName: vi.fn().mockReturnValue("figma-server"),
					}),
				}),
			},
		}

		mockTask.pushToolResultToUserContent = vi.fn().mockImplementation((toolResult: any) => {
			mockTask.userMessageContent.push(toolResult)
			return true
		})
	})

	it("blocks mcp_tool_use when orchestration prehook rejects execution", async () => {
		mockTask.assistantMessageContent = [
			{
				type: "mcp_tool_use",
				id: "tool_call_1",
				name: "mcp--figma--get_node",
				serverName: "figma",
				toolName: "get_node",
				arguments: { nodeId: "1:2" },
				partial: false,
			},
		]

		vi.mocked(runOrchestrationPreToolHook).mockResolvedValue({
			blocked: true,
			errorResult: JSON.stringify({
				status: "error",
				type: "intent_required",
				message: "Valid intent required",
			}),
		})

		await presentAssistantMessage(mockTask)

		expect(useMcpToolTool.handle).not.toHaveBeenCalled()
		expect(runOrchestrationPostToolHook).not.toHaveBeenCalled()
		expect(mockTask.userMessageContent.some((item: any) => String(item.content).includes("intent_required"))).toBe(
			true,
		)
	})

	it("runs mcp_tool_use through pre/post hooks and consumes pre-approved authorization", async () => {
		mockTask.assistantMessageContent = [
			{
				type: "mcp_tool_use",
				id: "tool_call_2",
				name: "mcp--figma--get_node",
				serverName: "figma",
				toolName: "get_node",
				arguments: { nodeId: "1:2" },
				partial: false,
			},
		]

		vi.mocked(runOrchestrationPreToolHook).mockResolvedValue({
			blocked: false,
			preApproved: true,
			context: {
				toolName: "use_mcp_tool",
				toolOrigin: "mcp_dynamic",
				agentActionName: "figma-server/get_node",
				relatedRequirementIds: [],
				targets: [],
				commandClass: "DESTRUCTIVE",
			},
		})
		vi.mocked(runOrchestrationPostToolHook).mockResolvedValue(undefined)

		await presentAssistantMessage(mockTask)

		expect(runOrchestrationPreToolHook).toHaveBeenCalledWith(
			expect.objectContaining({
				toolName: "use_mcp_tool",
				toolOrigin: "mcp_dynamic",
				mcpToolName: "get_node",
			}),
		)
		expect(useMcpToolTool.handle).toHaveBeenCalledTimes(1)
		expect(mockTask.ask).not.toHaveBeenCalled()
		expect(runOrchestrationPostToolHook).toHaveBeenCalledWith(
			expect.objectContaining({
				task: mockTask,
				toolResult: "mcp ok",
			}),
		)
	})
})
