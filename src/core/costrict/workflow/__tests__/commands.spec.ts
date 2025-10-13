/**
 * Tests for coworkflow commands functionality
 */

import * as vscode from "vscode"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
	registerCoworkflowCommands,
	setCommandHandlerDependencies,
	clearCommandHandlerDependencies,
	COWORKFLOW_COMMANDS,
	isCoworkflowDocument,
} from "../commands"
import { CoworkflowCodeLens } from "../types"
import { supportPrompt } from "../../../../shared/support-prompt"

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
}))

// Mock supportPrompt
vi.mock("../../../../shared/support-prompt", () => ({
	supportPrompt: {
		create: vi.fn((type: string, params: any) => `Mock prompt for ${type} with params: ${JSON.stringify(params)}`),
	},
}))

// Mock ClineProvider
const mockHandleWorkflowAction = vi.fn()
const mockClineProvider = {
	getInstance: vi.fn().mockResolvedValue({
		getCurrentTask: vi.fn().mockReturnValue({
			clineMessages: [],
			checkpointService: {
				isInitialized: true,
				git: { show: vi.fn() },
			},
		}), // 返回有效的 task 对象
	}),
	handleWorkflowAction: mockHandleWorkflowAction,
}

vi.mock("../../webview/ClineProvider", () => ({
	ClineProvider: {
		...mockClineProvider,
		handleWorkflowAction: mockHandleWorkflowAction, // 静态方法需要直接在类上定义
	},
}))

// Mock utils/path
vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/test"),
}))

// Mock SectionContentExtractor
vi.mock("./SectionContentExtractor", () => ({
	SectionContentExtractor: vi.fn().mockImplementation(() => ({
		extractContentForCodeLens: vi.fn().mockResolvedValue({
			success: true,
			content: "Test document content",
			type: "selection",
		}),
	})),
	createContentExtractionContext: vi.fn().mockReturnValue({}),
}))

