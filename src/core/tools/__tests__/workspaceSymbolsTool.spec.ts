import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { workspaceSymbolsTool } from "../WorkspaceSymbolsTool"
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

describe("WorkspaceSymbolsTool", () => {
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

	it("should handle missing query parameter", async () => {
		const block: ToolUse<"workspace_symbols"> = {
			type: "tool_use" as const,
			name: "workspace_symbols" as const,
			params: {},
			partial: false,
			nativeArgs: {
				query: "",
			},
		}

		await workspaceSymbolsTool.handle(mockTask as Task, block, mockCallbacks)

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(mockTask.recordToolError).toHaveBeenCalledWith("workspace_symbols")
	})

	it("should return symbols when found", async () => {
		const mockSymbols = [
			{
				name: "UserService",
				kind: vscode.SymbolKind.Class,
				containerName: "",
				location: {
					uri: { fsPath: "/test/project/src/services/user.ts", path: "/test/project/src/services/user.ts" },
					range: { start: { line: 4, character: 0 }, end: { line: 50, character: 1 } },
				},
			},
			{
				name: "getUser",
				kind: vscode.SymbolKind.Function,
				containerName: "UserService",
				location: {
					uri: { fsPath: "/test/project/src/services/user.ts", path: "/test/project/src/services/user.ts" },
					range: { start: { line: 10, character: 2 }, end: { line: 20, character: 3 } },
				},
			},
		]

		vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockSymbols as any)

		const block: ToolUse<"workspace_symbols"> = {
			type: "tool_use" as const,
			name: "workspace_symbols" as const,
			params: {},
			partial: false,
			nativeArgs: {
				query: "User",
			},
		}

		await workspaceSymbolsTool.handle(mockTask as Task, block, mockCallbacks)

		const result = JSON.parse(mockCallbacks.pushToolResult.mock.calls[0][0])
		expect(result.results).toHaveLength(2)
		expect(result.results[0].name).toBe("UserService")
		expect(result.results[0].kind).toBe("Class")
		expect(result.results[0].line).toBe(5) // 0-based 4 => 1-based 5
		expect(result.results[1].containerName).toBe("UserService")
	})

	it("should handle no symbols found", async () => {
		vi.mocked(vscode.commands.executeCommand).mockResolvedValue([] as any)

		const block: ToolUse<"workspace_symbols"> = {
			type: "tool_use" as const,
			name: "workspace_symbols" as const,
			params: {},
			partial: false,
			nativeArgs: {
				query: "NonExistent",
			},
		}

		await workspaceSymbolsTool.handle(mockTask as Task, block, mockCallbacks)

		expect(mockCallbacks.pushToolResult).toHaveBeenCalledWith(expect.stringContaining("No workspace symbols found"))
	})
})
