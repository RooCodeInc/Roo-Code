// npx vitest core/tools/__tests__/useMcpToolTool.spec.ts

import { useMcpToolTool } from "../UseMcpToolTool"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"
import * as fs from "fs/promises"

// Mock fs/promises
vi.mock("fs/promises", () => ({
	stat: vi.fn(),
	readFile: vi.fn(),
}))

// Import the actual module to get the mock
import { readImageAsDataUrlWithBuffer } from "../helpers/imageHelpers"

// Mock image helpers
vi.mock("../helpers/imageHelpers", () => ({
	readImageAsDataUrlWithBuffer: vi.fn(),
	isSupportedImageFormat: vi.fn((ext: string) => {
		const supportedFormats = [".png", ".jpg", ".jpeg", ".gif", ".webp"]
		return supportedFormats.includes(ext.toLowerCase())
	}),
}))

// Mock dependencies
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolResult: vi.fn((result: string) => `Tool result: ${result}`),
		toolError: vi.fn((error: string) => `Tool error: ${error}`),
		invalidMcpToolArgumentError: vi.fn((server: string, tool: string) => `Invalid args for ${server}:${tool}`),
		unknownMcpToolError: vi.fn((server: string, tool: string, availableTools: string[]) => {
			const toolsList = availableTools.length > 0 ? availableTools.join(", ") : "No tools available"
			return `Tool '${tool}' does not exist on server '${server}'. Available tools: ${toolsList}`
		}),
		unknownMcpServerError: vi.fn((server: string, availableServers: string[]) => {
			const list = availableServers.length > 0 ? availableServers.join(", ") : "No servers available"
			return `Server '${server}' is not configured. Available servers: ${list}`
		}),
	},
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string, params?: any) => {
		if (key === "mcp:errors.invalidJsonArgument" && params?.toolName) {
			return `Roo tried to use ${params.toolName} with an invalid JSON argument. Retrying...`
		}
		if (key === "mcp:errors.toolNotFound" && params) {
			return `Tool '${params.toolName}' does not exist on server '${params.serverName}'. Available tools: ${params.availableTools}`
		}
		if (key === "mcp:errors.serverNotFound" && params) {
			return `MCP server '${params.serverName}' is not configured. Available servers: ${params.availableServers}`
		}
		return key
	}),
}))

