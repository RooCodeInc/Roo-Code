// npx vitest services/code-index/__tests__/file-watching-pause.spec.ts

import { CodeIndexConfigManager } from "../config-manager"
import { CodeIndexStateManager } from "../state-manager"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn().mockImplementation(() => ({
			get: vi.fn().mockReturnValue(true),
		})),
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
	},
	EventEmitter: vi.fn().mockImplementation(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
}))

// Mock ContextProxy
vi.mock("../../../core/config/ContextProxy")

// Mock embeddingModels module
vi.mock("../../../shared/embeddingModels")

// Mock Package
vi.mock("../../../shared/package", () => ({
	Package: {
		name: "roo-cline",
	},
}))

import * as vscode from "vscode"

describe("File Watching Pause Feature", () => {
	let mockContextProxy: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockContextProxy = {
			getGlobalState: vi.fn(),
			getSecret: vi.fn().mockReturnValue(undefined),
			refreshSecrets: vi.fn().mockResolvedValue(undefined),
			updateGlobalState: vi.fn(),
		}
	})

	describe("CodeIndexConfigManager.isFileWatchingEnabled", () => {
		it("should return true when file watching is enabled in workspace settings", () => {
			// Mock vscode.workspace.getConfiguration to return true
			const mockGetConfiguration = vi.mocked(vscode.workspace.getConfiguration)
			mockGetConfiguration.mockReturnValue({
				get: vi.fn().mockReturnValue(true),
			} as any)

			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
			})

			const configManager = new CodeIndexConfigManager(mockContextProxy)
			expect(configManager.isFileWatchingEnabled).toBe(true)
		})

		it("should return false when file watching is disabled in workspace settings", () => {
			// Mock vscode.workspace.getConfiguration to return false
			const mockGetConfiguration = vi.mocked(vscode.workspace.getConfiguration)
			mockGetConfiguration.mockReturnValue({
				get: vi.fn().mockReturnValue(false),
			} as any)

			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
			})

			const configManager = new CodeIndexConfigManager(mockContextProxy)
			expect(configManager.isFileWatchingEnabled).toBe(false)
		})

		it("should default to true when file watching setting is not set", () => {
			// Mock vscode.workspace.getConfiguration to return default value
			const mockGetConfiguration = vi.mocked(vscode.workspace.getConfiguration)
			mockGetConfiguration.mockReturnValue({
				get: vi.fn().mockImplementation((key: string, defaultValue: any) => defaultValue),
			} as any)

			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
			})

			const configManager = new CodeIndexConfigManager(mockContextProxy)
			expect(configManager.isFileWatchingEnabled).toBe(true)
		})
	})

	describe("CodeIndexStateManager IndexedPaused state", () => {
		it("should set state to IndexedPaused with default message", () => {
			const stateManager = new CodeIndexStateManager()

			stateManager.setSystemState("IndexedPaused")

			const status = stateManager.getCurrentStatus()
			expect(status.systemStatus).toBe("IndexedPaused")
			expect(status.message).toBe("Index ready. File watching paused.")
		})

		it("should set state to IndexedPaused with custom message", () => {
			const stateManager = new CodeIndexStateManager()

			stateManager.setSystemState("IndexedPaused", "Custom paused message")

			const status = stateManager.getCurrentStatus()
			expect(status.systemStatus).toBe("IndexedPaused")
			expect(status.message).toBe("Custom paused message")
		})

		it("should reset progress counters when transitioning to IndexedPaused", () => {
			const stateManager = new CodeIndexStateManager()

			// First set to indexing with progress
			stateManager.reportBlockIndexingProgress(50, 100)

			// Then transition to IndexedPaused
			stateManager.setSystemState("IndexedPaused")

			const status = stateManager.getCurrentStatus()
			expect(status.processedItems).toBe(0)
			expect(status.totalItems).toBe(0)
		})

		it("should allow transition from IndexedPaused to Indexing", () => {
			const stateManager = new CodeIndexStateManager()

			// Start in IndexedPaused state
			stateManager.setSystemState("IndexedPaused")

			// Then transition to Indexing (simulating re-index)
			stateManager.setSystemState("Indexing", "Re-indexing...")

			const status = stateManager.getCurrentStatus()
			expect(status.systemStatus).toBe("Indexing")
			expect(status.message).toBe("Re-indexing...")
		})
	})

	describe("IndexingState type includes IndexedPaused", () => {
		it("should accept IndexedPaused as valid state", () => {
			const stateManager = new CodeIndexStateManager()

			// Should not throw
			stateManager.setSystemState("IndexedPaused")
			expect(stateManager.state).toBe("IndexedPaused")
		})
	})
})
