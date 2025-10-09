// npx vitest services/code-index/__tests__/manager-watcher-integration.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CodeIndexManager } from "../manager"
import * as vscode from "vscode"

// Mock dependencies
vi.mock("vscode")
vi.mock("../service-factory")
vi.mock("../git-branch-watcher")
vi.mock("../../../utils/git")

import { ServiceFactory } from "../service-factory"
import { GitBranchWatcher } from "../git-branch-watcher"
import { getCurrentBranch } from "../../../utils/git"

const mockedServiceFactory = vi.mocked(ServiceFactory)
const mockedGitBranchWatcher = vi.mocked(GitBranchWatcher)
const mockedGetCurrentBranch = vi.mocked(getCurrentBranch)

describe("CodeIndexManager + GitBranchWatcher Integration", () => {
	let manager: CodeIndexManager
	let mockContext: vscode.ExtensionContext
	let mockServiceFactory: any
	let mockVectorStore: any
	let mockOrchestrator: any
	let mockWatcher: any
	let branchChangeCallback: ((oldBranch: string | undefined, newBranch: string | undefined) => Promise<void>) | null =
		null

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup mock context
		mockContext = {
			subscriptions: [],
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
			},
		} as any

		// Setup mock vector store
		mockVectorStore = {
			initialize: vi.fn().mockResolvedValue(undefined),
			invalidateBranchCache: vi.fn(),
			getCurrentBranch: vi.fn().mockReturnValue("main"),
			upsert: vi.fn().mockResolvedValue(undefined),
			search: vi.fn().mockResolvedValue([]),
		}

		// Setup mock orchestrator
		mockOrchestrator = {
			getVectorStore: vi.fn().mockReturnValue(mockVectorStore),
			startIndexing: vi.fn().mockResolvedValue(undefined),
			stopIndexing: vi.fn().mockResolvedValue(undefined),
			dispose: vi.fn(),
		}

		// Setup mock service factory
		mockServiceFactory = {
			createVectorStore: vi.fn().mockResolvedValue(mockVectorStore),
			createOrchestrator: vi.fn().mockResolvedValue(mockOrchestrator),
			configManager: {
				getConfig: vi.fn().mockReturnValue({
					branchIsolationEnabled: true,
					qdrantUrl: "http://localhost:6333",
					embedderProvider: "openai",
				}),
				isFeatureConfigured: true,
			},
		}

		mockedServiceFactory.mockImplementation(() => mockServiceFactory as any)

		// Setup mock watcher - capture the callback
		mockWatcher = {
			initialize: vi.fn().mockResolvedValue(undefined),
			getCurrentBranch: vi.fn().mockReturnValue("main"),
			dispose: vi.fn(),
		}

		mockedGitBranchWatcher.mockImplementation((workspacePath: string, callback: any, config: any) => {
			branchChangeCallback = callback
			return mockWatcher as any
		})

		// Setup git mock
		mockedGetCurrentBranch.mockResolvedValue("main")
	})

	afterEach(() => {
		if (manager) {
			manager.dispose()
		}
		branchChangeCallback = null
	})

	describe("branch change handling", () => {
		it("should invalidate cache and reinitialize vector store on branch change", async () => {
			manager = new CodeIndexManager(mockContext, "/test/workspace")

			// Start the manager
			await manager.start()

			expect(mockWatcher.initialize).toHaveBeenCalled()
			expect(mockOrchestrator.startIndexing).toHaveBeenCalled()

			// Simulate branch change
			vi.clearAllMocks()
			mockVectorStore.getCurrentBranch.mockReturnValue("feature-branch")

			if (branchChangeCallback) {
				await branchChangeCallback("main", "feature-branch")
			}

			// Should invalidate cache
			expect(mockVectorStore.invalidateBranchCache).toHaveBeenCalled()

			// Should reinitialize vector store
			expect(mockVectorStore.initialize).toHaveBeenCalled()

			// Should restart indexing
			expect(mockOrchestrator.startIndexing).toHaveBeenCalled()
		})

		it("should recreate services if orchestrator doesn't exist", async () => {
			manager = new CodeIndexManager(mockContext, "/test/workspace")

			await manager.start()

			// Simulate orchestrator being disposed
			mockOrchestrator.getVectorStore.mockReturnValue(null)

			vi.clearAllMocks()

			if (branchChangeCallback) {
				await branchChangeCallback("main", "feature-branch")
			}

			// Should recreate services
			expect(mockServiceFactory.createVectorStore).toHaveBeenCalled()
			expect(mockServiceFactory.createOrchestrator).toHaveBeenCalled()
		})

		it("should handle branch change errors gracefully", async () => {
			manager = new CodeIndexManager(mockContext, "/test/workspace")

			await manager.start()

			// Make vector store initialization fail
			mockVectorStore.initialize.mockRejectedValueOnce(new Error("Init failed"))

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			if (branchChangeCallback) {
				await branchChangeCallback("main", "feature-branch")
			}

			// Should log error
			expect(consoleErrorSpy).toHaveBeenCalled()

			consoleErrorSpy.mockRestore()
		})

		it("should not process branch changes when manager is stopped", async () => {
			manager = new CodeIndexManager(mockContext, "/test/workspace")

			await manager.start()
			await manager.stop()

			vi.clearAllMocks()

			if (branchChangeCallback) {
				await branchChangeCallback("main", "feature-branch")
			}

			// Should not invalidate cache or reinitialize
			expect(mockVectorStore.invalidateBranchCache).not.toHaveBeenCalled()
			expect(mockVectorStore.initialize).not.toHaveBeenCalled()
		})
	})

	describe("watcher lifecycle", () => {
		it("should initialize watcher when manager starts", async () => {
			manager = new CodeIndexManager(mockContext, "/test/workspace")

			await manager.start()

			expect(mockedGitBranchWatcher).toHaveBeenCalledWith(
				"/test/workspace",
				expect.any(Function),
				expect.objectContaining({
					enabled: true,
				}),
			)

			expect(mockWatcher.initialize).toHaveBeenCalled()
		})

		it("should dispose watcher when manager is disposed", async () => {
			manager = new CodeIndexManager(mockContext, "/test/workspace")

			await manager.start()

			manager.dispose()

			expect(mockWatcher.dispose).toHaveBeenCalled()
		})

		it("should not create watcher when branch isolation is disabled", async () => {
			mockServiceFactory.configManager.getConfig.mockReturnValue({
				branchIsolationEnabled: false,
				qdrantUrl: "http://localhost:6333",
				embedderProvider: "openai",
			})

			manager = new CodeIndexManager(mockContext, "/test/workspace")

			await manager.start()

			expect(mockedGitBranchWatcher).not.toHaveBeenCalled()
		})
	})

	describe("state consistency", () => {
		it("should maintain consistent state across multiple branch changes", async () => {
			manager = new CodeIndexManager(mockContext, "/test/workspace")

			await manager.start()

			// First branch change
			mockVectorStore.getCurrentBranch.mockReturnValue("feature-1")
			if (branchChangeCallback) {
				await branchChangeCallback("main", "feature-1")
			}

			expect(mockVectorStore.invalidateBranchCache).toHaveBeenCalledTimes(1)

			// Second branch change
			vi.clearAllMocks()
			mockVectorStore.getCurrentBranch.mockReturnValue("feature-2")
			if (branchChangeCallback) {
				await branchChangeCallback("feature-1", "feature-2")
			}

			expect(mockVectorStore.invalidateBranchCache).toHaveBeenCalledTimes(1)

			// Third branch change back to main
			vi.clearAllMocks()
			mockVectorStore.getCurrentBranch.mockReturnValue("main")
			if (branchChangeCallback) {
				await branchChangeCallback("feature-2", "main")
			}

			expect(mockVectorStore.invalidateBranchCache).toHaveBeenCalledTimes(1)
		})

		it("should handle rapid branch changes with debouncing", async () => {
			manager = new CodeIndexManager(mockContext, "/test/workspace")

			await manager.start()

			// Simulate rapid branch changes (watcher handles debouncing)
			// The callback should only be called once per actual change
			if (branchChangeCallback) {
				await branchChangeCallback("main", "feature-1")
				await branchChangeCallback("feature-1", "feature-2")
				await branchChangeCallback("feature-2", "feature-3")
			}

			// Each change should invalidate cache
			expect(mockVectorStore.invalidateBranchCache).toHaveBeenCalledTimes(3)
		})
	})

	describe("error recovery", () => {
		it("should recover from vector store initialization failure", async () => {
			manager = new CodeIndexManager(mockContext, "/test/workspace")

			await manager.start()

			// First branch change fails
			mockVectorStore.initialize.mockRejectedValueOnce(new Error("Init failed"))

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			if (branchChangeCallback) {
				await branchChangeCallback("main", "feature-1")
			}

			expect(consoleErrorSpy).toHaveBeenCalled()

			// Second branch change succeeds
			vi.clearAllMocks()
			mockVectorStore.initialize.mockResolvedValue(undefined)

			if (branchChangeCallback) {
				await branchChangeCallback("feature-1", "feature-2")
			}

			expect(mockVectorStore.initialize).toHaveBeenCalled()
			expect(mockOrchestrator.startIndexing).toHaveBeenCalled()

			consoleErrorSpy.mockRestore()
		})
	})
})
