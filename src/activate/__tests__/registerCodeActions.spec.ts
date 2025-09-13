import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { registerCodeActions } from "../registerCodeActions"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { EditorUtils } from "../../integrations/editor/EditorUtils"

vi.mock("vscode", () => ({
	commands: {
		registerCommand: vi.fn(),
		executeCommand: vi.fn(),
	},
	ExtensionContext: vi.fn(),
	workspace: {
		workspaceFolders: undefined,
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue(true),
		}),
		onDidChangeConfiguration: vi.fn(),
		onDidChangeWorkspaceFolders: vi.fn(),
		onDidOpenTextDocument: vi.fn(),
		onDidCloseTextDocument: vi.fn(),
		onDidChangeTextDocument: vi.fn(),
	},
	env: {
		uriScheme: "vscode",
		machineId: "test-machine-id",
		sessionId: "test-session-id",
		language: "en",
		appName: "Visual Studio Code",
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		onDidChangeActiveTextEditor: vi.fn(),
		onDidChangeTextEditorSelection: vi.fn(),
		onDidChangeVisibleTextEditors: vi.fn(),
		activeTextEditor: undefined,
	},
	Uri: {
		file: vi.fn((path) => ({ fsPath: path, scheme: "file", path })),
		parse: vi.fn((str) => ({ fsPath: str, scheme: "file", path: str })),
	},
	Range: vi.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
		start: { line: startLine, character: startChar },
		end: { line: endLine, character: endChar },
	})),
	Position: vi.fn().mockImplementation((line, char) => ({ line, character: char })),
	EventEmitter: vi.fn().mockImplementation(() => ({
		fire: vi.fn(),
		event: vi.fn(),
		dispose: vi.fn(),
	})),
	Disposable: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
	})),
	ExtensionMode: {
		Development: 2,
		Production: 1,
		Test: 3,
	},
	version: "1.0.0",
}))

vi.mock("../../core/webview/ClineProvider")
vi.mock("../../integrations/editor/EditorUtils")

