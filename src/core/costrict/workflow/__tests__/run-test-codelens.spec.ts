/**
 * 测试新添加的 "Run test" CodeLens 功能
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { CoworkflowCodeLensProvider } from "../CoworkflowCodeLensProvider"
import { COWORKFLOW_COMMANDS } from "../commands"
import { CoworkflowActionType } from "../types"

// Mock vscode module
vi.mock("vscode", () => ({
	commands: {
		registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
		executeCommand: vi.fn(),
	},
	window: {
		showInformationMessage: vi.fn().mockResolvedValue("Execute"),
		showWarningMessage: vi.fn().mockResolvedValue("Retry"),
		showErrorMessage: vi.fn(),
		activeTextEditor: undefined,
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		})),
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
	},
	workspace: {
		getWorkspaceFolder: vi.fn(),
		createFileSystemWatcher: vi.fn(() => ({
			onDidChange: vi.fn(),
			onDidCreate: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path, path })),
	},
	Range: vi.fn((start, end) => ({ start, end })),
	Selection: vi.fn(),
	TextEditorRevealType: {
		InCenter: 1,
	},
	env: {
		uriScheme: "vscode",
	},
	RelativePattern: vi.fn((base, pattern) => ({ base, pattern })),
	EventEmitter: vi.fn().mockImplementation(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
	Disposable: {
		from: vi.fn(),
	},
	CodeLens: vi.fn().mockImplementation((range, command) => ({
		range,
		command,
		isResolved: true,
	})),
}))

describe("Run test CodeLens 功能测试", () => {
	let codeLensProvider: CoworkflowCodeLensProvider
	let mockDocument: vscode.TextDocument

	beforeEach(() => {
		// 重置所有模拟
		vi.clearAllMocks()

		// 创建 CodeLensProvider 实例
		codeLensProvider = new CoworkflowCodeLensProvider()

		// 创建模拟文档
		mockDocument = {
			uri: vscode.Uri.file("/workspace/.cospec/tasks.md"),
			getText: () => `# 任务规划

- [ ] 1. 实现用户认证功能
- [x] 2. 设计数据库模型
- [-] 3. 编写单元测试`,
			lineCount: 5,
			fileName: "tasks.md",
			isUntitled: false,
			languageId: "markdown",
			version: 1,
			isDirty: false,
			isClosed: false,
			save: vi.fn(),
			validatePosition: vi.fn(),
			validateRange: vi.fn(),
			getWordRangeAtPosition: vi.fn(),
			offsetAt: vi.fn(),
			positionAt: vi.fn(),
			lineAt: vi.fn(),
		} as any
	})

	describe("CoworkflowActionType 类型定义", () => {
		it("应该包含 'run_test' 动作类型", () => {
			// 验证 CoworkflowActionType 包含 run_test
			const actionType: CoworkflowActionType = "run_test"
			expect(actionType).toBe("run_test")
		})

		it("应该支持所有已知的动作类型", () => {
			const validActionTypes: CoworkflowActionType[] = [
				"update",
				"run",
				"retry",
				"loading",
				"run_all",
				"run_test",
			]

			validActionTypes.forEach((actionType) => {
				expect(typeof actionType).toBe("string")
			})
		})
	})

	describe("CoworkflowCodeLensProvider", () => {
		it("应该为任务生成包含 'run_test' 的 CodeLens", async () => {
			// 检查文档类型
			const documentType = (codeLensProvider as any).getDocumentType(mockDocument.uri)
			console.log("Document type:", documentType)
			expect(documentType).toBe("tasks")

			// 检查文档是否有效
			const isValid = (codeLensProvider as any).isValidDocument(mockDocument)
			console.log("Is valid document:", isValid)
			expect(isValid).toBe(true)

			// 检查文档内容
			const text = mockDocument.getText()
			console.log("Document text:", text)
			console.log("Document lines:", text.split("\n"))

			// 直接调用 provideTasksCodeLenses 方法
			const tasksCodeLenses = (codeLensProvider as any).provideTasksCodeLenses(mockDocument)
			console.log("Tasks CodeLenses returned:", JSON.stringify(tasksCodeLenses, null, 2))
			console.log("Tasks CodeLenses length:", tasksCodeLenses?.length)

			const codeLenses = await codeLensProvider.provideCodeLenses(mockDocument, {} as any)
			console.log("CodeLenses returned:", JSON.stringify(codeLenses, null, 2))
			console.log("CodeLenses length:", codeLenses?.length)

			// 验证返回了 CodeLens
			expect(codeLenses).toBeDefined()
			expect(codeLenses?.length).toBeGreaterThan(0)

			// 验证至少有一个 CodeLens 包含 run_test 动作
			const hasRunTestCodeLens = codeLenses?.some((codeLens: any) => codeLens.actionType === "run_test")
			expect(hasRunTestCodeLens).toBe(true)
		})

		it("应该为第一个任务生成 'run_test' CodeLens", async () => {
			const codeLenses = await codeLensProvider.provideCodeLenses(mockDocument, {} as any)

			// 找到第一个任务的 run_test CodeLens
			const firstTaskRunTestCodeLens = codeLenses?.find((codeLens: any) => {
				const context = codeLens.context
				return context?.lineNumber === 2 && codeLens.actionType === "run_test" // 第一个任务在第3行（0-based）
			})

			expect(firstTaskRunTestCodeLens).toBeDefined()
			expect((firstTaskRunTestCodeLens as any).actionType).toBe("run_test")
		})

		it("应该正确解析 'run_test' CodeLens", async () => {
			const codeLenses = await codeLensProvider.provideCodeLenses(mockDocument, {} as any)
			const runTestCodeLens = codeLenses?.find((codeLens: any) => codeLens.actionType === "run_test")

			if (runTestCodeLens) {
				const resolvedCodeLens = await codeLensProvider.resolveCodeLens(runTestCodeLens, {} as any)

				expect(resolvedCodeLens).toBeDefined()
				expect(resolvedCodeLens?.command).toBeDefined()
				expect(resolvedCodeLens?.command?.title).toBe("$(beaker) Generate Test Case")
				expect(resolvedCodeLens?.command?.command).toContain("coworkflow.runTest")
			}
		})
	})

	describe("命令注册", () => {
		it("应该注册 RUN_TEST 命令", () => {
			expect(COWORKFLOW_COMMANDS.RUN_TEST).toBe("coworkflow.runTest")
		})

		it("命令ID 应该是唯一的", () => {
			const commandValues = Object.values(COWORKFLOW_COMMANDS)
			const uniqueCommands = new Set(commandValues)

			expect(uniqueCommands.size).toBe(commandValues.length)
		})
	})

	describe("CodeLens 命令处理", () => {
		it("应该为 'run_test' 动作返回正确的命令ID", () => {
			// 使用反射访问私有方法进行测试
			const getCommandId = (codeLensProvider as any).getCommandId.bind(codeLensProvider)

			const commandId = getCommandId("run_test" as CoworkflowActionType)
			expect(commandId).toContain("coworkflow.runTest")
		})

		it("应该为 'run_test' 动作返回正确的标题", () => {
			// 使用反射访问私有方法进行测试
			const getActionTitle = (codeLensProvider as any).getActionTitle.bind(codeLensProvider)

			const title = getActionTitle("run_test" as CoworkflowActionType)
			expect(title).toBe("$(beaker) Generate Test Case")
		})
	})

	describe("错误处理", () => {
		it("应该处理无效的文档类型", async () => {
			const invalidDocument = {
				...mockDocument,
				uri: vscode.Uri.file("/workspace/.cospec/invalid.md"),
			} as any

			const codeLenses = await codeLensProvider.provideCodeLenses(invalidDocument, {} as any)
			expect(codeLenses).toEqual([])
		})

		it("应该处理空的文档内容", async () => {
			const emptyDocument = {
				...mockDocument,
				getText: () => "",
			} as any

			const codeLenses = await codeLensProvider.provideCodeLenses(emptyDocument, {} as any)
			// 应该返回 fallback CodeLens 而不是抛出错误
			expect(codeLenses).toBeDefined()
		})
	})
})
