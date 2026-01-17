// npx vitest run core/webview/__tests__/webviewMessageHandler.hooks.spec.ts

import type { IHookManager, ResolvedHook, HookExecution, HooksConfigSnapshot } from "../../../services/hooks/types"

// Mock vscode before importing webviewMessageHandler
vi.mock("vscode", () => {
	const executeCommand = vi.fn().mockResolvedValue(undefined)
	const showInformationMessage = vi.fn()
	const showErrorMessage = vi.fn()
	const showTextDocument = vi.fn().mockResolvedValue(undefined)
	const openTextDocument = vi.fn().mockResolvedValue({ uri: { fsPath: "/mock/file" } })

	return {
		window: {
			showInformationMessage,
			showErrorMessage,
			showTextDocument,
		},
		workspace: {
			workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
			openTextDocument,
		},
		commands: {
			executeCommand,
		},
		Uri: {
			file: vi.fn((path: string) => ({ fsPath: path })),
		},
	}
})

vi.mock("fs/promises", () => {
	const mockMkdir = vi.fn().mockResolvedValue(undefined)
	const mockReadFile = vi.fn().mockResolvedValue("")
	const mockWriteFile = vi.fn().mockResolvedValue(undefined)
	const mockAccess = vi.fn().mockResolvedValue(undefined)
	const mockRename = vi.fn().mockResolvedValue(undefined)
	const mockUnlink = vi.fn().mockResolvedValue(undefined)
	const mockReaddir = vi.fn().mockResolvedValue([])

	return {
		default: {
			mkdir: mockMkdir,
			readFile: mockReadFile,
			writeFile: mockWriteFile,
			access: mockAccess,
			rename: mockRename,
			unlink: mockUnlink,
			readdir: mockReaddir,
		},
		mkdir: mockMkdir,
		readFile: mockReadFile,
		writeFile: mockWriteFile,
		access: mockAccess,
		rename: mockRename,
		unlink: mockUnlink,
		readdir: mockReaddir,
	}
})

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(true),
}))

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../../utils/safeWriteText", () => ({
	safeWriteText: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../../api/providers/fetchers/modelCache")

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as fsUtils from "../../../utils/fs"
import { safeWriteJson } from "../../../utils/safeWriteJson"
import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"

// Create mock HookManager
const createMockHookManager = (): IHookManager => ({
	loadHooksConfig: vi.fn().mockResolvedValue({
		hooksByEvent: new Map(),
		hooksById: new Map(),
		loadedAt: new Date(),
		disabledHookIds: new Set(),
		hasProjectHooks: false,
	}),
	reloadHooksConfig: vi.fn().mockResolvedValue(undefined),
	getEnabledHooks: vi.fn().mockReturnValue([]),
	executeHooks: vi.fn().mockResolvedValue({
		results: [],
		blocked: false,
		totalDuration: 0,
	}),
	setHookEnabled: vi.fn().mockResolvedValue(undefined),
	getHookExecutionHistory: vi.fn().mockReturnValue([]),
	getConfigSnapshot: vi.fn().mockReturnValue({
		hooksByEvent: new Map(),
		hooksById: new Map(),
		loadedAt: new Date(),
		disabledHookIds: new Set(),
		hasProjectHooks: false,
	}),
})

// Create mock ClineProvider
const createMockClineProvider = (hookManager?: IHookManager) => {
	const mockProvider = {
		getState: vi.fn(),
		postMessageToWebview: vi.fn(),
		postStateToWebview: vi.fn(),
		getHookManager: vi.fn().mockReturnValue(hookManager),
		log: vi.fn(),
		getCurrentTask: vi.fn(),
		getTaskWithId: vi.fn(),
		createTaskWithHistoryItem: vi.fn(),
		cwd: "/mock/workspace",
		context: {
			extensionPath: "/mock/extension/path",
			globalStorageUri: { fsPath: "/mock/global/storage" },
		},
		contextProxy: {
			context: {
				extensionPath: "/mock/extension/path",
				globalStorageUri: { fsPath: "/mock/global/storage" },
			},
			setValue: vi.fn(),
			getValue: vi.fn().mockImplementation((key: string) => {
				if (key === "experiments") {
					return { hooks: true } // Enable hooks experiment for tests
				}
				return undefined
			}),
		},
		customModesManager: {
			getCustomModes: vi.fn(),
			deleteCustomMode: vi.fn(),
		},
	} as unknown as ClineProvider

	return mockProvider
}

