import * as vscode from "vscode"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { CoworkflowDecorationProvider } from "../CoworkflowDecorationProvider"
import { TaskStatusType } from "../types"

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		createTextEditorDecorationType: vi.fn().mockImplementation((options: any) => ({
			dispose: vi.fn(),
			options,
		})),
		visibleTextEditors: [],
		createOutputChannel: vi.fn().mockImplementation(() => ({
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		})),
		onDidChangeVisibleTextEditors: vi.fn(),
		showErrorMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	workspace: {
		onDidChangeTextDocument: vi.fn(),
		onDidCloseTextDocument: vi.fn(),
	},
	Range: vi.fn().mockImplementation((startLine: number, startChar: number, endLine: number, endChar: number) => ({
		start: { line: startLine, character: startChar },
		end: { line: endLine, character: endChar },
	})),
	Uri: {
		file: vi.fn((path: string) => ({
			path,
			scheme: "file",
			authority: "",
			query: "",
			fragment: "",
			fsPath: path,
			with: vi.fn(),
			toString: () => path,
		})),
	},
	Disposable: {
		from: vi.fn(),
	},
}))

describe("CoworkflowDecorationProvider", () => {
	let decorationProvider: CoworkflowDecorationProvider
	let mockDocument: vscode.TextDocument
	let mockEditor: vscode.TextEditor

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create mock document
		mockDocument = {
			uri: vscode.Uri.file("/workspace/.cospec/tasks.md"),
			getText: vi.fn(),
			lineAt: vi.fn(),
			lineCount: 10,
			fileName: "tasks.md",
			isUntitled: false,
			languageId: "markdown",
			encoding: "utf8",
			version: 1,
			isDirty: false,
			isClosed: false,
			save: vi.fn(),
			validatePosition: vi.fn(),
			validateRange: vi.fn(),
			getWordRangeAtPosition: vi.fn(),
			offsetAt: vi.fn(),
			positionAt: vi.fn(),
		} as any

		// Create mock editor
		mockEditor = {
			document: mockDocument,
			setDecorations: vi.fn(),
		} as any

		// Mock visible editors
		;(vscode.window.visibleTextEditors as any) = [mockEditor]

		// Create decoration provider
		decorationProvider = new CoworkflowDecorationProvider()
	})

	afterEach(() => {
		decorationProvider.dispose()
	})

	describe("isTasksDocument", () => {
		it("应该正确识别 .cospec 目录下的 tasks.md 文件", () => {
			const result = decorationProvider["isTasksDocument"](mockDocument)
			expect(result).toBe(true)
		})

		it("应该拒绝非 tasks.md 文件", () => {
			const otherDocument = {
				...mockDocument,
				uri: vscode.Uri.file("/workspace/.cospec/other.md"),
			}
			const result = decorationProvider["isTasksDocument"](otherDocument)
			expect(result).toBe(false)
		})

		it("应该拒绝非 .cospec 目录下的文件", () => {
			const otherDocument = {
				...mockDocument,
				uri: vscode.Uri.file("/workspace/other/tasks.md"),
			}
			const result = decorationProvider["isTasksDocument"](otherDocument)
			expect(result).toBe(false)
		})
	})

	describe("updateDecorations", () => {
		it("应该正确解析和装饰任务", () => {
			const mockText = `
- [ ] Task 1
  - [ ] Subtask 1.1
  - [-] Subtask 1.2
- [x] Task 2
  - [x] Subtask 2.1
`
			vi.mocked(mockDocument.getText).mockReturnValue(mockText)

			decorationProvider.updateDecorations(mockDocument)

			// 验证装饰类型被创建
			expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalled()

			// 验证装饰被应用到编辑器
			expect(mockEditor.setDecorations).toHaveBeenCalled()
		})

		it("应该处理空文档", () => {
			vi.mocked(mockDocument.getText).mockReturnValue("")

			// 应该不会抛出错误
			expect(() => {
				decorationProvider.updateDecorations(mockDocument)
			}).not.toThrow()

			// 空文档不会调用 setDecorations，因为会被 isValidTasksDocument 过滤掉
			expect(mockEditor.setDecorations).not.toHaveBeenCalled()
		})
	})

	describe("parseHierarchicalTaskStatuses", () => {
		it("应该正确解析层级任务", () => {
			const mockText = `
- [ ] Task 1
  - [ ] Subtask 1.1
  - [-] Subtask 1.2
- [x] Task 2
  - [x] Subtask 2.1
`
			vi.mocked(mockDocument.getText).mockReturnValue(mockText)

			const tasks = decorationProvider.parseHierarchicalTaskStatuses(mockDocument)

			expect(tasks).toHaveLength(5) // 包括空行解析
			expect(tasks[0].text).toBe("Task 1")
			expect(tasks[0].hierarchyLevel).toBe(0)
			expect(tasks[0].status).toBe("not_started")

			expect(tasks[1].text).toBe("Subtask 1.1")
			expect(tasks[1].hierarchyLevel).toBe(1)
			expect(tasks[1].status).toBe("not_started")

			expect(tasks[2].text).toBe("Subtask 1.2")
			expect(tasks[2].hierarchyLevel).toBe(1)
			expect(tasks[2].status).toBe("in_progress")

			expect(tasks[3].text).toBe("Task 2")
			expect(tasks[3].hierarchyLevel).toBe(0)
			expect(tasks[3].status).toBe("completed")
		})

		it("应该处理带有子内容的任务", () => {
			const mockText = `
- [ ] Task 1
  This is a child content line
  Another child content line
  - [ ] Subtask 1.1
- [x] Task 2
`
			vi.mocked(mockDocument.getText).mockReturnValue(mockText)

			const tasks = decorationProvider.parseHierarchicalTaskStatuses(mockDocument)

			expect(tasks).toHaveLength(3)
			expect(tasks[0].text).toBe("Task 1")
			expect(tasks[0].childContentLines).toEqual([2, 3]) // 考虑空行，行号从0开始
			expect(tasks[1].text).toBe("Subtask 1.1")
			expect(tasks[1].hierarchyLevel).toBe(1)
		})
	})

	describe("HierarchyDecorationTypeManager", () => {
		it("应该正确创建装饰类型", () => {
			const typeManager = decorationProvider["hierarchyTypeManager"]

			const decorationType = typeManager.getDecorationType("not_started", 0)
			expect(decorationType).toBeDefined()

			const decorationType2 = typeManager.getDecorationType("in_progress", 1)
			expect(decorationType2).toBeDefined()

			const decorationType3 = typeManager.getDecorationType("completed", 2)
			expect(decorationType3).toBeDefined()
		})

		it("应该正确处理不存在的装饰类型", () => {
			const typeManager = decorationProvider["hierarchyTypeManager"]

			const decorationType = typeManager.getDecorationType("unknown_status" as TaskStatusType, 99)
			expect(decorationType).toBeUndefined()
		})
	})

	describe("HierarchyDetector", () => {
		it("应该正确检测层级深度", () => {
			const detector = decorationProvider["hierarchyDetector"]

			expect(detector.detectHierarchyLevel("- [ ] Task 1")).toBe(0)
			expect(detector.detectHierarchyLevel("  - [ ] Subtask 1")).toBe(1)
			expect(detector.detectHierarchyLevel("    - [ ] Subsubtask")).toBe(2)
			expect(detector.detectHierarchyLevel("\t- [ ] Tab indented task")).toBe(1)
			expect(detector.detectHierarchyLevel("Not a task line")).toBe(-1)
		})

		it("应该正确构建层级树", () => {
			const detector = decorationProvider["hierarchyDetector"]

			const mockTasks = [
				{
					hierarchyLevel: 0,
					line: 0,
					range: new vscode.Range(0, 0, 0, 10),
					status: "not_started" as TaskStatusType,
					text: "Task 1",
				},
				{
					hierarchyLevel: 1,
					line: 1,
					range: new vscode.Range(1, 0, 1, 15),
					status: "not_started" as TaskStatusType,
					text: "Subtask 1.1",
				},
				{
					hierarchyLevel: 1,
					line: 2,
					range: new vscode.Range(2, 0, 2, 15),
					status: "in_progress" as TaskStatusType,
					text: "Subtask 1.2",
				},
				{
					hierarchyLevel: 0,
					line: 3,
					range: new vscode.Range(3, 0, 3, 10),
					status: "completed" as TaskStatusType,
					text: "Task 2",
				},
			] as any

			const hierarchyTree = detector.buildHierarchyTree(mockTasks)

			expect(hierarchyTree).toHaveLength(2)
			expect(hierarchyTree[0].task.text).toBe("Task 1")
			expect(hierarchyTree[0].children).toHaveLength(2)
			expect(hierarchyTree[0].children[0].task.text).toBe("Subtask 1.1")
			expect(hierarchyTree[0].children[1].task.text).toBe("Subtask 1.2")
			expect(hierarchyTree[1].task.text).toBe("Task 2")
			expect(hierarchyTree[1].children).toHaveLength(0)
		})
	})

	describe("错误处理", () => {
		it("应该正确处理解析错误", () => {
			vi.mocked(mockDocument.getText).mockImplementation(() => {
				throw new Error("Mock error")
			})

			expect(() => {
				decorationProvider.updateDecorations(mockDocument)
			}).not.toThrow()
		})

		it("应该正确处理装饰应用错误", () => {
			const mockText = "- [ ] Task 1"
			vi.mocked(mockDocument.getText).mockReturnValue(mockText)

			vi.mocked(mockEditor.setDecorations).mockImplementation(() => {
				throw new Error("Mock decoration error")
			})

			expect(() => {
				decorationProvider.updateDecorations(mockDocument)
			}).not.toThrow()
		})
	})
})