// Mock path module
vi.mock("path", async (importOriginal) => {
	const actual = (await importOriginal()) as any
	return {
		...actual,
		default: {
			dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
			relative: vi.fn((from: string, to: string) => to.replace(from, "").replace(/^\//, "")),
			join: vi.fn((...paths: string[]) => paths.join("/")),
			basename: vi.fn((p: string) => {
				// 处理 Windows 路径（反斜杠）
				const normalizedPath = p.replace(/\\/g, "/")
				const parts = normalizedPath.split("/")
				return parts[parts.length - 1] || ""
			}),
			normalize: vi.fn((p: string) => p.replace(/\\/g, "/")),
			sep: "/",
		},
	}
})

describe("Coworkflow Commands", () => {
	let mockContext: vscode.ExtensionContext
	let mockCodeLens: CoworkflowCodeLens

	beforeEach(() => {
		vi.clearAllMocks()

		mockContext = {
			subscriptions: [],
		} as any

		mockCodeLens = {
			range: new vscode.Range(0, 0, 0, 10),
			command: {
				title: "Test Command",
				command: "test.command",
			},
			documentType: "requirements",
			actionType: "update",
			context: {
				sectionTitle: "Test Section",
				lineNumber: 0,
			},
		} as CoworkflowCodeLens

		// Mock active editor
		const mockDocument = {
			uri: vscode.Uri.file("/test/.cospec/requirements.md"),
			getText: vi.fn(() => "Test document content"),
			lineCount: 10,
		}

		const mockEditor = {
			document: mockDocument,
			selection: {
				isEmpty: false,
			},
		}

		vi.mocked(vscode.window).activeTextEditor = mockEditor as any
		vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue({
			uri: vscode.Uri.file("/test"),
		} as any)
	})

	afterEach(() => {
		clearCommandHandlerDependencies()
	})

	describe("registerCoworkflowCommands", () => {
		it("should register all coworkflow commands", () => {
			const disposables = registerCoworkflowCommands(mockContext)

			expect(disposables).toHaveLength(7)
			expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(7)

			// Verify all commands are registered
			expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
				expect.stringContaining(COWORKFLOW_COMMANDS.UPDATE_SECTION),
				expect.any(Function),
			)
			expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
				expect.stringContaining(COWORKFLOW_COMMANDS.RUN_TASK),
				expect.any(Function),
			)
			expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
				expect.stringContaining(COWORKFLOW_COMMANDS.RUN_ALL_TASKS),
				expect.any(Function),
			)
			expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
				expect.stringContaining(COWORKFLOW_COMMANDS.RETRY_TASK),
				expect.any(Function),
			)
		})

		it("should handle registration errors gracefully", () => {
			vi.mocked(vscode.commands.registerCommand).mockImplementationOnce(() => {
				throw new Error("Registration failed")
			})

			expect(() => registerCoworkflowCommands(mockContext)).toThrow("Registration failed")
		})
	})

	describe("handleRunTask", () => {
		beforeEach(() => {
			mockCodeLens.documentType = "tasks"
			mockCodeLens.actionType = "run"
			mockCodeLens.context = {
				taskId: "1.1",
				sectionTitle: "Test Task",
				lineNumber: 5,
			}
			const mockDocument = {
				uri: vscode.Uri.file("/test/.cospec/tasks.md"),
				getText: vi.fn(() => "Test document content"),
				lineCount: 10,
			}
			const mockEditor = {
				document: mockDocument,
				selection: {
					isEmpty: false,
				},
			}
			vi.mocked(vscode.window).activeTextEditor = mockEditor as any
		})

		it("should validate document type", async () => {
			mockCodeLens.documentType = "requirements"

			const disposables = registerCoworkflowCommands(mockContext)
			const registerCalls = vi.mocked(vscode.commands.registerCommand).mock.calls
			const runTaskCall = registerCalls.find((call) => call[0].includes(COWORKFLOW_COMMANDS.RUN_TASK))
			const handler = runTaskCall?.[1] as (codeLens: CoworkflowCodeLens) => Promise<void>

			await handler(mockCodeLens)

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining("Run task command requires a tasks document CodeLens"),
			)

			disposables.forEach((d) => d.dispose())
		})
	})

	describe("isCoworkflowDocument", () => {
		it("should return true for valid coworkflow documents", () => {
			const requirementsUri = vscode.Uri.file("/test/.cospec/requirements.md")
			const designUri = vscode.Uri.file("/test/.cospec/design.md")
			const tasksUri = vscode.Uri.file("/test/.cospec/tasks.md")

			expect(isCoworkflowDocument(requirementsUri.fsPath)).toBe(true)
			expect(isCoworkflowDocument(designUri.fsPath)).toBe(true)
			expect(isCoworkflowDocument(tasksUri.fsPath)).toBe(true)
		})

		it("should return false for invalid coworkflow documents", () => {
			const invalidUri1 = vscode.Uri.file("/test/requirements.md")
			const invalidUri2 = vscode.Uri.file("/test/.cospec/other.md")
			const invalidUri3 = vscode.Uri.file("/test/.cospec/requirements.txt")

			expect(isCoworkflowDocument(invalidUri1.fsPath)).toBe(false)
			expect(isCoworkflowDocument(invalidUri2.fsPath)).toBe(false)
			expect(isCoworkflowDocument(invalidUri3.fsPath)).toBe(false)
		})
	})

	describe("Command Handler Dependencies", () => {
		it("should set and clear dependencies correctly", () => {
			const mockDependencies = {
				codeLensProvider: { refresh: vi.fn() },
				decorationProvider: { refreshAll: vi.fn() },
				fileWatcher: { initialize: vi.fn() },
			}

			setCommandHandlerDependencies(mockDependencies)

			// Dependencies should be set (we can't directly test this without exposing internals)
			// But we can test that clearCommandHandlerDependencies doesn't throw
			expect(() => clearCommandHandlerDependencies()).not.toThrow()
		})
	})
})
