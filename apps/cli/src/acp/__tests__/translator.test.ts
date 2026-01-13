import type { ClineMessage } from "@roo-code/types"

import {
	translateToAcpUpdate,
	parseToolFromMessage,
	mapToolKind,
	isPermissionAsk,
	isCompletionAsk,
	extractPromptText,
	extractPromptImages,
	createPermissionOptions,
	buildToolCallFromMessage,
} from "../translator.js"

describe("translateToAcpUpdate", () => {
	it("should translate text say messages", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "text",
			text: "Hello, world!",
		}

		const result = translateToAcpUpdate(message)

		expect(result).toEqual({
			sessionUpdate: "agent_message_chunk",
			content: { type: "text", text: "Hello, world!" },
		})
	})

	it("should translate reasoning say messages", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "reasoning",
			text: "I'm thinking about this...",
		}

		const result = translateToAcpUpdate(message)

		expect(result).toEqual({
			sessionUpdate: "agent_thought_chunk",
			content: { type: "text", text: "I'm thinking about this..." },
		})
	})

	it("should translate error say messages", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "error",
			text: "Something went wrong",
		}

		const result = translateToAcpUpdate(message)

		expect(result).toEqual({
			sessionUpdate: "agent_message_chunk",
			content: { type: "text", text: "Error: Something went wrong" },
		})
	})

	it("should return null for completion_result", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "completion_result",
			text: "Task completed",
		}

		const result = translateToAcpUpdate(message)

		expect(result).toBeNull()
	})

	it("should return null for ask messages", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "ask",
			ask: "tool",
			text: "Approve this tool?",
		}

		const result = translateToAcpUpdate(message)

		expect(result).toBeNull()
	})
})

describe("parseToolFromMessage", () => {
	it("should parse JSON tool messages", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "shell_integration_warning",
			text: JSON.stringify({
				tool: "read_file",
				path: "/test/file.txt",
			}),
		}

		const result = parseToolFromMessage(message)

		expect(result).not.toBeNull()
		expect(result?.name).toBe("read_file")
		// Title is now human-readable based on tool name and filename
		expect(result?.title).toBe("Read file.txt")
		expect(result?.locations).toHaveLength(1)
		expect(result!.locations[0]!.path).toBe("/test/file.txt")
	})

	it("should extract tool name from text content", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "shell_integration_warning",
			text: "Using write_file to create the file",
		}

		const result = parseToolFromMessage(message)

		expect(result).not.toBeNull()
		expect(result?.name).toBe("write_file")
	})

	it("should return null for empty text", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "shell_integration_warning",
			text: "",
		}

		const result = parseToolFromMessage(message)

		expect(result).toBeNull()
	})
})

