/**
 * Tool Handler Unit Tests
 *
 * Tests for the ToolHandler abstraction and ToolHandlerRegistry.
 */

import type { ClineMessage, ClineAsk } from "@roo-code/types"

import {
	ToolHandlerRegistry,
	CommandToolHandler,
	FileEditToolHandler,
	FileReadToolHandler,
	SearchToolHandler,
	ListFilesToolHandler,
	DefaultToolHandler,
	type ToolHandlerContext,
} from "../tool-handler.js"
import { parseToolFromMessage } from "../translator.js"
import { NullLogger } from "../interfaces.js"

// =============================================================================
// Test Utilities
// =============================================================================

const testLogger = new NullLogger()

function createContext(message: ClineMessage, ask: ClineAsk, workspacePath = "/workspace"): ToolHandlerContext {
	return {
		message,
		ask,
		workspacePath,
		toolInfo: parseToolFromMessage(message, workspacePath),
		logger: testLogger,
	}
}

function createToolMessage(tool: string, params: Record<string, unknown> = {}): ClineMessage {
	return {
		ts: Date.now(),
		type: "say",
		say: "text",
		text: JSON.stringify({ tool, ...params }),
	}
}

// =============================================================================
// CommandToolHandler Tests
// =============================================================================

describe("CommandToolHandler", () => {
	const handler = new CommandToolHandler()

	describe("canHandle", () => {
		it("should handle command asks", () => {
			const context = createContext(createToolMessage("execute_command", { command: "ls" }), "command")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should not handle tool asks", () => {
			const context = createContext(createToolMessage("read_file", { path: "test.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(false)
		})

		it("should not handle browser_action_launch asks", () => {
			const context = createContext(createToolMessage("browser_action", {}), "browser_action_launch")
			expect(handler.canHandle(context)).toBe(false)
		})
	})

	describe("handle", () => {
		it("should return execute kind for commands", () => {
			const context = createContext(createToolMessage("execute_command", { command: "npm test" }), "command")
			const result = handler.handle(context)

			expect(result.initialUpdate).toMatchObject({
				sessionUpdate: "tool_call",
				kind: "execute",
				status: "in_progress",
			})
		})

		it("should track as pending command", () => {
			const message = createToolMessage("execute_command", { command: "npm test" })
			const context = createContext(message, "command")
			const result = handler.handle(context)

			expect(result.trackAsPendingCommand).toBeDefined()
			expect(result.trackAsPendingCommand?.command).toBe(message.text)
			expect(result.trackAsPendingCommand?.ts).toBe(message.ts)
		})

		it("should not include completion update", () => {
			const context = createContext(createToolMessage("execute_command", { command: "ls" }), "command")
			const result = handler.handle(context)

			expect(result.completionUpdate).toBeUndefined()
		})
	})
})

// =============================================================================
// FileEditToolHandler Tests
// =============================================================================

describe("FileEditToolHandler", () => {
	const handler = new FileEditToolHandler()

	describe("canHandle", () => {
		it("should handle write_to_file tool", () => {
			const context = createContext(createToolMessage("write_to_file", { path: "test.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle apply_diff tool", () => {
			const context = createContext(createToolMessage("apply_diff", { path: "test.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle create_file tool", () => {
			const context = createContext(createToolMessage("create_file", { path: "new.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle newFileCreated tool", () => {
			const context = createContext(createToolMessage("newFileCreated", { path: "new.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle editedExistingFile tool", () => {
			const context = createContext(createToolMessage("editedExistingFile", { path: "test.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should not handle read_file tool", () => {
			const context = createContext(createToolMessage("read_file", { path: "test.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(false)
		})

		it("should not handle command asks", () => {
			const context = createContext(createToolMessage("write_to_file", { path: "test.ts" }), "command")
			expect(handler.canHandle(context)).toBe(false)
		})
	})

	describe("handle", () => {
		it("should return edit kind", () => {
			const context = createContext(createToolMessage("write_to_file", { path: "test.ts" }), "tool")
			const result = handler.handle(context)

			expect(result.initialUpdate).toMatchObject({
				sessionUpdate: "tool_call",
				kind: "edit",
				status: "in_progress",
			})
		})

		it("should include completion update", () => {
			const context = createContext(createToolMessage("write_to_file", { path: "test.ts" }), "tool")
			const result = handler.handle(context)

			expect(result.completionUpdate).toMatchObject({
				sessionUpdate: "tool_call_update",
				status: "completed",
			})
		})

		it("should not track as pending command", () => {
			const context = createContext(createToolMessage("write_to_file", { path: "test.ts" }), "tool")
			const result = handler.handle(context)

			expect(result.trackAsPendingCommand).toBeUndefined()
		})
	})
})

// =============================================================================
// FileReadToolHandler Tests
// =============================================================================

describe("FileReadToolHandler", () => {
	const handler = new FileReadToolHandler()

	describe("canHandle", () => {
		it("should handle read_file tool", () => {
			const context = createContext(createToolMessage("read_file", { path: "test.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle readFile tool", () => {
			const context = createContext(createToolMessage("readFile", { path: "test.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should not handle write_to_file tool", () => {
			const context = createContext(createToolMessage("write_to_file", { path: "test.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(false)
		})

		it("should not handle command asks", () => {
			const context = createContext(createToolMessage("read_file", { path: "test.ts" }), "command")
			expect(handler.canHandle(context)).toBe(false)
		})
	})

	describe("handle", () => {
		it("should return read kind", () => {
			const context = createContext(createToolMessage("read_file", { path: "test.ts" }), "tool")
			const result = handler.handle(context)

			expect(result.initialUpdate).toMatchObject({
				sessionUpdate: "tool_call",
				kind: "read",
				status: "in_progress",
			})
		})

		it("should include completion update", () => {
			const context = createContext(createToolMessage("read_file", { path: "test.ts" }), "tool")
			const result = handler.handle(context)

			expect(result.completionUpdate).toMatchObject({
				sessionUpdate: "tool_call_update",
				status: "completed",
			})
		})
	})
})

// =============================================================================
// SearchToolHandler Tests
// =============================================================================

describe("SearchToolHandler", () => {
	const handler = new SearchToolHandler()

	describe("canHandle", () => {
		it("should handle search_files tool", () => {
			const context = createContext(createToolMessage("search_files", { regex: "test" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle searchFiles tool", () => {
			const context = createContext(createToolMessage("searchFiles", { regex: "test" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle codebase_search tool", () => {
			const context = createContext(createToolMessage("codebase_search", { query: "test" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle grep tool", () => {
			const context = createContext(createToolMessage("grep", { pattern: "test" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should not handle custom tool with search in name (exact matching)", () => {
			const context = createContext(createToolMessage("custom_search_tool", {}), "tool")
			// With exact matching, "custom_search_tool" won't match the search category
			expect(handler.canHandle(context)).toBe(false)
		})

		it("should not handle read_file tool", () => {
			const context = createContext(createToolMessage("read_file", { path: "test.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(false)
		})
	})

	describe("handle", () => {
		it("should return search kind", () => {
			const context = createContext(createToolMessage("search_files", { regex: "test" }), "tool")
			const result = handler.handle(context)

			expect(result.initialUpdate).toMatchObject({
				sessionUpdate: "tool_call",
				kind: "search",
				status: "in_progress",
			})
		})

		it("should format search results in completion", () => {
			const searchResults = "Found 5 results.\n\n# src/file1.ts\n  1 | match\n\n# src/file2.ts\n  2 | match"
			const context = createContext(createToolMessage("search_files", { content: searchResults }), "tool")
			const result = handler.handle(context)

			expect(result.completionUpdate).toMatchObject({
				sessionUpdate: "tool_call_update",
				status: "completed",
			})

			// Content should be formatted - cast to access content property
			const completionUpdate = result.completionUpdate as Record<string, unknown>
			expect(completionUpdate?.content).toBeDefined()
		})
	})
})

// =============================================================================
// ListFilesToolHandler Tests
// =============================================================================

describe("ListFilesToolHandler", () => {
	const handler = new ListFilesToolHandler()

	describe("canHandle", () => {
		it("should handle list_files tool", () => {
			const context = createContext(createToolMessage("list_files", { path: "src" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle listFiles tool", () => {
			const context = createContext(createToolMessage("listFiles", { path: "src" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle listFilesTopLevel tool", () => {
			const context = createContext(createToolMessage("listFilesTopLevel", { path: "src" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should handle listFilesRecursive tool", () => {
			const context = createContext(createToolMessage("listFilesRecursive", { path: "src" }), "tool")
			expect(handler.canHandle(context)).toBe(true)
		})

		it("should not handle read_file tool", () => {
			const context = createContext(createToolMessage("read_file", { path: "test.ts" }), "tool")
			expect(handler.canHandle(context)).toBe(false)
		})
	})

	describe("handle", () => {
		it("should return read kind", () => {
			const context = createContext(createToolMessage("list_files", { path: "src" }), "tool")
			const result = handler.handle(context)

			expect(result.initialUpdate).toMatchObject({
				sessionUpdate: "tool_call",
				kind: "read",
				status: "in_progress",
			})
		})
	})
})

// =============================================================================
// DefaultToolHandler Tests
// =============================================================================

describe("DefaultToolHandler", () => {
	const handler = new DefaultToolHandler()

	describe("canHandle", () => {
		it("should always return true", () => {
			const context1 = createContext(createToolMessage("unknown_tool", {}), "tool")
			const context2 = createContext(createToolMessage("custom_operation", {}), "tool")
			const context3 = createContext(createToolMessage("any_tool", {}), "browser_action_launch")

			expect(handler.canHandle(context1)).toBe(true)
			expect(handler.canHandle(context2)).toBe(true)
			expect(handler.canHandle(context3)).toBe(true)
		})
	})

	describe("handle", () => {
		it("should map tool kind from tool name (exact matching)", () => {
			// Use exact tool name from TOOL_CATEGORIES.think
			const context = createContext(createToolMessage("think", {}), "tool")
			const result = handler.handle(context)

			expect(result.initialUpdate).toMatchObject({
				sessionUpdate: "tool_call",
				kind: "think",
				status: "in_progress",
			})
		})

		it("should return other kind for unknown tools (exact matching)", () => {
			// Tool names that don't exactly match categories return "other"
			const context = createContext(createToolMessage("think_about_it", {}), "tool")
			const result = handler.handle(context)

			expect(result.initialUpdate).toMatchObject({
				sessionUpdate: "tool_call",
				kind: "other",
				status: "in_progress",
			})
		})

		it("should include completion update", () => {
			const context = createContext(createToolMessage("custom_tool", {}), "tool")
			const result = handler.handle(context)

			expect(result.completionUpdate).toMatchObject({
				sessionUpdate: "tool_call_update",
				status: "completed",
			})
		})
	})
})

// =============================================================================
// ToolHandlerRegistry Tests
// =============================================================================

describe("ToolHandlerRegistry", () => {
	describe("getHandler", () => {
		const registry = new ToolHandlerRegistry()

		it("should return CommandToolHandler for command asks", () => {
			const context = createContext(createToolMessage("execute_command", {}), "command")
			const handler = registry.getHandler(context)

			expect(handler).toBeInstanceOf(CommandToolHandler)
		})

		it("should return FileEditToolHandler for edit tools", () => {
			const context = createContext(createToolMessage("write_to_file", { path: "test.ts" }), "tool")
			const handler = registry.getHandler(context)

			expect(handler).toBeInstanceOf(FileEditToolHandler)
		})

		it("should return FileReadToolHandler for read tools", () => {
			const context = createContext(createToolMessage("read_file", { path: "test.ts" }), "tool")
			const handler = registry.getHandler(context)

			expect(handler).toBeInstanceOf(FileReadToolHandler)
		})

		it("should return SearchToolHandler for search tools", () => {
			const context = createContext(createToolMessage("search_files", {}), "tool")
			const handler = registry.getHandler(context)

			expect(handler).toBeInstanceOf(SearchToolHandler)
		})

		it("should return ListFilesToolHandler for list tools", () => {
			const context = createContext(createToolMessage("list_files", {}), "tool")
			const handler = registry.getHandler(context)

			expect(handler).toBeInstanceOf(ListFilesToolHandler)
		})

		it("should return DefaultToolHandler for unknown tools", () => {
			const context = createContext(createToolMessage("unknown_tool", {}), "tool")
			const handler = registry.getHandler(context)

			expect(handler).toBeInstanceOf(DefaultToolHandler)
		})
	})

	describe("handle", () => {
		const registry = new ToolHandlerRegistry()

		it("should dispatch to correct handler and return result", () => {
			const context = createContext(createToolMessage("execute_command", {}), "command")
			const result = registry.handle(context)

			expect(result.initialUpdate).toMatchObject({
				sessionUpdate: "tool_call",
				kind: "execute",
				status: "in_progress",
			})
			expect(result.trackAsPendingCommand).toBeDefined()
		})
	})

	describe("createContext", () => {
		it("should create a valid context", () => {
			const message = createToolMessage("read_file", { path: "test.ts" })
			const context = ToolHandlerRegistry.createContext(message, "tool", "/workspace", testLogger)

			expect(context.message).toBe(message)
			expect(context.ask).toBe("tool")
			expect(context.workspacePath).toBe("/workspace")
			expect(context.toolInfo).toBeDefined()
			expect(context.toolInfo?.name).toBe("read_file")
			expect(context.logger).toBe(testLogger)
		})
	})

	describe("custom handlers", () => {
		it("should accept custom handler list", () => {
			const customHandler = new DefaultToolHandler()
			const registry = new ToolHandlerRegistry([customHandler])

			const context = createContext(createToolMessage("any_tool", {}), "command")
			const handler = registry.getHandler(context)

			expect(handler).toBe(customHandler)
		})
	})
})
