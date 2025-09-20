import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as vscode from "vscode"
import { CodeIndexOrchestrator } from "../orchestrator"
import { CodeIndexConfigManager } from "../config-manager"
import { CodeIndexStateManager } from "../state-manager"
import { IFileWatcher, IVectorStore } from "../interfaces"
import { DirectoryScanner } from "../processors"
import { CacheManager } from "../cache-manager"
import { t } from "../../../i18n"

// Mock dependencies
vi.mock("vscode")
vi.mock("../config-manager")
vi.mock("../state-manager")
vi.mock("../processors")
vi.mock("../cache-manager")
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
	TelemetryEventName: {
		CODE_INDEX_ERROR: "CODE_INDEX_ERROR",
	},
}))
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string, params?: any) => {
		if (key === "embeddings:orchestrator.qdrantNotAvailable" && params?.errorMessage) {
			return params.errorMessage
		}
		return key
	}),
}))

describe("CodeIndexOrchestrator", () => {
	let orchestrator: CodeIndexOrchestrator
	let mockConfigManager: any
	let mockStateManager: any
	let mockVectorStore: IVectorStore
	let mockScanner: any
	let mockFileWatcher: IFileWatcher
	let mockCacheManager: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()
		vi.useFakeTimers()

		// Create mock instances
		mockConfigManager = {
			isFeatureConfigured: true,
		} as any

		mockStateManager = {
			setSystemState: vi.fn(),
			state: "Standby",
			reportBlockIndexingProgress: vi.fn(),
			reportFileQueueProgress: vi.fn(),
		} as any

		mockVectorStore = {
			initialize: vi.fn().mockResolvedValue(false),
			clearCollection: vi.fn().mockResolvedValue(undefined),
		} as any

		mockScanner = {
			scanDirectory: vi.fn().mockResolvedValue({
				stats: {
					filesProcessed: 10,
					blocksIndexed: 100,
				},
			}),
		} as any

		mockFileWatcher = {
			initialize: vi.fn().mockResolvedValue(undefined),
			dispose: vi.fn(),
			onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidFinishBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		} as any

		mockCacheManager = {
			clearCacheFile: vi.fn().mockResolvedValue(undefined),
		} as any

		// Mock vscode workspace
		;(vscode.workspace as any).workspaceFolders = [
			{
				uri: { fsPath: "/test/workspace" },
			},
		]

		// Create orchestrator instance
		orchestrator = new CodeIndexOrchestrator(
			mockConfigManager as any,
			mockStateManager as any,
			"/test/workspace",
			mockCacheManager as any,
			mockVectorStore,
			mockScanner as any,
			mockFileWatcher,
		)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe("Qdrant connection retry mechanism", () => {
		it("should set up retry mechanism when Qdrant is not available", async () => {
			// Mock Qdrant connection failure
			const connectionError = new Error("Failed to connect to Qdrant vector database")
			connectionError.message = "qdrantConnectionFailed"
			mockVectorStore.initialize = vi.fn().mockRejectedValue(connectionError)

			// Start indexing
			await orchestrator.startIndexing()

			// Verify error state is set
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith(
				"Error",
				expect.stringContaining("Qdrant service is not available"),
			)

			// Verify cache was NOT cleared
			expect(mockCacheManager.clearCacheFile).not.toHaveBeenCalled()
		})

		it("should preserve cache when Qdrant connection fails", async () => {
			// Mock Qdrant connection failure
			const connectionError = new Error("connect ECONNREFUSED")
			mockVectorStore.initialize = vi.fn().mockRejectedValue(connectionError)

			// Start indexing
			await orchestrator.startIndexing()

			// Verify cache was NOT cleared
			expect(mockCacheManager.clearCacheFile).not.toHaveBeenCalled()

			// Verify collection was NOT cleared
			expect(mockVectorStore.clearCollection).not.toHaveBeenCalled()
		})

		it("should retry connection to Qdrant periodically", async () => {
			// Mock initial connection failure
			const connectionError = new Error("ECONNREFUSED")
			mockVectorStore.initialize = vi
				.fn()
				.mockRejectedValueOnce(connectionError)
				.mockRejectedValueOnce(connectionError)
				.mockResolvedValueOnce(false) // Success on third attempt

			// Start indexing
			await orchestrator.startIndexing()

			// Verify initial error state
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith(
				"Error",
				expect.stringContaining("Qdrant service is not available"),
			)

			// Fast-forward time to trigger first retry
			await vi.advanceTimersByTimeAsync(30000)

			// Verify retry was attempted
			expect(mockVectorStore.initialize).toHaveBeenCalledTimes(2)

			// Fast-forward time to trigger second retry (successful)
			await vi.advanceTimersByTimeAsync(30000)

			// Verify successful reconnection
			expect(mockVectorStore.initialize).toHaveBeenCalledTimes(3)
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith(
				"Indexing",
				"Qdrant connection restored. Resuming indexing...",
			)
		})

		it("should perform incremental indexing after Qdrant becomes available", async () => {
			// Mock initial connection failure then success
			const connectionError = new Error("ECONNREFUSED")
			mockVectorStore.initialize = vi.fn().mockRejectedValueOnce(connectionError).mockResolvedValueOnce(false) // Success on retry, no new collection created

			// Start indexing
			await orchestrator.startIndexing()

			// Fast-forward time to trigger retry
			await vi.advanceTimersByTimeAsync(30000)

			// Verify incremental indexing was performed
			expect(mockScanner.scanDirectory).toHaveBeenCalled()
			expect(mockCacheManager.clearCacheFile).not.toHaveBeenCalled()
		})

		it("should clear cache only when new collection is created", async () => {
			// Mock initial connection failure then success with new collection
			const connectionError = new Error("ECONNREFUSED")
			mockVectorStore.initialize = vi.fn().mockRejectedValueOnce(connectionError).mockResolvedValueOnce(true) // Success on retry, new collection created

			// Start indexing
			await orchestrator.startIndexing()

			// Fast-forward time to trigger retry
			await vi.advanceTimersByTimeAsync(30000)

			// Verify cache was cleared for new collection
			expect(mockCacheManager.clearCacheFile).toHaveBeenCalledTimes(1)
		})

		it("should stop retrying after maximum attempts", async () => {
			// Mock persistent connection failure
			const connectionError = new Error("ECONNREFUSED")
			mockVectorStore.initialize = vi.fn().mockRejectedValue(connectionError)

			// Start indexing
			await orchestrator.startIndexing()

			// Fast-forward through all retry attempts
			for (let i = 0; i < 10; i++) {
				await vi.advanceTimersByTimeAsync(30000)
			}

			// Verify maximum retry message
			expect(mockStateManager.setSystemState).toHaveBeenLastCalledWith(
				"Error",
				"Maximum retry attempts reached. Please ensure Qdrant is running and restart indexing manually.",
			)

			// Verify no more retries after max
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockVectorStore.initialize).toHaveBeenCalledTimes(11) // Initial + 10 retries
		})

		it("should clear retry timer when stopping watcher", async () => {
			// Mock connection failure
			const connectionError = new Error("ECONNREFUSED")
			mockVectorStore.initialize = vi.fn().mockRejectedValue(connectionError)

			// Start indexing
			await orchestrator.startIndexing()

			// Stop watcher
			orchestrator.stopWatcher()

			// Fast-forward time
			await vi.advanceTimersByTimeAsync(30000)

			// Verify no retry was attempted after stopping
			expect(mockVectorStore.initialize).toHaveBeenCalledTimes(1)
		})

		it("should handle non-connection errors normally", async () => {
			// Mock non-connection error
			const otherError = new Error("Invalid configuration")
			mockVectorStore.initialize = vi.fn().mockRejectedValue(otherError)

			// Start indexing
			await orchestrator.startIndexing()

			// Verify normal error handling (cache cleared)
			expect(mockCacheManager.clearCacheFile).toHaveBeenCalled()
			expect(mockVectorStore.clearCollection).toHaveBeenCalled()

			// Verify no retry mechanism set up
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockVectorStore.initialize).toHaveBeenCalledTimes(1)
		})
	})

	describe("startIndexing", () => {
		it("should handle successful indexing flow", async () => {
			// Mock successful initialization
			mockVectorStore.initialize = vi.fn().mockResolvedValue(false)

			// Start indexing
			await orchestrator.startIndexing()

			// Verify successful flow
			expect(mockVectorStore.initialize).toHaveBeenCalled()
			expect(mockScanner.scanDirectory).toHaveBeenCalled()
			expect(mockFileWatcher.initialize).toHaveBeenCalled()
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith(
				"Indexed",
				"embeddings:orchestrator.fileWatcherStarted",
			)
		})

		it("should not proceed if no workspace folders", async () => {
			// Mock no workspace
			;(vscode.workspace as any).workspaceFolders = []

			// Start indexing
			await orchestrator.startIndexing()

			// Verify early return
			expect(mockVectorStore.initialize).not.toHaveBeenCalled()
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith(
				"Error",
				"embeddings:orchestrator.indexingRequiresWorkspace",
			)
		})

		it("should not proceed if feature not configured", async () => {
			// Create a new mock with isFeatureConfigured set to false
			const notConfiguredMockConfigManager = {
				isFeatureConfigured: false,
			} as any

			// Create a new orchestrator instance with the not configured mock
			const notConfiguredOrchestrator = new CodeIndexOrchestrator(
				notConfiguredMockConfigManager,
				mockStateManager as any,
				"/test/workspace",
				mockCacheManager as any,
				mockVectorStore,
				mockScanner as any,
				mockFileWatcher,
			)

			// Start indexing
			await notConfiguredOrchestrator.startIndexing()

			// Verify early return
			expect(mockVectorStore.initialize).not.toHaveBeenCalled()
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith(
				"Standby",
				"Missing configuration. Save your settings to start indexing.",
			)
		})
	})
})