describe("mapToolKind", () => {
	it("should map read operations", () => {
		// Uses exact matching with normalized tool names from TOOL_CATEGORIES
		expect(mapToolKind("read_file")).toBe("read")
		expect(mapToolKind("readFile")).toBe("read")
	})

	it("should map list_files to read kind", () => {
		// list operations are read-like in the ACP protocol
		expect(mapToolKind("list_files")).toBe("read")
		expect(mapToolKind("listFiles")).toBe("read")
		expect(mapToolKind("listFilesTopLevel")).toBe("read")
		expect(mapToolKind("listFilesRecursive")).toBe("read")
	})

	it("should map edit operations", () => {
		expect(mapToolKind("write_to_file")).toBe("edit")
		expect(mapToolKind("apply_diff")).toBe("edit")
		expect(mapToolKind("modify_file")).toBe("edit")
		expect(mapToolKind("create_file")).toBe("edit")
		expect(mapToolKind("newFileCreated")).toBe("edit")
		expect(mapToolKind("editedExistingFile")).toBe("edit")
	})

	it("should map delete operations", () => {
		expect(mapToolKind("delete_file")).toBe("delete")
		expect(mapToolKind("deleteFile")).toBe("delete")
		expect(mapToolKind("remove_file")).toBe("delete")
		expect(mapToolKind("removeFile")).toBe("delete")
	})

	it("should map move operations", () => {
		expect(mapToolKind("move_file")).toBe("move")
		expect(mapToolKind("moveFile")).toBe("move")
		expect(mapToolKind("rename_file")).toBe("move")
		expect(mapToolKind("renameFile")).toBe("move")
	})

	it("should map search operations", () => {
		expect(mapToolKind("search_files")).toBe("search")
		expect(mapToolKind("searchFiles")).toBe("search")
		expect(mapToolKind("codebase_search")).toBe("search")
		expect(mapToolKind("codebaseSearch")).toBe("search")
		expect(mapToolKind("grep")).toBe("search")
		expect(mapToolKind("ripgrep")).toBe("search")
	})

	it("should map execute operations", () => {
		expect(mapToolKind("execute_command")).toBe("execute")
		expect(mapToolKind("executeCommand")).toBe("execute")
		expect(mapToolKind("run_command")).toBe("execute")
		expect(mapToolKind("runCommand")).toBe("execute")
	})

	it("should map think operations", () => {
		expect(mapToolKind("think")).toBe("think")
		expect(mapToolKind("reason")).toBe("think")
		expect(mapToolKind("plan")).toBe("think")
		expect(mapToolKind("analyze")).toBe("think")
	})

	it("should map fetch operations", () => {
		// Note: browser_action is NOT mapped to fetch because browser tools are disabled in CLI
		expect(mapToolKind("fetch")).toBe("fetch")
		expect(mapToolKind("web_request")).toBe("fetch")
		expect(mapToolKind("webRequest")).toBe("fetch")
		expect(mapToolKind("http_get")).toBe("fetch")
		expect(mapToolKind("httpGet")).toBe("fetch")
		expect(mapToolKind("http_post")).toBe("fetch")
		expect(mapToolKind("url_fetch")).toBe("fetch")
	})

	it("should map browser_action to other (browser tools disabled in CLI)", () => {
		// browser_action intentionally maps to "other" because browser tools are disabled in CLI mode
		expect(mapToolKind("browser_action")).toBe("other")
	})

	it("should map switch_mode operations", () => {
		expect(mapToolKind("switch_mode")).toBe("switch_mode")
		expect(mapToolKind("switchMode")).toBe("switch_mode")
		expect(mapToolKind("set_mode")).toBe("switch_mode")
		expect(mapToolKind("setMode")).toBe("switch_mode")
	})

	it("should return other for unknown operations", () => {
		expect(mapToolKind("unknown_tool")).toBe("other")
		expect(mapToolKind("custom_operation")).toBe("other")
		// Tool names that don't exactly match categories also return other
		expect(mapToolKind("inspect_code")).toBe("other")
		expect(mapToolKind("get_info")).toBe("other")
	})
})

describe("isPermissionAsk", () => {
	it("should return true for permission-required asks", () => {
		expect(isPermissionAsk("tool")).toBe(true)
		expect(isPermissionAsk("command")).toBe(true)
		expect(isPermissionAsk("browser_action_launch")).toBe(true)
		expect(isPermissionAsk("use_mcp_server")).toBe(true)
	})

	it("should return false for other asks", () => {
		expect(isPermissionAsk("followup")).toBe(false)
		expect(isPermissionAsk("completion_result")).toBe(false)
		expect(isPermissionAsk("api_req_failed")).toBe(false)
	})
})

describe("isCompletionAsk", () => {
	it("should return true for completion asks", () => {
		expect(isCompletionAsk("completion_result")).toBe(true)
		expect(isCompletionAsk("api_req_failed")).toBe(true)
		expect(isCompletionAsk("mistake_limit_reached")).toBe(true)
	})

	it("should return false for other asks", () => {
		expect(isCompletionAsk("tool")).toBe(false)
		expect(isCompletionAsk("followup")).toBe(false)
		expect(isCompletionAsk("command")).toBe(false)
	})
})

describe("extractPromptText", () => {
	it("should extract text from text blocks", () => {
		const prompt = [
			{ type: "text" as const, text: "Hello" },
			{ type: "text" as const, text: "World" },
		]

		const result = extractPromptText(prompt)

		expect(result).toBe("Hello\nWorld")
	})

	it("should handle resource_link blocks", () => {
		const prompt = [
			{ type: "text" as const, text: "Check this file:" },
			{
				type: "resource_link" as const,
				uri: "file:///test/file.txt",
				name: "file.txt",
				mimeType: "text/plain",
			},
		]

		const result = extractPromptText(prompt)

		expect(result).toContain("@file:///test/file.txt")
	})

	it("should handle image blocks", () => {
		const prompt = [
			{ type: "text" as const, text: "Look at this:" },
			{
				type: "image" as const,
				data: "base64data",
				mimeType: "image/png",
			},
		]

		const result = extractPromptText(prompt)

		expect(result).toContain("[image content]")
	})
})

describe("extractPromptImages", () => {
	it("should extract image data", () => {
		const prompt = [
			{ type: "text" as const, text: "Check this:" },
			{
				type: "image" as const,
				data: "base64data1",
				mimeType: "image/png",
			},
			{
				type: "image" as const,
				data: "base64data2",
				mimeType: "image/jpeg",
			},
		]

		const result = extractPromptImages(prompt)

		expect(result).toHaveLength(2)
		expect(result[0]).toBe("base64data1")
		expect(result[1]).toBe("base64data2")
	})

	it("should return empty array when no images", () => {
		const prompt = [{ type: "text" as const, text: "No images here" }]

		const result = extractPromptImages(prompt)

		expect(result).toHaveLength(0)
	})
})

