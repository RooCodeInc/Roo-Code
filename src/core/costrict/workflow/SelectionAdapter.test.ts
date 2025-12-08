import { describe, it, expect, vi, beforeEach } from "vitest"
import { SelectionAdapter } from "./SelectionAdapter"
import * as vscode from "vscode"

// Mock vscode 模块
vi.mock("vscode", async () => {
	const actual = await vi.importActual("vscode")
	return {
		...actual,
		window: {
			activeTextEditor: undefined,
		},
		env: {
			machineId: "test-machine-id",
		},
		Selection: vi.fn(),
		Position: vi.fn(),
		Range: vi.fn(),
	}
})

// Mock platform 模块
vi.mock("../../../utils/platform", () => ({
	isJetbrainsPlatform: vi.fn(() => true),
}))

describe("SelectionAdapter", () => {
	const mockJetbrainsArgs = [
		[
			{
				filePath: "/test/file.md",
				documentType: "tasks",
				actionType: "run",
				lineNumber: 5,
				selectedText: "JetBrains selected text",
			},
		],
	]

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getSelectedText", () => {
		it("应该从 JetBrains 参数中提取选中文本", () => {
			const selectedText = SelectionAdapter.getSelectedText(mockJetbrainsArgs)
			expect(selectedText).toBe("JetBrains selected text")
		})

		it("应该处理无效的参数", () => {
			const selectedText = SelectionAdapter.getSelectedText(undefined)
			expect(selectedText).toBeUndefined()
		})
	})

	describe("hasSelection", () => {
		it("应该检测到有选中内容", () => {
			const hasSelection = SelectionAdapter.hasSelection(mockJetbrainsArgs)
			expect(hasSelection).toBe(true)
		})

		it("应该处理空选中文本", () => {
			const emptyArgs = [
				[
					{
						filePath: "/test/file.md",
						documentType: "tasks",
						actionType: "run",
						lineNumber: 5,
						selectedText: "",
					},
				],
			]
			const hasSelection = SelectionAdapter.hasSelection(emptyArgs)
			expect(hasSelection).toBe(false)
		})
	})

	describe("getSelectionRange", () => {
		it("应该返回选择范围", () => {
			const range = SelectionAdapter.getSelectionRange(mockJetbrainsArgs)
			expect(range).toBeDefined()
		})
	})

	describe("getSelection", () => {
		it("应该重建 selection 对象", () => {
			const selection = SelectionAdapter.getSelection(mockJetbrainsArgs)
			expect(selection).toBeDefined()
		})

		it("应该处理基于行范围的 selection", () => {
			const lineRangeArgs = [
				[
					{
						filePath: "/test/file.md",
						documentType: "tasks",
						actionType: "run",
						lineNumber: 5,
						startLine: 3,
						endLine: 7,
						selectedText: "multi line text",
					},
				],
			]
			const selection = SelectionAdapter.getSelection(lineRangeArgs)
			expect(selection).toBeDefined()
		})
	})
})
