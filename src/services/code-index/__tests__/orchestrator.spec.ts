import { describe, it, expect, beforeEach, vi } from "vitest"
import { CodeIndexOrchestrator } from "../orchestrator"

// Mock vscode workspace so startIndexing passes workspace check
vi.mock("vscode", () => {
	const path = require("path")
	const testWorkspacePath = path.join(path.sep, "test", "workspace")
	return {
		window: {
			activeTextEditor: null,
		},
		workspace: {
			workspaceFolders: [
				{
					uri: { fsPath: testWorkspacePath },
					name: "test",
					index: 0,
				},
			],
			createFileSystemWatcher: vi.fn().mockReturnValue({
				onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				dispose: vi.fn(),
			}),
		},
		RelativePattern: vi.fn().mockImplementation((base: string, pattern: string) => ({ base, pattern })),
	}
})

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock i18n translator used in orchestrator messages
vi.mock("../../i18n", () => ({
	t: (key: string, params?: any) => {
		if (key === "embeddings:orchestrator.failedDuringInitialScan" && params?.errorMessage) {
			return `Failed during initial scan: ${params.errorMessage}`
		}
		return key
	},
}))

describe("CodeIndexOrchestrator - error path cleanup gating", () => {
	const workspacePath = "/test/workspace"

	let configManager: any
	let stateManager: any
	let cacheManager: any
	let vectorStore: any
	let scanner: any
	let fileWatcher: any

	beforeEach(() => {
		vi.clearAllMocks()

		configManager = {
			isFeatureConfigured: true,
		}

		// Minimal state manager that tracks state transitions
		let currentState = "Standby"
		stateManager = {
			get state() {
				return currentState
			},
			setSystemState: vi.fn().mockImplementation((state: string, _msg: string) => {
				currentState = state
			}),
			reportFileQueueProgress: vi.fn(),
			reportBlockIndexingProgress: vi.fn(),
		}

		cacheManager = {
			clearCacheFile: vi.fn().mockResolvedValue(undefined),
		}

		vectorStore = {
			initialize: vi.fn(),
			hasIndexedData: vi.fn(),
			markIndexingIncomplete: vi.fn(),
			markIndexingComplete: vi.fn(),
			clearCollection: vi.fn().mockResolvedValue(undefined),
		}

		scanner = {
			scanDirectory: vi.fn(),
		}

		fileWatcher = {
			initialize: vi.fn().mockResolvedValue(undefined),
			onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidFinishBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			dispose: vi.fn(),
		}
	})

	it("should not call clearCollection() or clear cache when initialize() fails (indexing not started)", async () => {
		// Arrange: fail at initialize()
		vectorStore.initialize.mockRejectedValue(new Error("Qdrant unreachable"))

		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
		)

		// Act
		await orchestrator.startIndexing()

		// Assert
		expect(vectorStore.clearCollection).not.toHaveBeenCalled()
		expect(cacheManager.clearCacheFile).not.toHaveBeenCalled()

		// Error state should be set
		expect(stateManager.setSystemState).toHaveBeenCalled()
		const lastCall = stateManager.setSystemState.mock.calls[stateManager.setSystemState.mock.calls.length - 1]
		expect(lastCall[0]).toBe("Error")
	})

	it("should call clearCollection() and clear cache when an error occurs after initialize() succeeds (indexing started)", async () => {
		// Arrange: initialize succeeds; fail soon after to enter error path with indexingStarted=true
		vectorStore.initialize.mockResolvedValue(false) // existing collection
		vectorStore.hasIndexedData.mockResolvedValue(false) // force full scan path
		vectorStore.markIndexingIncomplete.mockRejectedValue(new Error("mark incomplete failure"))

		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
		)

		// Act
		await orchestrator.startIndexing()

		// Assert: cleanup gated behind indexingStarted should have happened
		expect(vectorStore.clearCollection).toHaveBeenCalledTimes(1)
		expect(cacheManager.clearCacheFile).toHaveBeenCalledTimes(1)

		// Error state should be set
		expect(stateManager.setSystemState).toHaveBeenCalled()
		const lastCall = stateManager.setSystemState.mock.calls[stateManager.setSystemState.mock.calls.length - 1]
		expect(lastCall[0]).toBe("Error")
	})

	it("should perform incremental scan when indexed data already exists (window reload scenario)", async () => {
		// Arrange: simulate window reload scenario where index already exists
		vectorStore.initialize.mockResolvedValue(false) // existing collection (not newly created)
		vectorStore.hasIndexedData.mockResolvedValue(true) // index data exists
		vectorStore.markIndexingIncomplete.mockResolvedValue(undefined)
		vectorStore.markIndexingComplete.mockResolvedValue(undefined)

		// Mock scanner to return successful result for incremental scan
		scanner.scanDirectory.mockResolvedValue({
			stats: {
				filesProcessed: 5,
				blocksFound: 10,
				blocksIndexed: 10,
			},
		})

		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
		)

		// Act
		await orchestrator.startIndexing()

		// Assert
		// Should check for existing data
		expect(vectorStore.hasIndexedData).toHaveBeenCalledTimes(1)

		// Should perform incremental scan (scanner called once)
		expect(scanner.scanDirectory).toHaveBeenCalledTimes(1)

		// Should NOT clear collection or cache (preserving existing index)
		expect(vectorStore.clearCollection).not.toHaveBeenCalled()
		expect(cacheManager.clearCacheFile).not.toHaveBeenCalled()

		// Should mark indexing as incomplete at start and complete at end
		expect(vectorStore.markIndexingIncomplete).toHaveBeenCalledTimes(1)
		expect(vectorStore.markIndexingComplete).toHaveBeenCalledTimes(1)

		// Should end in Indexed state
		expect(stateManager.state).toBe("Indexed")
	})

	it("should perform full scan when collection is newly created", async () => {
		// Arrange: new collection created
		vectorStore.initialize.mockResolvedValue(true) // new collection created
		vectorStore.hasIndexedData.mockResolvedValue(false) // no data yet
		vectorStore.markIndexingIncomplete.mockResolvedValue(undefined)
		vectorStore.markIndexingComplete.mockResolvedValue(undefined)

		// Mock scanner to return successful result for full scan
		scanner.scanDirectory.mockResolvedValue({
			stats: {
				filesProcessed: 100,
				blocksFound: 500,
				blocksIndexed: 500,
			},
		})

		// Clear cache when new collection is created
		cacheManager.clearCacheFile.mockResolvedValue(undefined)

		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
		)

		// Act
		await orchestrator.startIndexing()

		// Assert
		// Should check for existing data
		expect(vectorStore.hasIndexedData).toHaveBeenCalledTimes(1)

		// Should clear cache since collection was newly created
		expect(cacheManager.clearCacheFile).toHaveBeenCalledTimes(1)

		// Should perform full scan
		expect(scanner.scanDirectory).toHaveBeenCalledTimes(1)

		// Should mark indexing as incomplete at start and complete at end
		expect(vectorStore.markIndexingIncomplete).toHaveBeenCalledTimes(1)
		expect(vectorStore.markIndexingComplete).toHaveBeenCalledTimes(1)

		// Should end in Indexed state
		expect(stateManager.state).toBe("Indexed")
	})
})
