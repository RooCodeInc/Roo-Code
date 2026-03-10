import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { findReferencesTool } from "../FindReferencesTool"
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

describe("FindReferencesTool", () => {
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
		const block: ToolUse<"find_references"> = {
			type: "tool_use" as const,
			name: "find_references" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "",
				line: 10,
				character: 5,
			},
		}

		await findReferencesTool.handle(mockTask as Task, block, mockCallbacks)

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(mockTask.recordToolError).toHaveBeenCalledWith("find_references")
	})

	it("should return references when found", async () => {
		const mockLocations = [
			{
				uri: { fsPath: "/test/project/src/a.ts", path: "/test/project/src/a.ts" },
				range: { start: { line: 9, character: 0 }, end: { line: 9, character: 10 } },
			},
			{
				uri: { fsPath: "/test/project/src/b.ts", path: "/test/project/src/b.ts" },
				range: { start: { line: 19, character: 5 }, end: { line: 19, character: 15 } },
			},
		]

		vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockLocations as any)

		const block: ToolUse<"find_references"> = {
			type: "tool_use" as const,
			name: "find_references" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
				line: 10,
				character: 5,
			},
		}

		await findReferencesTool.handle(mockTask as Task, block, mockCallbacks)

		const result = JSON.parse(mockCallbacks.pushToolResult.mock.calls[0][0])
		expect(result.results).toHaveLength(2)
		expect(result.totalCount).toBe(2)
		expect(result.truncated).toBeUndefined()
	})

	it("should truncate results when exceeding MAX_RESULTS", async () => {
		// Create 55 mock locations
		const mockLocations = Array.from({ length: 55 }, (_, i) => ({
			uri: { fsPath: `/test/project/src/file${i}.ts`, path: `/test/project/src/file${i}.ts` },
			range: { start: { line: i, character: 0 }, end: { line: i, character: 10 } },
		}))

		vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockLocations as any)

		const block: ToolUse<"find_references"> = {
			type: "tool_use" as const,
			name: "find_references" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
				line: 10,
				character: 5,
			},
		}

		await findReferencesTool.handle(mockTask as Task, block, mockCallbacks)

		const result = JSON.parse(mockCallbacks.pushToolResult.mock.calls[0][0])
		expect(result.results).toHaveLength(50)
		expect(result.totalCount).toBe(55)
		expect(result.truncated).toBe(true)
	})

	it("should handle no references found", async () => {
		vi.mocked(vscode.commands.executeCommand).mockResolvedValue([] as any)

		const block: ToolUse<"find_references"> = {
			type: "tool_use" as const,
			name: "find_references" as const,
			params: {},
			partial: false,
			nativeArgs: {
				path: "src/test.ts",
				line: 10,
				character: 5,
			},
		}

		await findReferencesTool.handle(mockTask as Task, block, mockCallbacks)

		expect(mockCallbacks.pushToolResult).toHaveBeenCalledWith(expect.stringContaining("No references found"))
	})
})
