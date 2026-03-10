import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { goToDefinitionTool } from "../GoToDefinitionTool"
import { Task } from "../../task/Task"
import type { ToolUse } from "../../../shared/tools"

vi.mock("vscode", () => {
	const SymbolKind = {
		File: 0,
		Module: 1,
		Namespace: 2,
		Package: 3,
		Class: 4,
		Method: 5,
		Property: 6,
		Field: 7,
		Constructor: 8,
		Enum: 9,
		Interface: 10,
		Function: 11,
		Variable: 12,
		Constant: 13,
		String: 14,
		Number: 15,
		Boolean: 16,
		Array: 17,
		Object: 18,
		Key: 19,
		Null: 20,
		EnumMember: 21,
		Struct: 22,
		Event: 23,
		Operator: 24,
		TypeParameter: 25,
	}
	return {
		Uri: {
			file: vi.fn((path: string) => ({ fsPath: path, path, scheme: "file" })),
		},
		Position: vi.fn((line: number, character: number) => ({ line, character })),
		commands: {
			executeCommand: vi.fn(),
		},
		workspace: {
			asRelativePath: vi.fn((uri: any) => {
				const p = typeof uri === "string" ? uri : uri.path || uri.fsPath
				return p.replace(/^\/test\/project\//, "")
			}),
		},
		SymbolKind,
	}
})

describe("GoToDefinitionTool", () => {
	let mockTask: any
	let mockCallbacks: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockTask = {
			consecutiveMistakeCount: 0,
			didToolFailInCurrentTurn: false,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
			ask: vi.fn().mockResolvedValue({}),
			cwd: "/test/project",
		}

		mockCallbacks = {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: vi.fn(),
			pushToolResult: vi.fn(),
		}
	})

	it("should handle missing path parameter", async () => {
		const block: ToolUse<"go_to_definition"> = {
			type: "tool_use" as const,
			name: "go_to_definition" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "",
				line: 10,
				character: 5,
			},
		}

		await goToDefinitionTool.handle(mockTask as Task, block, mockCallbacks)

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(mockTask.recordToolError).toHaveBeenCalledWith("go_to_definition")
		expect(mockCallbacks.pushToolResult).toHaveBeenCalledWith("Missing parameter error")
	})

	it("should handle missing line parameter", async () => {
		const block: ToolUse<"go_to_definition"> = {
			type: "tool_use" as const,
			name: "go_to_definition" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
				line: undefined as any,
				character: 5,
			},
		}

		await goToDefinitionTool.handle(mockTask as Task, block, mockCallbacks)

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(mockTask.recordToolError).toHaveBeenCalledWith("go_to_definition")
	})

	it("should return definitions when found", async () => {
		const mockLocations = [
			{
				uri: { fsPath: "/test/project/src/other.ts", path: "/test/project/src/other.ts" },
				range: {
					start: { line: 9, character: 0 },
					end: { line: 9, character: 20 },
				},
			},
		]

		vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockLocations as any)

		const block: ToolUse<"go_to_definition"> = {
			type: "tool_use" as const,
			name: "go_to_definition" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
				line: 10,
				character: 5,
			},
		}

		await goToDefinitionTool.handle(mockTask as Task, block, mockCallbacks)

		expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
			"vscode.executeDefinitionProvider",
			expect.anything(),
			expect.anything(),
		)
		expect(mockCallbacks.askApproval).toHaveBeenCalled()
		expect(mockCallbacks.pushToolResult).toHaveBeenCalled()

		const result = JSON.parse(mockCallbacks.pushToolResult.mock.calls[0][0])
		expect(result).toHaveLength(1)
		expect(result[0].line).toBe(10)
		expect(result[0].character).toBe(0)
	})

	it("should handle no definitions found", async () => {
		vi.mocked(vscode.commands.executeCommand).mockResolvedValue([] as any)

		const block: ToolUse<"go_to_definition"> = {
			type: "tool_use" as const,
			name: "go_to_definition" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
				line: 10,
				character: 5,
			},
		}

		await goToDefinitionTool.handle(mockTask as Task, block, mockCallbacks)

		expect(mockCallbacks.pushToolResult).toHaveBeenCalledWith(expect.stringContaining("No definition found"))
	})

	it("should handle LocationLink results", async () => {
		const mockLocations = [
			{
				targetUri: { fsPath: "/test/project/src/other.ts", path: "/test/project/src/other.ts" },
				targetRange: {
					start: { line: 4, character: 0 },
					end: { line: 4, character: 15 },
				},
			},
		]

		vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockLocations as any)

		const block: ToolUse<"go_to_definition"> = {
			type: "tool_use" as const,
			name: "go_to_definition" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
				line: 10,
				character: 5,
			},
		}

		await goToDefinitionTool.handle(mockTask as Task, block, mockCallbacks)

		const result = JSON.parse(mockCallbacks.pushToolResult.mock.calls[0][0])
		expect(result).toHaveLength(1)
		expect(result[0].line).toBe(5) // 0-based 4 => 1-based 5
	})

	it("should not push result when approval is denied", async () => {
		const mockLocations = [
			{
				uri: { fsPath: "/test/project/src/other.ts", path: "/test/project/src/other.ts" },
				range: {
					start: { line: 9, character: 0 },
					end: { line: 9, character: 20 },
				},
			},
		]

		vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockLocations as any)
		mockCallbacks.askApproval.mockResolvedValue(false)

		const block: ToolUse<"go_to_definition"> = {
			type: "tool_use" as const,
			name: "go_to_definition" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
				line: 10,
				character: 5,
			},
		}

		await goToDefinitionTool.handle(mockTask as Task, block, mockCallbacks)

		expect(mockCallbacks.pushToolResult).not.toHaveBeenCalled()
	})
})
