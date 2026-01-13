import { describe, it, expect, vi, beforeEach } from "vitest"
import { webSearchTool } from "../WebSearchTool"
import { ToolUse } from "../../../shared/tools"
import { Task } from "../../task/Task"
import { formatResponse } from "../../prompts/responses"

describe("WebSearchTool", () => {
	let mockTask: any
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockRemoveClosingTag: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup mock Task instance
		mockTask = {
			cwd: "/test/workspace",
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			recordToolUsage: vi.fn(),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
			say: vi.fn().mockResolvedValue(undefined),
		}

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag, content) => content || "")
	})

	describe("partial block handling", () => {
		it("should return early when block is partial", async () => {
			const partialBlock: ToolUse = {
				type: "tool_use",
				name: "web_search",
				params: {
					query: "test search query",
				},
				partial: true,
			}

			await webSearchTool.handle(mockTask as Task, partialBlock as ToolUse<"web_search">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Should not process anything when partial
			expect(mockAskApproval).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
			expect(mockTask.say).not.toHaveBeenCalled()
		})

		it("should process when block is not partial", async () => {
			const completeBlock: ToolUse = {
				type: "tool_use",
				name: "web_search",
				params: {
					query: "test search query",
				},
				partial: false,
			}

			await webSearchTool.handle(mockTask as Task, completeBlock as ToolUse<"web_search">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Should process the complete block
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockTask.say).toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalled()
			expect(mockTask.recordToolUsage).toHaveBeenCalledWith("web_search")
		})
	})

	describe("missing parameters", () => {
		it("should handle missing query parameter", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "web_search",
				params: {},
				partial: false,
			}

			await webSearchTool.handle(mockTask as Task, block as ToolUse<"web_search">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("web_search")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("web_search", "query")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
		})
	})

	describe("user approval", () => {
		it("should request approval with correct message", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "web_search",
				params: {
					query: "test search query",
				},
				partial: false,
			}

			await webSearchTool.handle(mockTask as Task, block as ToolUse<"web_search">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockAskApproval).toHaveBeenCalledWith(
				"tool",
				JSON.stringify({
					tool: "webSearch",
					query: "test search query",
				}),
			)
		})

		it("should return early when user rejects approval", async () => {
			mockAskApproval.mockResolvedValue(false)

			const block: ToolUse = {
				type: "tool_use",
				name: "web_search",
				params: {
					query: "test search query",
				},
				partial: false,
			}

			await webSearchTool.handle(mockTask as Task, block as ToolUse<"web_search">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockTask.say).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
			expect(mockTask.recordToolUsage).not.toHaveBeenCalled()
		})
	})

	describe("search execution", () => {
		it("should perform search and return results when approved", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "web_search",
				params: {
					query: "test search query",
				},
				partial: false,
			}

			await webSearchTool.handle(mockTask as Task, block as ToolUse<"web_search">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			// Verify search was logged (i18n key format)
			expect(mockTask.say).toHaveBeenCalledWith("text", "webSearch.searching")

			// Verify tool usage was recorded
			expect(mockTask.recordToolUsage).toHaveBeenCalledWith("web_search")

			// Verify results were pushed (i18n key format in tests)
			expect(mockPushToolResult).toHaveBeenCalled()
			const resultCall = mockPushToolResult.mock.calls[0][0]
			expect(resultCall).toContain("webSearch.results")
		})

		it("should reset consecutive mistake count on successful execution", async () => {
			mockTask.consecutiveMistakeCount = 3

			const block: ToolUse = {
				type: "tool_use",
				name: "web_search",
				params: {
					query: "test search query",
				},
				partial: false,
			}

			await webSearchTool.handle(mockTask as Task, block as ToolUse<"web_search">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockTask.consecutiveMistakeCount).toBe(0)
		})

		it("should include mock note in results", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "web_search",
				params: {
					query: "test search query",
				},
				partial: false,
			}

			await webSearchTool.handle(mockTask as Task, block as ToolUse<"web_search">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			const resultCall = mockPushToolResult.mock.calls[0][0]
			// Check for i18n key format
			expect(resultCall).toContain("webSearch.mockNote")
		})
	})

	describe("error handling", () => {
		it("should handle errors during search", async () => {
			const testError = new Error("Search failed")
			mockTask.say.mockRejectedValueOnce(testError)

			const block: ToolUse = {
				type: "tool_use",
				name: "web_search",
				params: {
					query: "test search query",
				},
				partial: false,
			}

			await webSearchTool.handle(mockTask as Task, block as ToolUse<"web_search">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockHandleError).toHaveBeenCalledWith("performing web search", testError)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("web_search")
		})
	})

	describe("removeClosingTag integration", () => {
		it("should use removeClosingTag to clean query parameter", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "web_search",
				params: {
					query: "test query with tags",
				},
				partial: false,
			}

			mockRemoveClosingTag.mockImplementation((tag: string, content?: string) => {
				if (tag === "query") {
					return "cleaned query"
				}
				return content || ""
			})

			await webSearchTool.handle(mockTask as Task, block as ToolUse<"web_search">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
				removeClosingTag: mockRemoveClosingTag,
				toolProtocol: "xml",
			})

			expect(mockRemoveClosingTag).toHaveBeenCalledWith("query", "test query with tags")
			expect(mockAskApproval).toHaveBeenCalledWith(
				"tool",
				JSON.stringify({
					tool: "webSearch",
					query: "cleaned query",
				}),
			)
		})
	})
})
