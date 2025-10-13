import { describe, it, expect, vi, beforeEach } from "vitest"
import { runSlashCommandTool } from "../runSlashCommandTool"
import { Task } from "../../task/Task"
import { formatResponse } from "../../prompts/responses"
import { getCommand, getCommandNames } from "../../../services/command/commands"
import { parseMentions } from "../../mentions"

// Mock dependencies
vi.mock("../../../services/command/commands", () => ({
	getCommand: vi.fn(),
	getCommandNames: vi.fn(),
}))

vi.mock("../../mentions", () => ({
	parseMentions: vi.fn(),
}))

vi.mock("../../../services/browser/UrlContentFetcher", () => ({
	UrlContentFetcher: vi.fn().mockImplementation(() => ({})),
}))

describe("runSlashCommandTool", () => {
	let mockTask: any
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockRemoveClosingTag: any

	beforeEach(() => {
		vi.clearAllMocks()

		// By default, mock parseMentions to return the original content unchanged
		vi.mocked(parseMentions).mockImplementation((content) => Promise.resolve(content))

		mockTask = {
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
			ask: vi.fn(),
			cwd: "/test/project",
			providerRef: {
				deref: vi.fn().mockReturnValue({
					getState: vi.fn().mockResolvedValue({
						experiments: {
							runSlashCommand: true,
						},
					}),
				}),
			},
		}

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag, text) => text || "")
	})

	it("should handle missing command parameter", async () => {
		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {},
			partial: false,
		}

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(mockTask.recordToolError).toHaveBeenCalledWith("run_slash_command")
		expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("run_slash_command", "command")
		expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
	})

	it("should handle command not found", async () => {
		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "nonexistent",
			},
			partial: false,
		}

		vi.mocked(getCommand).mockResolvedValue(undefined)
		vi.mocked(getCommandNames).mockResolvedValue(["init", "test", "deploy"])

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockTask.recordToolError).toHaveBeenCalledWith("run_slash_command")
		expect(mockPushToolResult).toHaveBeenCalledWith(
			formatResponse.toolError("Command 'nonexistent' not found. Available commands: init, test, deploy"),
		)
	})

	it("should handle user rejection", async () => {
		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "init",
			},
			partial: false,
		}

		const mockCommand = {
			name: "init",
			content: "Initialize project",
			source: "built-in" as const,
			filePath: "<built-in:init>",
			description: "Initialize the project",
		}

		vi.mocked(getCommand).mockResolvedValue(mockCommand)
		mockAskApproval.mockResolvedValue(false)

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockAskApproval).toHaveBeenCalled()
		expect(mockPushToolResult).not.toHaveBeenCalled()
	})

	it("should successfully execute built-in command", async () => {
		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "init",
			},
			partial: false,
		}

		const mockCommand = {
			name: "init",
			content: "Initialize project content here",
			source: "built-in" as const,
			filePath: "<built-in:init>",
			description: "Analyze codebase and create AGENTS.md",
		}

		vi.mocked(getCommand).mockResolvedValue(mockCommand)

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockAskApproval).toHaveBeenCalledWith(
			"tool",
			JSON.stringify({
				tool: "runSlashCommand",
				command: "init",
				args: undefined,
				source: "built-in",
				description: "Analyze codebase and create AGENTS.md",
			}),
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(
			`Command: /init
Description: Analyze codebase and create AGENTS.md
Source: built-in

--- Command Content ---

Initialize project content here`,
		)
	})

	it("should successfully execute command with arguments", async () => {
		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "test",
				args: "focus on unit tests",
			},
			partial: false,
		}

		const mockCommand = {
			name: "test",
			content: "Run tests with specific focus",
			source: "project" as const,
			filePath: ".roo/commands/test.md",
			description: "Run project tests",
			argumentHint: "test type or focus area",
		}

		vi.mocked(getCommand).mockResolvedValue(mockCommand)

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(
			`Command: /test
Description: Run project tests
Argument hint: test type or focus area
Provided arguments: focus on unit tests
Source: project

--- Command Content ---

Run tests with specific focus`,
		)
	})

	it("should handle global command", async () => {
		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "deploy",
			},
			partial: false,
		}

		const mockCommand = {
			name: "deploy",
			content: "Deploy application to production",
			source: "global" as const,
			filePath: "~/.roo/commands/deploy.md",
		}

		vi.mocked(getCommand).mockResolvedValue(mockCommand)

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(
			`Command: /deploy
Source: global

--- Command Content ---

Deploy application to production`,
		)
	})

	it("should handle partial block", async () => {
		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "init",
			},
			partial: true,
		}

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockTask.ask).toHaveBeenCalledWith(
			"tool",
			JSON.stringify({
				tool: "runSlashCommand",
				command: "init",
				args: "",
			}),
			true,
		)

		expect(mockPushToolResult).not.toHaveBeenCalled()
	})

	it("should handle errors during execution", async () => {
		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "init",
			},
			partial: false,
		}

		const error = new Error("Test error")
		vi.mocked(getCommand).mockRejectedValue(error)

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockHandleError).toHaveBeenCalledWith("running slash command", error)
	})

	it("should handle empty available commands list", async () => {
		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "nonexistent",
			},
			partial: false,
		}

		vi.mocked(getCommand).mockResolvedValue(undefined)
		vi.mocked(getCommandNames).mockResolvedValue([])

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(
			formatResponse.toolError("Command 'nonexistent' not found. Available commands: (none)"),
		)
	})

	it("should reset consecutive mistake count on valid command", async () => {
		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "init",
			},
			partial: false,
		}

		mockTask.consecutiveMistakeCount = 5

		const mockCommand = {
			name: "init",
			content: "Initialize project",
			source: "built-in" as const,
			filePath: "<built-in:init>",
		}

		vi.mocked(getCommand).mockResolvedValue(mockCommand)

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockTask.consecutiveMistakeCount).toBe(0)
	})

	it("should process mentions in command content", async () => {
		const mockCommand = {
			name: "test",
			content: "Check @/README.md for details",
			source: "project" as const,
			filePath: ".roo/commands/test.md",
			description: "Test command with file reference",
		}

		vi.mocked(getCommand).mockResolvedValue(mockCommand)
		vi.mocked(parseMentions).mockResolvedValue(
			"Check 'README.md' (see below for file content)\n\n<file_content path=\"README.md\">\n# README\nTest content\n</file_content>",
		)

		mockAskApproval.mockResolvedValue(true)

		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "test",
			},
			partial: false,
		}

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify parseMentions was called with the command content
		expect(vi.mocked(parseMentions)).toHaveBeenCalledWith(
			"Check @/README.md for details",
			"/test/project",
			expect.any(Object), // UrlContentFetcher instance
			undefined,
			undefined,
			false,
			true,
			50,
			undefined,
		)

		// Verify the processed content is included in the result
		expect(mockPushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("Check 'README.md' (see below for file content)"),
		)
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining('<file_content path="README.md">'))
	})

	it("should handle mention processing errors gracefully", async () => {
		const mockCommand = {
			name: "test",
			content: "Check @/README.md for details",
			source: "project" as const,
			filePath: ".roo/commands/test.md",
			description: "Test command with file reference",
		}

		vi.mocked(getCommand).mockResolvedValue(mockCommand)
		vi.mocked(parseMentions).mockRejectedValue(new Error("Failed to process mentions"))

		mockAskApproval.mockResolvedValue(true)

		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "test",
			},
			partial: false,
		}

		// Mock console.warn to verify it's called
		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Should log a warning when mention processing fails
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Failed to process mentions in slash command content:"),
		)

		// Should still return the original content when mention processing fails
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Check @/README.md for details"))

		consoleWarnSpy.mockRestore()
	})

	it("should process multiple file references in command content", async () => {
		const mockCommand = {
			name: "docs",
			content: "Review @/README.md and @/CONTRIBUTING.md for guidelines",
			source: "project" as const,
			filePath: ".roo/commands/docs.md",
			description: "Documentation command",
		}

		vi.mocked(getCommand).mockResolvedValue(mockCommand)
		vi.mocked(parseMentions).mockResolvedValue(
			"Review 'README.md' (see below for file content) and 'CONTRIBUTING.md' (see below for file content)\n\n" +
				'<file_content path="README.md">\n# README\n</file_content>\n\n' +
				'<file_content path="CONTRIBUTING.md">\n# Contributing\n</file_content>',
		)

		mockAskApproval.mockResolvedValue(true)

		const block = {
			type: "tool_use" as const,
			name: "run_slash_command" as const,
			params: {
				command: "docs",
			},
			partial: false,
		}

		await runSlashCommandTool(
			mockTask as Task,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify both files are included in the processed content
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining('<file_content path="README.md">'))
		expect(mockPushToolResult).toHaveBeenCalledWith(
			expect.stringContaining('<file_content path="CONTRIBUTING.md">'),
		)
	})
})