describe("useMcpToolTool", () => {
	let mockTask: Partial<Task>
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>
	let mockProviderRef: any

	beforeEach(() => {
		mockAskApproval = vi.fn()
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag: string, value?: string) => value || "")

		mockProviderRef = {
			deref: vi.fn().mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue({
					callTool: vi.fn(),
					getAllServers: vi.fn().mockReturnValue([]),
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
		}
	})

	describe("parameter validation", () => {
		it("should handle missing server_name", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					tool_name: "test_tool",
					arguments: "{}",
				},
				partial: false,
			}

			mockTask.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing server_name error")

			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("use_mcp_tool")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("use_mcp_tool", "server_name")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing server_name error")
		})

		it("should handle missing tool_name", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					arguments: "{}",
				},
				partial: false,
			}

			mockTask.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing tool_name error")

			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("use_mcp_tool")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("use_mcp_tool", "tool_name")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing tool_name error")
		})

		it("should handle invalid JSON arguments", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: "invalid json",
				},
				partial: false,
			}

			// Mock server exists so we get to the JSON validation step
			const mockServers = [
				{
					name: "test_server",
					tools: [{ name: "test_tool", description: "Test Tool" }],
				},
			]

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi.fn().mockReturnValue(mockServers),
					callTool: vi.fn(),
				}),
				postMessageToWebview: vi.fn(),
			})

			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("use_mcp_tool")
			expect(mockTask.say).toHaveBeenCalledWith("error", expect.stringContaining("invalid JSON argument"))
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool error: Invalid args for test_server:test_tool")
		})
	})

	describe("partial requests", () => {
		it("should handle partial requests", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: "{}",
				},
				partial: true,
			}

			mockTask.ask = vi.fn().mockResolvedValue(true)

			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.ask).toHaveBeenCalledWith("use_mcp_server", expect.stringContaining("use_mcp_tool"), true)
		})
	})

	describe("successful execution", () => {
		it("should execute tool successfully with valid parameters", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			const mockToolResult = {
				content: [{ type: "text", text: "Tool executed successfully" }],
				isError: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
			})

			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_request_started")
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_response", "Tool executed successfully")
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result: Tool executed successfully")
		})

		it("should handle user rejection", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: "{}",
				},
				partial: false,
			}

			// Ensure validation does not fail due to unknown server by returning no provider once
			// This makes validateToolExists return isValid: true and proceed to askApproval
			mockProviderRef.deref.mockReturnValueOnce(undefined as any)

			mockAskApproval.mockResolvedValue(false)

			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.say).not.toHaveBeenCalledWith("mcp_server_request_started")
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})
	})

	describe("error handling", () => {
		it("should handle unexpected errors", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
				},
				partial: false,
			}

			// Ensure validation passes so askApproval is reached and throws
			mockProviderRef.deref.mockReturnValueOnce({
				getMcpHub: () => ({
					getAllServers: vi
						.fn()
						.mockReturnValue([
							{ name: "test_server", tools: [{ name: "test_tool", description: "desc" }] },
						]),
					callTool: vi.fn(),
				}),
				postMessageToWebview: vi.fn(),
			})

			const error = new Error("Unexpected error")
			mockAskApproval.mockRejectedValue(error)

			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockHandleError).toHaveBeenCalledWith("executing MCP tool", error)
		})

		it("should reject unknown tool names", async () => {
			// Reset consecutiveMistakeCount for this test
			mockTask.consecutiveMistakeCount = 0

			const mockServers = [
				{
					name: "test-server",
					tools: [
						{ name: "existing-tool-1", description: "Tool 1" },
						{ name: "existing-tool-2", description: "Tool 2" },
					],
				},
			]

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi.fn().mockReturnValue(mockServers),
					callTool: vi.fn(),
				}),
				postMessageToWebview: vi.fn(),
			})

			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test-server",
					tool_name: "non-existing-tool",
					arguments: JSON.stringify({ test: "data" }),
				},
				partial: false,
			}

			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("use_mcp_tool")
			expect(mockTask.say).toHaveBeenCalledWith("error", expect.stringContaining("does not exist"))
			// Check that the error message contains available tools
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("existing-tool-1"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("existing-tool-2"))
		})

		it("should handle server with no tools", async () => {
			// Reset consecutiveMistakeCount for this test
			mockTask.consecutiveMistakeCount = 0

			const mockServers = [
				{
					name: "test-server",
					tools: [],
				},
			]

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi.fn().mockReturnValue(mockServers),
					callTool: vi.fn(),
				}),
				postMessageToWebview: vi.fn(),
			})

			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test-server",
					tool_name: "any-tool",
					arguments: JSON.stringify({ test: "data" }),
				},
				partial: false,
			}

			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("use_mcp_tool")
			expect(mockTask.say).toHaveBeenCalledWith("error", expect.stringContaining("does not exist"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("No tools available"))
		})

		it("should allow valid tool names", async () => {
			// Reset consecutiveMistakeCount for this test
			mockTask.consecutiveMistakeCount = 0

			const mockServers = [
				{
					name: "test-server",
					tools: [{ name: "valid-tool", description: "Valid Tool" }],
				},
			]

			const mockToolResult = {
				content: [{ type: "text", text: "Tool executed successfully" }],
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi.fn().mockReturnValue(mockServers),
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
			})

			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test-server",
					tool_name: "valid-tool",
					arguments: JSON.stringify({ test: "data" }),
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockTask.recordToolError).not.toHaveBeenCalled()
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_request_started")
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_response", "Tool executed successfully")
		})

		it("should reject unknown server names with available servers listed", async () => {
			// Arrange
			mockTask.consecutiveMistakeCount = 0

			const mockServers = [{ name: "s1", tools: [] }]
			const callToolMock = vi.fn()

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi.fn().mockReturnValue(mockServers),
					callTool: callToolMock,
				}),
				postMessageToWebview: vi.fn(),
			})

			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "unknown",
					tool_name: "any-tool",
					arguments: "{}",
				},
				partial: false,
			}

			// Act
			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Assert
			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("use_mcp_tool")
			expect(mockTask.say).toHaveBeenCalledWith("error", expect.stringContaining("not configured"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("s1"))
			expect(callToolMock).not.toHaveBeenCalled()
			expect(mockAskApproval).not.toHaveBeenCalled()
		})

		it("should reject unknown server names when no servers are available", async () => {
			// Arrange
			mockTask.consecutiveMistakeCount = 0

			const callToolMock = vi.fn()
			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi.fn().mockReturnValue([]),
					callTool: callToolMock,
				}),
				postMessageToWebview: vi.fn(),
			})

			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "unknown",
					tool_name: "any-tool",
					arguments: "{}",
				},
				partial: false,
			}

			// Act
			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Assert
			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("use_mcp_tool")
			expect(mockTask.say).toHaveBeenCalledWith("error", expect.stringContaining("not configured"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("No servers available"))
			expect(callToolMock).not.toHaveBeenCalled()
			expect(mockAskApproval).not.toHaveBeenCalled()
		})
	})

	describe("image handling", () => {
		let mockReadImageAsDataUrlWithBuffer: ReturnType<typeof vi.fn>
		let mockFsStat: ReturnType<typeof vi.fn>

		beforeEach(() => {
			// Get mocked functions
			mockReadImageAsDataUrlWithBuffer = vi.mocked(readImageAsDataUrlWithBuffer)
			mockFsStat = vi.mocked(fs.stat)

			// Clear all mocks before each test
			vi.clearAllMocks()
		})

		it("should convert image file paths to base64 data URLs", async () => {
			// Setup
			const imagePath = "/path/to/image.png"
			const base64DataUrl =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

			// Mock file exists and is a file
			mockFsStat.mockResolvedValue({
				isFile: () => true,
			})

			// Mock image reading
			mockReadImageAsDataUrlWithBuffer.mockResolvedValue({
				dataUrl: base64DataUrl,
				buffer: Buffer.from("test"),
			})

			// Mock server and tool exist
			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi
						.fn()
						.mockReturnValue([
							{
								name: "test_server",
								tools: [{ name: "process_image", description: "Process an image" }],
							},
						]),
					callTool: vi.fn().mockResolvedValue({
						content: [{ type: "text", text: "Image processed" }],
						isError: false,
					}),
				}),
				postMessageToWebview: vi.fn(),
			})

			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "process_image",
					arguments: JSON.stringify({ image: imagePath }),
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			// Execute
			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Verify image was converted
			expect(mockFsStat).toHaveBeenCalledWith(imagePath)
			expect(mockReadImageAsDataUrlWithBuffer).toHaveBeenCalledWith(imagePath)

			// Verify the approval message contains the base64 data URL
			const approvalCall = mockAskApproval.mock.calls[0]
			const approvalMessage = JSON.parse(approvalCall[1])
			const args = JSON.parse(approvalMessage.arguments)
			expect(args.image).toBe(base64DataUrl)
		})

		it("should handle nested image paths in complex objects", async () => {
			// Setup
			const imagePath1 = "/path/to/image1.jpg"
			const imagePath2 = "/path/to/image2.png"
			const base64DataUrl1 = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
			const base64DataUrl2 = "data:image/png;base64,iVBORw0KGgoAAAANS=="

			// Mock file exists checks
			mockFsStat.mockImplementation((path) => {
				if (path === imagePath1 || path === imagePath2) {
					return Promise.resolve({ isFile: () => true })
				}
				return Promise.reject(new Error("File not found"))
			})

			// Mock image reading
			mockReadImageAsDataUrlWithBuffer.mockImplementation((path) => {
				if (path === imagePath1) {
					return Promise.resolve({ dataUrl: base64DataUrl1, buffer: Buffer.from("test1") })
				}
				if (path === imagePath2) {
					return Promise.resolve({ dataUrl: base64DataUrl2, buffer: Buffer.from("test2") })
				}
				return Promise.reject(new Error("File not found"))
			})

			// Mock server and tool exist
			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi
						.fn()
						.mockReturnValue([
							{
								name: "test_server",
								tools: [{ name: "process_images", description: "Process multiple images" }],
							},
						]),
					callTool: vi.fn().mockResolvedValue({
						content: [{ type: "text", text: "Images processed" }],
						isError: false,
					}),
				}),
				postMessageToWebview: vi.fn(),
			})

			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "process_images",
					arguments: JSON.stringify({
						images: [imagePath1, imagePath2],
						metadata: {
							primary_image: imagePath1,
							thumbnail: imagePath2,
						},
						text: "Some text that should not be converted",
					}),
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			// Execute
			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Verify the approval message contains converted base64 data URLs
			const approvalCall = mockAskApproval.mock.calls[0]
			const approvalMessage = JSON.parse(approvalCall[1])
			const args = JSON.parse(approvalMessage.arguments)

			expect(args.images[0]).toBe(base64DataUrl1)
			expect(args.images[1]).toBe(base64DataUrl2)
			expect(args.metadata.primary_image).toBe(base64DataUrl1)
			expect(args.metadata.thumbnail).toBe(base64DataUrl2)
			expect(args.text).toBe("Some text that should not be converted")
		})

		it("should skip conversion for non-image file paths", async () => {
			// Setup
			const textFilePath = "/path/to/document.txt"

			// Mock file exists but is not an image
			mockFsStat.mockResolvedValue({
				isFile: () => true,
			})

			// Mock server and tool exist
			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi
						.fn()
						.mockReturnValue([
							{ name: "test_server", tools: [{ name: "process_file", description: "Process a file" }] },
						]),
					callTool: vi.fn().mockResolvedValue({
						content: [{ type: "text", text: "File processed" }],
						isError: false,
					}),
				}),
				postMessageToWebview: vi.fn(),
			})

			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "process_file",
					arguments: JSON.stringify({ file: textFilePath }),
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			// Execute
			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Verify image conversion was NOT attempted
			expect(mockReadImageAsDataUrlWithBuffer).not.toHaveBeenCalled()

			// Verify the original path is preserved
			const approvalCall = mockAskApproval.mock.calls[0]
			const approvalMessage = JSON.parse(approvalCall[1])
			const args = JSON.parse(approvalMessage.arguments)
			expect(args.file).toBe(textFilePath)
		})

		it("should skip conversion for already base64 encoded images", async () => {
			// Setup
			const base64DataUrl =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

			// Mock server and tool exist
			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi
						.fn()
						.mockReturnValue([
							{
								name: "test_server",
								tools: [{ name: "process_image", description: "Process an image" }],
							},
						]),
					callTool: vi.fn().mockResolvedValue({
						content: [{ type: "text", text: "Image processed" }],
						isError: false,
					}),
				}),
				postMessageToWebview: vi.fn(),
			})

			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "process_image",
					arguments: JSON.stringify({ image: base64DataUrl }),
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			// Execute
			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Verify no file system operations were performed
			expect(mockFsStat).not.toHaveBeenCalled()
			expect(mockReadImageAsDataUrlWithBuffer).not.toHaveBeenCalled()

			// Verify the base64 data URL is preserved as-is
			const approvalCall = mockAskApproval.mock.calls[0]
			const approvalMessage = JSON.parse(approvalCall[1])
			const args = JSON.parse(approvalMessage.arguments)
			expect(args.image).toBe(base64DataUrl)
		})

		it("should handle file read errors gracefully", async () => {
			// Setup
			const imagePath = "/path/to/nonexistent.png"

			// Mock file exists
			mockFsStat.mockResolvedValue({
				isFile: () => true,
			})

			// Mock image reading failure
			mockReadImageAsDataUrlWithBuffer.mockRejectedValue(new Error("File read error"))

			// Mock server and tool exist
			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					getAllServers: vi
						.fn()
						.mockReturnValue([
							{
								name: "test_server",
								tools: [{ name: "process_image", description: "Process an image" }],
							},
						]),
					callTool: vi.fn().mockResolvedValue({
						content: [{ type: "text", text: "Image processed" }],
						isError: false,
					}),
				}),
				postMessageToWebview: vi.fn(),
			})

			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "process_image",
					arguments: JSON.stringify({ image: imagePath }),
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			// Execute
			await useMcpToolTool.handle(mockTask as Task, block as any, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Verify the original path is preserved when conversion fails
			const approvalCall = mockAskApproval.mock.calls[0]
			const approvalMessage = JSON.parse(approvalCall[1])
			const args = JSON.parse(approvalMessage.arguments)
			expect(args.image).toBe(imagePath)
		})
	})
})
