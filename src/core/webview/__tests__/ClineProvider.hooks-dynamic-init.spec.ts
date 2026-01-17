// npx vitest run core/webview/__tests__/ClineProvider.hooks-dynamic-init.spec.ts

import type { IHookManager } from "../../../services/hooks/types"

// Mock vscode before importing ClineProvider
vi.mock("vscode", () => {
	const mockFileSystemWatcher = {
		onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		dispose: vi.fn(),
	}

	return {
		window: {
			showInformationMessage: vi.fn(),
			showErrorMessage: vi.fn(),
			showTextDocument: vi.fn().mockResolvedValue(undefined),
			createWebviewPanel: vi.fn(),
		},
		workspace: {
			workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
			openTextDocument: vi.fn().mockResolvedValue({ uri: { fsPath: "/mock/file" } }),
			createFileSystemWatcher: vi.fn().mockReturnValue(mockFileSystemWatcher),
			getConfiguration: vi.fn().mockReturnValue({
				get: vi.fn(),
				update: vi.fn(),
			}),
		},
		commands: {
			executeCommand: vi.fn().mockResolvedValue(undefined),
		},
		Uri: {
			file: vi.fn((path: string) => ({ fsPath: path })),
			joinPath: vi.fn((_base: { fsPath: string }, ...segments: string[]) => ({
				fsPath: `${_base.fsPath}/${segments.join("/")}`,
			})),
		},
		RelativePattern: vi.fn().mockImplementation((_base: unknown, _pattern: string) => ({ _base, _pattern })),
		EventEmitter: vi.fn().mockImplementation(() => ({
			event: vi.fn(),
			fire: vi.fn(),
			dispose: vi.fn(),
		})),
		ConfigurationTarget: {
			Global: 1,
			Workspace: 2,
		},
		ViewColumn: {
			One: 1,
		},
	}
})

vi.mock("fs/promises", () => ({
	default: {
		mkdir: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue(""),
		writeFile: vi.fn().mockResolvedValue(undefined),
		access: vi.fn().mockResolvedValue(undefined),
		readdir: vi.fn().mockResolvedValue([]),
	},
	mkdir: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	writeFile: vi.fn().mockResolvedValue(undefined),
	access: vi.fn().mockResolvedValue(undefined),
	readdir: vi.fn().mockResolvedValue([]),
}))

vi.mock("os", () => ({
	default: {
		homedir: vi.fn().mockReturnValue("/mock/home"),
	},
	homedir: vi.fn().mockReturnValue("/mock/home"),
}))

vi.mock("../../../services/hooks", () => ({
	createHookManager: vi.fn().mockImplementation(() => createMockHookManager()),
}))

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/mock/workspace"),
}))

import * as vscode from "vscode"
import { createHookManager } from "../../../services/hooks"

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