describe("registerCodeActions - Focus Input Improvement", () => {
	let mockContext: any
	let mockProvider: any
	let registerCommandSpy: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockContext = {
			subscriptions: {
				push: vi.fn(),
			},
		}

		mockProvider = {
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			isWebviewReady: vi.fn().mockReturnValue(true),
		}

		registerCommandSpy = vi.spyOn(vscode.commands, "registerCommand")
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("addToContext command", () => {
		it("should wait for provider to become available before sending focus message", async () => {
			// Setup: No provider initially available
			const getVisibleInstanceSpy = vi
				.spyOn(ClineProvider, "getVisibleInstance")
				.mockReturnValueOnce(undefined) // First call returns undefined
				.mockReturnValueOnce(undefined) // Second call still undefined (during wait)
				.mockReturnValueOnce(mockProvider) // Third call returns provider

			const executeCommandSpy = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined)

			// Register the code actions
			registerCodeActions(mockContext)

			// Get the registered command handler for addToContext
			const commandCall = registerCommandSpy.mock.calls.find(
				(call: any[]) => call[0] === "roo-cline.addToContext",
			)
			expect(commandCall).toBeDefined()

			const commandHandler = commandCall[1]

			// Mock editor context
			vi.spyOn(EditorUtils, "getEditorContext").mockReturnValue({
				filePath: "/test/file.ts",
				selectedText: "test code",
				startLine: 1,
				endLine: 5,
			})

			// Execute the command
			await commandHandler()

			// Verify the sidebar was focused
			expect(executeCommandSpy).toHaveBeenCalledWith("roo-cline.SidebarProvider.focus")

			// Verify provider was checked multiple times (polling)
			expect(getVisibleInstanceSpy).toHaveBeenCalledTimes(3)

			// Verify focus message was sent after provider became available
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "action",
				action: "focusInput",
			})
		})

		it("should check if webview is ready before sending focus message", async () => {
			// Setup: Provider is available but webview not ready initially
			mockProvider.isWebviewReady
				.mockReturnValueOnce(false) // First check - not ready
				.mockReturnValueOnce(true) // Second check - ready

			vi.spyOn(ClineProvider, "getVisibleInstance").mockReturnValue(mockProvider)

			// Register the code actions
			registerCodeActions(mockContext)

			// Get the registered command handler
			const commandCall = registerCommandSpy.mock.calls.find(
				(call: any[]) => call[0] === "roo-cline.addToContext",
			)
			const commandHandler = commandCall[1]

			// Mock editor context
			vi.spyOn(EditorUtils, "getEditorContext").mockReturnValue({
				filePath: "/test/file.ts",
				selectedText: "test code",
				startLine: 1,
				endLine: 5,
			})

			// Execute the command
			await commandHandler()

			// Verify webview readiness was checked
			expect(mockProvider.isWebviewReady).toHaveBeenCalled()

			// Verify message was sent only after webview was ready
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "action",
				action: "focusInput",
			})
		})

		it("should handle errors gracefully without breaking the main operation", async () => {
			// Setup: Provider throws error when posting message
			mockProvider.postMessageToWebview.mockRejectedValue(new Error("Webview error"))
			vi.spyOn(ClineProvider, "getVisibleInstance").mockReturnValue(mockProvider)

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Register the code actions
			registerCodeActions(mockContext)

			// Get the registered command handler
			const commandCall = registerCommandSpy.mock.calls.find(
				(call: any[]) => call[0] === "roo-cline.addToContext",
			)
			const commandHandler = commandCall[1]

			// Mock editor context
			vi.spyOn(EditorUtils, "getEditorContext").mockReturnValue({
				filePath: "/test/file.ts",
				selectedText: "test code",
				startLine: 1,
				endLine: 5,
			})

			// Execute the command - should not throw
			await expect(commandHandler()).resolves.not.toThrow()

			// Verify error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to focus input field:", expect.any(Error))

			consoleErrorSpy.mockRestore()
		})

		it("should not attempt to focus if no provider becomes available", async () => {
			// Setup: No provider ever becomes available
			vi.spyOn(ClineProvider, "getVisibleInstance").mockReturnValue(undefined)

			const executeCommandSpy = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined)

			// Register the code actions
			registerCodeActions(mockContext)

			// Get the registered command handler
			const commandCall = registerCommandSpy.mock.calls.find(
				(call: any[]) => call[0] === "roo-cline.addToContext",
			)
			const commandHandler = commandCall[1]

			// Mock editor context
			vi.spyOn(EditorUtils, "getEditorContext").mockReturnValue({
				filePath: "/test/file.ts",
				selectedText: "test code",
				startLine: 1,
				endLine: 5,
			})

			// Execute the command
			await commandHandler()

			// Verify sidebar focus was attempted
			expect(executeCommandSpy).toHaveBeenCalledWith("roo-cline.SidebarProvider.focus")

			// Verify no message was sent (since no provider available)
			expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
		})

		it("should immediately send focus message if provider is already available and ready", async () => {
			// Setup: Provider is immediately available and ready
			vi.spyOn(ClineProvider, "getVisibleInstance").mockReturnValue(mockProvider)
			mockProvider.isWebviewReady.mockReturnValue(true)

			const executeCommandSpy = vi.spyOn(vscode.commands, "executeCommand")

			// Register the code actions
			registerCodeActions(mockContext)

			// Get the registered command handler
			const commandCall = registerCommandSpy.mock.calls.find(
				(call: any[]) => call[0] === "roo-cline.addToContext",
			)
			const commandHandler = commandCall[1]

			// Mock editor context
			vi.spyOn(EditorUtils, "getEditorContext").mockReturnValue({
				filePath: "/test/file.ts",
				selectedText: "test code",
				startLine: 1,
				endLine: 5,
			})

			// Execute the command
			await commandHandler()

			// Verify no sidebar focus was needed
			expect(executeCommandSpy).not.toHaveBeenCalledWith("roo-cline.SidebarProvider.focus")

			// Verify focus message was sent immediately
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "action",
				action: "focusInput",
			})
		})
	})

	describe("other commands", () => {
		it("should not attempt to focus input for non-addToContext commands", async () => {
			vi.spyOn(ClineProvider, "getVisibleInstance").mockReturnValue(mockProvider)

			// Register the code actions
			registerCodeActions(mockContext)

			// Test other commands
			const otherCommands = ["roo-cline.explainCode", "roo-cline.fixCode", "roo-cline.improveCode"]

			for (const commandName of otherCommands) {
				const commandCall = registerCommandSpy.mock.calls.find((call: any[]) => call[0] === commandName)
				expect(commandCall).toBeDefined()

				const commandHandler = commandCall[1]

				// Mock editor context
				vi.spyOn(EditorUtils, "getEditorContext").mockReturnValue({
					filePath: "/test/file.ts",
					selectedText: "test code",
					startLine: 1,
					endLine: 5,
				})

				// Execute the command
				await commandHandler()

				// Verify no focus message was sent
				expect(mockProvider.postMessageToWebview).not.toHaveBeenCalledWith({
					type: "action",
					action: "focusInput",
				})
			}
		})
	})
})