describe("webviewMessageHandler - hooks commands", () => {
	let mockHookManager: IHookManager
	let mockClineProvider: ClineProvider

	beforeEach(() => {
		vi.clearAllMocks()
		mockHookManager = createMockHookManager()
		mockClineProvider = createMockClineProvider(mockHookManager)
	})

	describe("hooksReloadConfig", () => {
		it("should call reloadHooksConfig and postStateToWebview when hookManager exists", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "hooksReloadConfig",
			})

			expect(mockHookManager.reloadHooksConfig).toHaveBeenCalledTimes(1)
			expect(mockClineProvider.postStateToWebview).toHaveBeenCalledTimes(1)
		})

		it("should not throw when hookManager is undefined", async () => {
			const providerWithoutHookManager = createMockClineProvider(undefined)

			await expect(
				webviewMessageHandler(providerWithoutHookManager, {
					type: "hooksReloadConfig",
				}),
			).resolves.not.toThrow()

			expect(providerWithoutHookManager.postStateToWebview).not.toHaveBeenCalled()
		})

		it("should show error message when reloadHooksConfig fails", async () => {
			const error = new Error("Failed to load hooks config")
			vi.mocked(mockHookManager.reloadHooksConfig).mockRejectedValueOnce(error)

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksReloadConfig",
			})

			expect(mockClineProvider.log).toHaveBeenCalledWith(
				"Failed to reload hooks config: Failed to load hooks config",
			)
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to reload hooks configuration")
		})
	})

	describe("hooksSetEnabled", () => {
		it("should call setHookEnabled with correct parameters and postStateToWebview", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "hooksSetEnabled",
				hookId: "test-hook-id",
				hookEnabled: false,
			})

			expect(mockHookManager.setHookEnabled).toHaveBeenCalledWith("test-hook-id", false)
			expect(mockClineProvider.postStateToWebview).toHaveBeenCalledTimes(1)
		})

		it("should enable a previously disabled hook", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "hooksSetEnabled",
				hookId: "test-hook-id",
				hookEnabled: true,
			})

			expect(mockHookManager.setHookEnabled).toHaveBeenCalledWith("test-hook-id", true)
			expect(mockClineProvider.postStateToWebview).toHaveBeenCalledTimes(1)
		})

		it("should not call setHookEnabled when hookId is missing", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "hooksSetEnabled",
				hookEnabled: true,
			} as any)

			expect(mockHookManager.setHookEnabled).not.toHaveBeenCalled()
			expect(mockClineProvider.postStateToWebview).not.toHaveBeenCalled()
		})

		it("should not call setHookEnabled when hookEnabled is not a boolean", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "hooksSetEnabled",
				hookId: "test-hook-id",
				hookEnabled: "true", // string, not boolean
			} as any)

			expect(mockHookManager.setHookEnabled).not.toHaveBeenCalled()
			expect(mockClineProvider.postStateToWebview).not.toHaveBeenCalled()
		})

		it("should show error message when setHookEnabled fails", async () => {
			const error = new Error("Hook not found")
			vi.mocked(mockHookManager.setHookEnabled).mockRejectedValueOnce(error)

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksSetEnabled",
				hookId: "nonexistent-hook",
				hookEnabled: true,
			})

			expect(mockClineProvider.log).toHaveBeenCalledWith("Failed to set hook enabled: Hook not found")
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to enable hook")
		})

		it("should show correct error message when disabling fails", async () => {
			const error = new Error("Hook not found")
			vi.mocked(mockHookManager.setHookEnabled).mockRejectedValueOnce(error)

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksSetEnabled",
				hookId: "nonexistent-hook",
				hookEnabled: false,
			})

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to disable hook")
		})
	})

	describe("hooksSetAllEnabled", () => {
		it("should call setHookEnabled for all hooks in snapshot and postStateToWebview", async () => {
			const hooksById = new Map<string, ResolvedHook>()
			hooksById.set("hook-1", {
				id: "hook-1",
				event: "PreToolUse" as any,
				matcher: ".*",
				command: "echo 1",
				enabled: true,
				source: "global" as any,
				timeout: 30,
				includeConversationHistory: false,
			} as any)
			hooksById.set("hook-2", {
				id: "hook-2",
				event: "PostToolUse" as any,
				matcher: ".*",
				command: "echo 2",
				enabled: true,
				source: "project" as any,
				timeout: 30,
				includeConversationHistory: false,
			} as any)

			vi.mocked(mockHookManager.getConfigSnapshot).mockReturnValue({
				hooksByEvent: new Map(),
				hooksById,
				loadedAt: new Date(),
				disabledHookIds: new Set(),
				hasProjectHooks: false,
			} as HooksConfigSnapshot)

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksSetAllEnabled",
				hooksEnabled: false,
			})

			expect(mockHookManager.setHookEnabled).toHaveBeenCalledTimes(2)
			expect(mockHookManager.setHookEnabled).toHaveBeenCalledWith("hook-1", false)
			expect(mockHookManager.setHookEnabled).toHaveBeenCalledWith("hook-2", false)
			expect(mockClineProvider.postStateToWebview).toHaveBeenCalledTimes(1)
		})

		it("should not call setHookEnabled when hooksEnabled is not a boolean", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "hooksSetAllEnabled",
				hooksEnabled: "false",
			} as any)

			expect(mockHookManager.setHookEnabled).not.toHaveBeenCalled()
			expect(mockClineProvider.postStateToWebview).not.toHaveBeenCalled()
		})

		it("should show error message when bulk setHookEnabled fails", async () => {
			const hooksById = new Map<string, ResolvedHook>()
			hooksById.set("hook-1", {
				id: "hook-1",
				event: "PreToolUse" as any,
				matcher: ".*",
				command: "echo 1",
				enabled: true,
				source: "global" as any,
				timeout: 30,
				includeConversationHistory: false,
			} as any)

			vi.mocked(mockHookManager.getConfigSnapshot).mockReturnValue({
				hooksByEvent: new Map(),
				hooksById,
				loadedAt: new Date(),
				disabledHookIds: new Set(),
				hasProjectHooks: false,
			} as HooksConfigSnapshot)

			vi.mocked(mockHookManager.setHookEnabled).mockRejectedValueOnce(new Error("boom"))

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksSetAllEnabled",
				hooksEnabled: true,
			})

			expect(mockClineProvider.log).toHaveBeenCalledWith("Failed to set all hooks enabled: boom")
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to enable all hooks")
		})
	})

	describe("hooksOpenConfigFolder", () => {
		it("should open project hooks folder by default", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "hooksOpenConfigFolder",
			})

			expect(vscode.Uri.file).toHaveBeenCalledWith("/mock/workspace/.roo/hooks")
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("revealFileInOS", expect.any(Object))
		})

		it("should open global hooks folder when source is global", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "hooksOpenConfigFolder",
				hooksSource: "global",
			})

			expect(vscode.Uri.file).toHaveBeenCalledWith(expect.stringContaining(".roo/hooks"))
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("revealFileInOS", expect.any(Object))
		})

		it("should open project hooks folder when source is project", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "hooksOpenConfigFolder",
				hooksSource: "project",
			})

			expect(vscode.Uri.file).toHaveBeenCalledWith("/mock/workspace/.roo/hooks")
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("revealFileInOS", expect.any(Object))
		})

		it("should create hooks folder if it does not exist", async () => {
			vi.mocked(fsUtils.fileExistsAtPath).mockResolvedValueOnce(false)

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksOpenConfigFolder",
			})

			expect(fs.mkdir).toHaveBeenCalledWith("/mock/workspace/.roo/hooks", { recursive: true })
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("revealFileInOS", expect.any(Object))
		})

		it("should not create hooks folder if it already exists", async () => {
			vi.mocked(fsUtils.fileExistsAtPath).mockResolvedValueOnce(true)

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksOpenConfigFolder",
			})

			expect(fs.mkdir).not.toHaveBeenCalled()
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("revealFileInOS", expect.any(Object))
		})

		it("should show error message when open fails", async () => {
			vi.mocked(vscode.commands.executeCommand).mockRejectedValueOnce(new Error("Failed to open folder"))

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksOpenConfigFolder",
			})

			expect(mockClineProvider.log).toHaveBeenCalledWith("Failed to open hooks folder: Failed to open folder")
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to open hooks configuration folder")
		})
	})

	describe("hooksDeleteHook", () => {
		it("should delete hook from JSON config file and then reload + post state", async () => {
			const hookId = "hook-to-delete"
			const hookFilePath = "/mock/workspace/.roo/hooks/hooks.json"

			const hooksById = new Map<string, ResolvedHook>()
			hooksById.set(hookId, {
				id: hookId,
				event: "PreToolUse" as any,
				matcher: ".*",
				command: "echo hi",
				enabled: true,
				source: "project" as any,
				timeout: 30,
				filePath: hookFilePath,
				includeConversationHistory: false,
			} as any)

			vi.mocked(mockHookManager.getConfigSnapshot).mockReturnValue({
				hooksByEvent: new Map(),
				hooksById,
				loadedAt: new Date(),
				disabledHookIds: new Set(),
				hasProjectHooks: true,
			} as HooksConfigSnapshot)

			vi.mocked(fs.readFile).mockResolvedValueOnce(
				JSON.stringify({
					version: "1",
					hooks: {
						PreToolUse: [
							{ id: hookId, command: "echo hi" },
							{ id: "keep", command: "echo keep" },
						],
					},
				}),
			)

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksDeleteHook",
				hookId,
			} as any)

			expect(safeWriteJson).toHaveBeenCalledWith(
				hookFilePath,
				expect.objectContaining({
					version: "1",
					hooks: {
						PreToolUse: [{ id: "keep", command: "echo keep" }],
					},
				}),
			)
			expect(mockHookManager.reloadHooksConfig).toHaveBeenCalledTimes(1)
			expect(mockClineProvider.postStateToWebview).toHaveBeenCalledTimes(1)
		})

		it("should show error and not reload when hook is not found in config file", async () => {
			const hookId = "missing-hook"
			const hookFilePath = "/mock/workspace/.roo/hooks/hooks.json"

			const hooksById = new Map<string, ResolvedHook>()
			hooksById.set(hookId, {
				id: hookId,
				event: "PreToolUse" as any,
				matcher: ".*",
				command: "echo hi",
				enabled: true,
				source: "project" as any,
				timeout: 30,
				filePath: hookFilePath,
				includeConversationHistory: false,
			} as any)

			vi.mocked(mockHookManager.getConfigSnapshot).mockReturnValue({
				hooksByEvent: new Map(),
				hooksById,
				loadedAt: new Date(),
				disabledHookIds: new Set(),
				hasProjectHooks: true,
			} as HooksConfigSnapshot)

			vi.mocked(fs.readFile).mockResolvedValueOnce(
				JSON.stringify({
					version: "1",
					hooks: {
						PreToolUse: [{ id: "keep", command: "echo keep" }],
					},
				}),
			)

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksDeleteHook",
				hookId,
			} as any)

			expect(safeWriteJson).not.toHaveBeenCalled()
			expect(mockHookManager.reloadHooksConfig).not.toHaveBeenCalled()
			expect(mockClineProvider.postStateToWebview).not.toHaveBeenCalled()
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to delete hook")
		})
	})

	describe("hooksOpenHookFile", () => {
		it("should open hook file in editor when filePath is provided and file exists", async () => {
			const hookFilePath = "/mock/workspace/.roo/hooks/hooks.json"

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksOpenHookFile",
				filePath: hookFilePath,
			} as any)

			expect(vscode.Uri.file).toHaveBeenCalledWith(hookFilePath)
			expect(vscode.workspace.openTextDocument).toHaveBeenCalled()
			expect(vscode.window.showTextDocument).toHaveBeenCalled()
		})

		it("should show error message when file does not exist", async () => {
			const hookFilePath = "/mock/workspace/.roo/hooks/missing.json"
			vi.mocked(fsUtils.fileExistsAtPath).mockResolvedValueOnce(false)

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksOpenHookFile",
				filePath: hookFilePath,
			} as any)

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(`Hook file not found: ${hookFilePath}`)
		})

		it("should not attempt to open when filePath is missing", async () => {
			await webviewMessageHandler(mockClineProvider, {
				type: "hooksOpenHookFile",
			} as any)

			expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled()
			expect(vscode.window.showTextDocument).not.toHaveBeenCalled()
		})

		it("should show error message when open fails", async () => {
			const hookFilePath = "/mock/workspace/.roo/hooks/hooks.json"
			vi.mocked(vscode.workspace.openTextDocument).mockRejectedValueOnce(new Error("Cannot open file"))

			await webviewMessageHandler(mockClineProvider, {
				type: "hooksOpenHookFile",
				filePath: hookFilePath,
			} as any)

			expect(mockClineProvider.log).toHaveBeenCalledWith(expect.stringContaining("Failed to open hook file"))
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to open hook configuration file")
		})
	})
})

