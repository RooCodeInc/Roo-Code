import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { documentSymbolsTool } from "../DocumentSymbolsTool"
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

describe("DocumentSymbolsTool", () => {
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
		const block: ToolUse<"document_symbols"> = {
			type: "tool_use" as const,
			name: "document_symbols" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "",
			},
		}

		await documentSymbolsTool.handle(mockTask as Task, block, mockCallbacks)

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(mockTask.recordToolError).toHaveBeenCalledWith("document_symbols")
	})

	it("should return document symbols (DocumentSymbol format)", async () => {
		const mockSymbols = [
			{
				name: "MyClass",
				kind: vscode.SymbolKind.Class,
				range: { start: { line: 0, character: 0 }, end: { line: 20, character: 1 } },
				children: [
					{
						name: "myMethod",
						kind: vscode.SymbolKind.Method,
						range: { start: { line: 5, character: 2 }, end: { line: 15, character: 3 } },
						children: [],
					},
				],
			},
			{
				name: "helperFunction",
				kind: vscode.SymbolKind.Function,
				range: { start: { line: 22, character: 0 }, end: { line: 30, character: 1 } },
				children: [],
			},
		]

		vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockSymbols as any)

		const block: ToolUse<"document_symbols"> = {
			type: "tool_use" as const,
			name: "document_symbols" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
			},
		}

		await documentSymbolsTool.handle(mockTask as Task, block, mockCallbacks)

		const result = JSON.parse(mockCallbacks.pushToolResult.mock.calls[0][0])
		expect(result).toHaveLength(2)
		expect(result[0].name).toBe("MyClass")
		expect(result[0].kind).toBe("Class")
		expect(result[0].line).toBe(1) // 0-based 0 => 1-based 1
		expect(result[0].endLine).toBe(21) // 0-based 20 => 1-based 21
		expect(result[0].children).toHaveLength(1)
		expect(result[0].children[0].name).toBe("myMethod")
		expect(result[1].name).toBe("helperFunction")
		expect(result[1].kind).toBe("Function")
	})

	it("should return document symbols (SymbolInformation format)", async () => {
		const mockSymbols = [
			{
				name: "myVar",
				kind: vscode.SymbolKind.Variable,
				location: {
					uri: { fsPath: "/test/project/src/test.ts", path: "/test/project/src/test.ts" },
					range: { start: { line: 0, character: 0 }, end: { line: 0, character: 20 } },
				},
			},
		]

		vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockSymbols as any)

		const block: ToolUse<"document_symbols"> = {
			type: "tool_use" as const,
			name: "document_symbols" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
			},
		}

		await documentSymbolsTool.handle(mockTask as Task, block, mockCallbacks)

		const result = JSON.parse(mockCallbacks.pushToolResult.mock.calls[0][0])
		expect(result).toHaveLength(1)
		expect(result[0].name).toBe("myVar")
		expect(result[0].kind).toBe("Variable")
	})

	it("should handle no symbols found", async () => {
		vi.mocked(vscode.commands.executeCommand).mockResolvedValue([] as any)

		const block: ToolUse<"document_symbols"> = {
			type: "tool_use" as const,
			name: "document_symbols" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
			},
		}

		await documentSymbolsTool.handle(mockTask as Task, block, mockCallbacks)

		expect(mockCallbacks.pushToolResult).toHaveBeenCalledWith(expect.stringContaining("No symbols found"))
	})
})
