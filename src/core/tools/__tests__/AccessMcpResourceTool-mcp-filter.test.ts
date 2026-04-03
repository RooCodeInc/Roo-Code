// npx vitest run core/tools/__tests__/AccessMcpResourceTool-mcp-filter.test.ts

import { accessMcpResourceTool } from "../accessMcpResourceTool"
import { Task } from "../../task/Task"

// Mock mcp-filter functions
vi.mock("../../../utils/mcp-filter", () => ({
	isMcpServerAllowedForMode: vi.fn().mockReturnValue(true),
	isMcpToolAllowedForMode: vi.fn().mockReturnValue(true),
}))

import { isMcpServerAllowedForMode } from "../../../utils/mcp-filter"

// Mock formatResponse
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolResult: vi.fn((result: string) => "Tool result: " + result),
		toolError: vi.fn((error: string) => "Tool error: " + error),
		toolDenied: vi.fn(() => "Tool denied"),
	},
}))

describe("AccessMcpResourceTool - MCP filter defense-in-depth", () => {
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
					readResource: vi.fn().mockResolvedValue({
						contents: [{ text: "resource content" }],
					}),
				}),
			}),
		}

		mockTask = {
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
			say: vi.fn(),
			ask: vi.fn(),
			providerRef: mockProviderRef,
			taskMode: "code",
		}

		vi.mocked(isMcpServerAllowedForMode).mockReturnValue(true)
	})

	it("should proceed when server is allowed", async () => {
		vi.mocked(isMcpServerAllowedForMode).mockReturnValue(true)

		await accessMcpResourceTool.execute(
			{
				server_name: "test-server",
				uri: "test://resource",
			},
			mockTask as Task,
			{
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			},
		)

		// Should have proceeded to approval
		expect(mockAskApproval).toHaveBeenCalled()
	})

	it("should block execution when server is disabled", async () => {
		vi.mocked(isMcpServerAllowedForMode).mockReturnValue(false)

		await accessMcpResourceTool.execute(
			{
				server_name: "blocked-server",
				uri: "test://resource",
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

	it("should use task.taskMode for the mode check", async () => {
		Object.defineProperty(mockTask, "taskMode", {
			get: () => "architect",
			configurable: true,
		})
		vi.mocked(isMcpServerAllowedForMode).mockReturnValue(true)

		await accessMcpResourceTool.execute(
			{
				server_name: "test-server",
				uri: "test://resource",
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