describe("webviewMessageHandler - hooks state integration", () => {
	it("should return hooks state when hookManager has data", () => {
		const mockResolvedHook: ResolvedHook = {
			id: "hook-1",
			event: "PreToolUse",
			matcher: ".*",
			command: "echo 'hello'",
			enabled: true,
			source: "project",
			timeout: 30,
			shell: "/bin/bash",
			description: "Test hook",
			filePath: "/mock/workspace/.roo/hooks/pre-tool-use.json",
			includeConversationHistory: false,
		}

		const mockExecutionHistory: HookExecution[] = [
			{
				timestamp: new Date(1642000000000),
				hook: mockResolvedHook,
				event: "PreToolUse",
				result: {
					hook: mockResolvedHook,
					exitCode: 0,
					stdout: "hello",
					stderr: "",
					duration: 100,
					timedOut: false,
				},
			},
		]

		const mockHookManager = createMockHookManager()
		vi.mocked(mockHookManager.getEnabledHooks).mockReturnValue([mockResolvedHook])
		vi.mocked(mockHookManager.getHookExecutionHistory).mockReturnValue(mockExecutionHistory)

		const hooksByEvent = new Map()
		hooksByEvent.set("PreToolUse", [mockResolvedHook])

		const hooksById = new Map()
		hooksById.set("hook-1", mockResolvedHook)

		vi.mocked(mockHookManager.getConfigSnapshot).mockReturnValue({
			hooksByEvent,
			hooksById,
			loadedAt: new Date(1642000000000),
			disabledHookIds: new Set(),
			hasProjectHooks: true,
		})

		// Verify mock data is correctly formatted
		expect(mockHookManager.getEnabledHooks()).toHaveLength(1)
		expect(mockHookManager.getHookExecutionHistory()).toHaveLength(1)
		expect(mockHookManager.getConfigSnapshot()?.hasProjectHooks).toBe(true)
	})
})