describe("createPermissionOptions", () => {
	it("should include always allow for tool asks", () => {
		const options = createPermissionOptions("tool")

		expect(options).toHaveLength(3)
		expect(options[0]!.optionId).toBe("allow_always")
		expect(options[0]!.kind).toBe("allow_always")
	})

	it("should include always allow for command asks", () => {
		const options = createPermissionOptions("command")

		expect(options).toHaveLength(3)
		expect(options[0]!.optionId).toBe("allow_always")
	})

	it("should have basic options for other asks", () => {
		const options = createPermissionOptions("browser_action_launch")

		expect(options).toHaveLength(2)
		expect(options[0]!.optionId).toBe("allow")
		expect(options[1]!.optionId).toBe("reject")
	})
})

describe("buildToolCallFromMessage", () => {
	it("should build a valid tool call", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "shell_integration_warning",
			text: JSON.stringify({
				tool: "read_file",
				path: "/test/file.txt",
			}),
		}

		const result = buildToolCallFromMessage(message)

		// Tool ID is deterministic based on message timestamp for debugging
		expect(result.toolCallId).toBe("tool-12345")
		// Title is now human-readable based on tool name and filename
		expect(result.title).toBe("Read file.txt")
		expect(result.kind).toBe("read")
		expect(result.status).toBe("pending")
		expect(result.locations).toHaveLength(1)
	})

	it("should handle messages without text", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "shell_integration_warning",
		}

		const result = buildToolCallFromMessage(message)

		// Tool ID is deterministic based on message timestamp for debugging
		expect(result.toolCallId).toBe("tool-12345")
		expect(result.kind).toBe("other")
	})

	it("should not include search path as location for search tools", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "shell_integration_warning",
			text: JSON.stringify({
				tool: "searchFiles",
				path: "src",
				regex: ".*",
				filePattern: "*utils*",
			}),
		}

		const result = buildToolCallFromMessage(message, "/workspace/project")

		// Search path "src" should NOT become a location
		expect(result.kind).toBe("search")
		expect(result.locations).toHaveLength(0)
	})

	it("should extract file paths from search results content", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "shell_integration_warning",
			text: JSON.stringify({
				tool: "search_files",
				path: "cli",
				regex: ".*",
				content:
					"Found 2 results.\n\n# src/utils/helpers.ts\n  1 | export function helper() {}\n\n# src/components/Button.tsx\n  5 | const Button = () => {}",
			}),
		}

		const result = buildToolCallFromMessage(message, "/workspace")

		expect(result.kind).toBe("search")
		// Should extract file paths from the search results
		expect(result.locations!).toHaveLength(2)
		expect(result.locations![0]!.path).toBe("/workspace/src/utils/helpers.ts")
		expect(result.locations![1]!.path).toBe("/workspace/src/components/Button.tsx")
	})

	it("should include directory path for list_files tools", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "shell_integration_warning",
			text: JSON.stringify({
				tool: "list_files",
				path: "src/components",
			}),
		}

		const result = buildToolCallFromMessage(message, "/workspace")

		expect(result.kind).toBe("read")
		// Directory path should be included for list_files
		expect(result.locations!).toHaveLength(1)
		expect(result.locations![0]!.path).toBe("/workspace/src/components")
	})

	it("should handle codebase_search tool", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "shell_integration_warning",
			text: JSON.stringify({
				tool: "codebase_search",
				query: "find all utils",
				path: ".",
				content: "# lib/utils.js\n  10 | function util() {}",
			}),
		}

		const result = buildToolCallFromMessage(message, "/project")

		expect(result.kind).toBe("search")
		expect(result.locations!).toHaveLength(1)
		expect(result.locations![0]!.path).toBe("/project/lib/utils.js")
	})

	it("should deduplicate file paths in search results", () => {
		const message: ClineMessage = {
			ts: 12345,
			type: "say",
			say: "shell_integration_warning",
			text: JSON.stringify({
				tool: "searchFiles",
				path: "src",
				content: "# src/file.ts\n  1 | match1\n\n# src/file.ts\n  5 | match2\n\n# src/other.ts\n  3 | match3",
			}),
		}

		const result = buildToolCallFromMessage(message, "/workspace")

		// Should deduplicate: src/file.ts appears twice but should only be included once
		expect(result.locations!).toHaveLength(2)
		expect(result.locations![0]!.path).toBe("/workspace/src/file.ts")
		expect(result.locations![1]!.path).toBe("/workspace/src/other.ts")
	})
})
