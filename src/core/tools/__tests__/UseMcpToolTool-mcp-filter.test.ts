// npx vitest run core/tools/__tests__/UseMcpToolTool-mcp-filter.test.ts

import { useMcpToolTool } from "../UseMcpToolTool"
import { Task } from "../../task/Task"

// Mock mcp-filter functions
vi.mock("../../../utils/mcp-filter", () => ({
	isMcpServerAllowedForMode: vi.fn().mockReturnValue(true),
	isMcpToolAllowedForMode: vi.fn().mockReturnValue(true),
}))

import { isMcpServerAllowedForMode, isMcpToolAllowedForMode } from "../../../utils/mcp-filter"

// Mock formatResponse
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolResult: vi.fn((result: string) => "Tool result: " + result),
		toolError: vi.fn((error: string) => "Tool error: " + error),
		toolDenied: vi.fn(() => "Tool denied"),
		invalidMcpToolArgumentError: vi.fn((server: string, tool: string) => "Invalid args for " + server + ":" + tool),
		unknownMcpToolError: vi.fn(
			(server: string, tool: string, available: string[]) => "Tool '" + tool + "' not found on '" + server + "'",
		),
		unknownMcpServerError: vi.fn((server: string, available: string[]) => "Server '" + server + "' not configured"),
	},
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
}))

describe("UseMcpToolTool - MCP filter defense-in-depth", () => {
	let mockTask: Partial<Task>
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockProviderRef: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()

		mockProviderRef = {
			deref: vi.fn().mockReturnValue({
				customModesManager: {
					getCustomModes: vi.fn().mockResolvedValue([]),
				},
				getMcpHub: vi.fn().mockReturnValue({
					callTool: vi.fn().mockResolvedValue({
						content: [{ type: "text", text: "result" }],
						isError: false,
					}),
					getAllServers: vi.fn().mockReturnValue([
						{
							name: "test-server",
							tools: [{ name: "test-tool", enabledForPrompt: true }],
						},
					]),
				}),
				postMessageToWebview: vi.fn(),
			}),
		}

		mockTask = {
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
			say: vi.fn(),
			ask: vi.fn(),
			lastMessageTs: 123456789,
			providerRef: mockProviderRef,
			taskMode: "code",
			didToolFailInCurrentTurn: false,
		}

		// Default: allow everything
		vi.mocked(isMcpServerAllowedForMode).mockReturnValue(true)
		vi.mocked(isMcpToolAllowedForMode).mockReturnValue(true)
	})

	it("should proceed when server is allowed", async () => {
		vi.mocked(isMcpServerAllowedForMode).mockReturnValue(true)
		vi.mocked(isMcpToolAllowedForMode).mockReturnValue(true)

		await useMcpToolTool.execute(
			{
				server_name: "test-server",
				tool_name: "test-tool",
				arguments: { key: "value" },
			},
			mockTask as Task,
			{
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			},
		)

		// Should NOT have been blocked — askApproval should have been called
		expect(mockAskApproval).toHaveBeenCalled()
	})

	it("should block execution when server is disabled", async () => {
		vi.mocked(isMcpServerAllowedForMode).mockReturnValue(false)

		await useMcpToolTool.execute(
			{
				server_name: "blocked-server",
				tool_name: "some-tool",
				arguments: {},
			},
			mockTask as Task,
			{
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			},
		)

		// Should NOT proceed to approval
		expect(mockAskApproval).not.toHaveBeenCalled()
		// Should push an error result containing the server name
		expect(mockPushToolResult).toHaveBeenCalled()
		const pushArg = mockPushToolResult.mock.calls[0][0] as string
		expect(pushArg).toContain("not allowed")
		expect(pushArg).toContain("blocked-server")
	})

	it("should block execution when tool is in disabledTools", async () => {
		vi.mocked(isMcpServerAllowedForMode).mockReturnValue(true)
		vi.mocked(isMcpToolAllowedForMode).mockReturnValue(false)

		await useMcpToolTool.execute(
			{
				server_name: "test-server",
				tool_name: "disabled-tool",
				arguments: {},
			},
			mockTask as Task,
			{
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			},
		)

		// Should NOT proceed to approval
		expect(mockAskApproval).not.toHaveBeenCalled()
		// Should push an error result containing the tool name
		expect(mockPushToolResult).toHaveBeenCalled()
		const pushArg = mockPushToolResult.mock.calls[0][0] as string
		expect(pushArg).toContain("not allowed")
		expect(pushArg).toContain("disabled-tool")
	})

	it("should use task.taskMode for the mode check", async () => {
		// Set a specific mode
		Object.defineProperty(mockTask, "taskMode", {
			get: () => "architect",
			configurable: true,
		})
		vi.mocked(isMcpServerAllowedForMode).mockReturnValue(true)
		vi.mocked(isMcpToolAllowedForMode).mockReturnValue(true)

		await useMcpToolTool.execute(
			{
				server_name: "test-server",
				tool_name: "test-tool",
				arguments: {},
			},
			mockTask as Task,
			{
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			},
		)

		expect(isMcpServerAllowedForMode).toHaveBeenCalledWith("test-server", "architect", expect.anything())
	})
})