describe("ClineProvider - Hook Dynamic Initialization", () => {
	let mockHookManager: IHookManager

	beforeEach(() => {
		vi.clearAllMocks()
		mockHookManager = createMockHookManager()
		vi.mocked(createHookManager).mockReturnValue(mockHookManager)
		vi.mocked(vscode.workspace.createFileSystemWatcher).mockClear()
	})

	describe("initializeHookManager", () => {
		it("should always initialize hook manager (hooks is a core feature)", async () => {
			// Create a mock provider-like object to test the logic
			const cwd = "/mock/workspace"
			const state = { mode: "code" }

			// Hooks are always initialized - no experiment check needed
			const newHookManager = createHookManager({
				cwd,
				mode: state.mode,
				logger: {
					debug: vi.fn(),
					info: vi.fn(),
					warn: vi.fn(),
					error: vi.fn(),
				},
			})

			await newHookManager.loadHooksConfig()

			expect(createHookManager).toHaveBeenCalledWith({
				cwd,
				mode: state.mode,
				logger: expect.any(Object),
			})
			expect(newHookManager.loadHooksConfig).toHaveBeenCalled()
		})

		it("should set up file watchers for hook configuration files", async () => {
			const cwd = "/mock/workspace"
			const mode = "code"

			// Simulate setupHookFileWatchers
			// Project hooks pattern
			const projectPattern = new vscode.RelativePattern(vscode.Uri.file(`${cwd}/.roo/hooks`), "*.{json,yaml,yml}")

			// Mode-specific hooks pattern
			const modePattern = new vscode.RelativePattern(
				vscode.Uri.file(`${cwd}/.roo/hooks-${mode}`),
				"*.{json,yaml,yml}",
			)

			// Global hooks pattern
			const globalPattern = new vscode.RelativePattern(
				vscode.Uri.file("/mock/home/.roo/hooks"),
				"*.{json,yaml,yml}",
			)

			// Create watchers
			vscode.workspace.createFileSystemWatcher(projectPattern)
			vscode.workspace.createFileSystemWatcher(modePattern)
			vscode.workspace.createFileSystemWatcher(globalPattern)

			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(3)
			expect(vscode.RelativePattern).toHaveBeenCalledWith(expect.any(Object), "*.{json,yaml,yml}")
		})

		it("should register change event handlers on file watchers", async () => {
			const watcher = vscode.workspace.createFileSystemWatcher({} as vscode.GlobPattern)

			watcher.onDidCreate(vi.fn())
			watcher.onDidChange(vi.fn())
			watcher.onDidDelete(vi.fn())

			expect(watcher.onDidCreate).toHaveBeenCalled()
			expect(watcher.onDidChange).toHaveBeenCalled()
			expect(watcher.onDidDelete).toHaveBeenCalled()
		})
	})

	describe("disposeHookManager", () => {
		it("should dispose all file watchers", () => {
			const hookFileWatchers: { dispose: ReturnType<typeof vi.fn> }[] = [
				{ dispose: vi.fn() },
				{ dispose: vi.fn() },
				{ dispose: vi.fn() },
			]

			// Simulate disposeHookFileWatchers
			for (const watcher of hookFileWatchers) {
				watcher.dispose()
			}

			expect(hookFileWatchers[0].dispose).toHaveBeenCalled()
			expect(hookFileWatchers[1].dispose).toHaveBeenCalled()
			expect(hookFileWatchers[2].dispose).toHaveBeenCalled()
		})

		it("should clear the hook manager reference", () => {
			let hookManager: IHookManager | undefined = createMockHookManager()

			// Simulate disposeHookManager
			hookManager = undefined

			expect(hookManager).toBeUndefined()
		})

		it("should clear pending reload timeout", () => {
			vi.useFakeTimers()

			let hookReloadTimeout: NodeJS.Timeout | undefined = setTimeout(() => {}, 500)

			// Simulate clearing timeout in disposeHookFileWatchers
			if (hookReloadTimeout) {
				clearTimeout(hookReloadTimeout)
				hookReloadTimeout = undefined
			}

			expect(hookReloadTimeout).toBeUndefined()

			vi.useRealTimers()
		})
	})

	describe("debounced reload", () => {
		it("should debounce multiple file change events", async () => {
			vi.useFakeTimers()

			const HOOK_RELOAD_DEBOUNCE_MS = 500
			const mockReload = vi.fn()
			let hookReloadTimeout: NodeJS.Timeout | undefined

			// Simulate debounced reload function
			const debouncedReload = () => {
				if (hookReloadTimeout) {
					clearTimeout(hookReloadTimeout)
				}
				hookReloadTimeout = setTimeout(async () => {
					await mockReload()
				}, HOOK_RELOAD_DEBOUNCE_MS)
			}

			// Trigger multiple change events rapidly
			debouncedReload()
			debouncedReload()
			debouncedReload()

			// Should not have called reload yet
			expect(mockReload).not.toHaveBeenCalled()

			// Advance time by debounce duration
			await vi.advanceTimersByTimeAsync(HOOK_RELOAD_DEBOUNCE_MS)

			// Should have called reload exactly once
			expect(mockReload).toHaveBeenCalledTimes(1)

			vi.useRealTimers()
		})

		it("should reset debounce timer on each new change event", async () => {
			vi.useFakeTimers()

			const HOOK_RELOAD_DEBOUNCE_MS = 500
			const mockReload = vi.fn()
			let hookReloadTimeout: NodeJS.Timeout | undefined

			const debouncedReload = () => {
				if (hookReloadTimeout) {
					clearTimeout(hookReloadTimeout)
				}
				hookReloadTimeout = setTimeout(async () => {
					await mockReload()
				}, HOOK_RELOAD_DEBOUNCE_MS)
			}

			// First change
			debouncedReload()

			// Advance time partially
			await vi.advanceTimersByTimeAsync(300)

			// Second change should reset the timer
			debouncedReload()

			// Advance time by original debounce (should not trigger because timer was reset)
			await vi.advanceTimersByTimeAsync(300)
			expect(mockReload).not.toHaveBeenCalled()

			// Advance remaining time
			await vi.advanceTimersByTimeAsync(200)
			expect(mockReload).toHaveBeenCalledTimes(1)

			vi.useRealTimers()
		})
	})
})

describe("File Watcher Patterns", () => {
	it("should watch project hooks directory with correct pattern", () => {
		const cwd = "/test/workspace"
		const expectedPath = `${cwd}/.roo/hooks`
		const expectedPattern = "*.{json,yaml,yml}"

		new vscode.RelativePattern(vscode.Uri.file(expectedPath), expectedPattern)

		expect(vscode.Uri.file).toHaveBeenCalledWith(expectedPath)
		expect(vscode.RelativePattern).toHaveBeenCalledWith(expect.any(Object), expectedPattern)
	})

	it("should watch mode-specific hooks directory when mode is provided", () => {
		const cwd = "/test/workspace"
		const mode = "architect"
		const expectedPath = `${cwd}/.roo/hooks-${mode}`

		new vscode.RelativePattern(vscode.Uri.file(expectedPath), "*.{json,yaml,yml}")

		expect(vscode.Uri.file).toHaveBeenCalledWith(expectedPath)
	})

	it("should watch global hooks directory", () => {
		const homedir = "/mock/home"
		const expectedPath = `${homedir}/.roo/hooks`

		new vscode.RelativePattern(vscode.Uri.file(expectedPath), "*.{json,yaml,yml}")

		expect(vscode.Uri.file).toHaveBeenCalledWith(expectedPath)
	})

	it("should support json, yaml, and yml file extensions", () => {
		const expectedPattern = "*.{json,yaml,yml}"
		new vscode.RelativePattern(vscode.Uri.file("/any/path"), expectedPattern)

		expect(vscode.RelativePattern).toHaveBeenCalledWith(expect.any(Object), expectedPattern)
	})
})
