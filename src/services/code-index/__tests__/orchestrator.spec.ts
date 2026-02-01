import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { CodeIndexOrchestrator, FilePriority } from "../orchestrator"

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
			fs: {
				readFile: vi.fn().mockResolvedValue(Buffer.from("mock file content")),
			},
		},
		Uri: {
			file: vi.fn().mockImplementation((p: string) => ({ fsPath: p })),
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
			getHash: vi.fn(),
			getAllHashes: vi.fn().mockReturnValue({}),
			updateHash: vi.fn(),
			deleteHash: vi.fn(),
		}

		vectorStore = {
			initialize: vi.fn(),
			hasIndexedData: vi.fn(),
			markIndexingIncomplete: vi.fn(),
			markIndexingComplete: vi.fn(),
			clearCollection: vi.fn().mockResolvedValue(undefined),
			deletePointsByFilePath: vi.fn().mockResolvedValue(undefined),
			upsertPoints: vi.fn().mockResolvedValue(undefined),
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
})

describe("CodeIndexOrchestrator - Smart Incremental Indexing", () => {
	const workspacePath = "/test/workspace"

	let configManager: any
	let stateManager: any
	let cacheManager: any
	let vectorStore: any
	let scanner: any
	let fileWatcher: any
	let codeParser: any

	beforeEach(() => {
		vi.clearAllMocks()

		configManager = {
			isFeatureConfigured: true,
		}

		stateManager = {
			get state() {
				return "Standby"
			},
			setSystemState: vi.fn(),
			reportFileQueueProgress: vi.fn(),
			reportBlockIndexingProgress: vi.fn(),
		}

		cacheManager = {
			clearCacheFile: vi.fn().mockResolvedValue(undefined),
			getHash: vi.fn(),
			getAllHashes: vi.fn().mockReturnValue({}),
			updateHash: vi.fn(),
			deleteHash: vi.fn(),
		}

		vectorStore = {
			initialize: vi.fn().mockResolvedValue(false),
			hasIndexedData: vi.fn().mockResolvedValue(true),
			markIndexingIncomplete: vi.fn().mockResolvedValue(undefined),
			markIndexingComplete: vi.fn().mockResolvedValue(undefined),
			deletePointsByFilePath: vi.fn().mockResolvedValue(undefined),
			upsertPoints: vi.fn().mockResolvedValue(undefined),
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

		codeParser = {
			parseFile: vi.fn().mockResolvedValue([
				{
					file_path: "/test/file.ts",
					identifier: "testFunc",
					type: "function",
					start_line: 1,
					end_line: 10,
					content: "function testFunc() {}\n",
					fileHash: "abc123",
					segmentHash: "def456",
				},
			]),
		}
	})

	it("should detect changed files correctly", async () => {
		// Arrange: Set up cached hashes and indexed files
		cacheManager.getAllHashes.mockReturnValue({
			"/test/file1.ts": "hash1",
			"/test/file2.ts": "hash2",
			"/test/file3.ts": "hash3",
		})

		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Manually add indexed files to simulate existing state
		// @ts-expect-error - accessing private property for testing
		orchestrator.indexedFiles.set("/test/file1.ts", {
			path: "/test/file1.ts",
			contentHash: "hash1",
			lastIndexed: Date.now(),
			priority: FilePriority.LOW,
		})
		// @ts-expect-error - accessing private property for testing
		orchestrator.indexedFiles.set("/test/file2.ts", {
			path: "/test/file2.ts",
			contentHash: "old_hash", // Changed hash
			lastIndexed: Date.now(),
			priority: FilePriority.LOW,
		})

		// Act
		// @ts-expect-error - accessing private method for testing
		const changedFiles = await orchestrator.detectChangedFiles()

		// Assert
		expect(changedFiles).toContain("/test/file2.ts")
		expect(changedFiles).not.toContain("/test/file1.ts")
	})

	it("should detect deleted files correctly", async () => {
		// Arrange
		cacheManager.getAllHashes.mockReturnValue({
			"/test/file1.ts": "hash1",
		})

		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Manually add indexed files
		// @ts-expect-error - accessing private property for testing
		orchestrator.indexedFiles.set("/test/file1.ts", {
			path: "/test/file1.ts",
			contentHash: "hash1",
			lastIndexed: Date.now(),
			priority: FilePriority.LOW,
		})
		// @ts-expect-error - accessing private property for testing
		orchestrator.indexedFiles.set("/test/deleted.ts", {
			path: "/test/deleted.ts",
			contentHash: "hash_deleted",
			lastIndexed: Date.now(),
			priority: FilePriority.LOW,
		})

		// Act
		// @ts-expect-error - accessing private method for testing
		const deletedFiles = await orchestrator.detectDeletedFiles()

		// Assert
		expect(deletedFiles).toContain("/test/deleted.ts")
		expect(deletedFiles).not.toContain("/test/file1.ts")
	})

	it("should perform incremental scan correctly", async () => {
		// Arrange
		cacheManager.getAllHashes.mockReturnValue({
			"/test/file1.ts": "hash1",
			"/test/file2.ts": "new_hash", // Changed
		})

		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Set up indexed files
		// @ts-expect-error - accessing private property for testing
		orchestrator.indexedFiles.set("/test/file1.ts", {
			path: "/test/file1.ts",
			contentHash: "hash1",
			lastIndexed: Date.now(),
			priority: FilePriority.LOW,
		})
		// @ts-expect-error - accessing private property for testing
		orchestrator.indexedFiles.set("/test/deleted.ts", {
			path: "/test/deleted.ts",
			contentHash: "old_hash",
			lastIndexed: Date.now(),
			priority: FilePriority.LOW,
		})

		// Act
		const result = await orchestrator.performIncrementalScan()

		// Assert
		expect(result.changed).toBe(1) // file2.ts changed
		expect(result.deleted).toBe(1) // deleted.ts deleted
		expect(vectorStore.deletePointsByFilePath).toHaveBeenCalledWith("/test/deleted.ts")
	})
})

describe("CodeIndexOrchestrator - Priority-based File Processing", () => {
	const workspacePath = "/test/workspace"

	let configManager: any
	let stateManager: any
	let cacheManager: any
	let vectorStore: any
	let scanner: any
	let fileWatcher: any
	let codeParser: any

	beforeEach(() => {
		vi.clearAllMocks()

		configManager = { isFeatureConfigured: true }
		stateManager = {
			get state() {
				return "Standby"
			},
			setSystemState: vi.fn(),
			reportFileQueueProgress: vi.fn(),
			reportBlockIndexingProgress: vi.fn(),
		}
		cacheManager = {
			getHash: vi.fn().mockReturnValue("hash1"),
			getAllHashes: vi.fn().mockReturnValue({}),
		}
		vectorStore = {
			upsertPoints: vi.fn().mockResolvedValue(undefined),
		}
		scanner = { scanDirectory: vi.fn() }
		fileWatcher = { dispose: vi.fn() }
		codeParser = {
			parseFile: vi.fn().mockResolvedValue([
				{
					file_path: "/test/file.ts",
					identifier: "test",
					type: "function",
					start_line: 1,
					end_line: 5,
					content: "test",
					fileHash: "hash1",
					segmentHash: "seg1",
				},
			]),
		}
	})

	it("should return CRITICAL priority for currently open files", () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		orchestrator.markFileOpen("/test/open.ts")

		expect(orchestrator.calculateFilePriority("/test/open.ts")).toBe(FilePriority.CRITICAL)
	})

	it("should return HIGH priority for recently modified files", () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Add a file that was recently indexed
		// @ts-expect-error - accessing private property for testing
		orchestrator.indexedFiles.set("/test/recent.ts", {
			path: "/test/recent.ts",
			contentHash: "hash1",
			lastIndexed: Date.now(), // Just now
			priority: FilePriority.LOW,
		})

		expect(orchestrator.calculateFilePriority("/test/recent.ts")).toBe(FilePriority.HIGH)
	})

	it("should return MEDIUM priority for files in context", () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Mark a file as open
		orchestrator.markFileOpen("/test/workspace/src/main.ts")

		// Another file in the same directory should be in context
		expect(orchestrator.calculateFilePriority("/test/workspace/src/utils.ts")).toBe(FilePriority.MEDIUM)
	})

	it("should return LOW priority for other files", () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		expect(orchestrator.calculateFilePriority("/test/other.ts")).toBe(FilePriority.LOW)
	})

	it("should process files in priority order", async () => {
		const processedFiles: string[] = []

		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Mark one file as open (CRITICAL)
		orchestrator.markFileOpen("/test/critical.ts")

		// Mock indexFile to track order
		// @ts-expect-error - accessing private method for testing
		const originalIndexFile = orchestrator.indexFile.bind(orchestrator)
		// @ts-expect-error - accessing private property for testing
		orchestrator.indexFile = vi.fn().mockImplementation(async (filePath: string) => {
			processedFiles.push(filePath)
		})

		const files = ["/test/low.ts", "/test/critical.ts", "/test/medium.ts"]
		await orchestrator.processFilesByPriority(files)

		// Critical should be first
		expect(processedFiles[0]).toBe("/test/critical.ts")
	})

	it("should update priority when file is closed", () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Mark file as open
		orchestrator.markFileOpen("/test/file.ts")
		expect(orchestrator.calculateFilePriority("/test/file.ts")).toBe(FilePriority.CRITICAL)

		// Close file
		orchestrator.markFileClosed("/test/file.ts")
		expect(orchestrator.calculateFilePriority("/test/file.ts")).toBe(FilePriority.LOW)
	})
})

describe("CodeIndexOrchestrator - Parse Result Caching", () => {
	const workspacePath = "/test/workspace"

	let configManager: any
	let stateManager: any
	let cacheManager: any
	let vectorStore: any
	let scanner: any
	let fileWatcher: any
	let codeParser: any

	beforeEach(() => {
		vi.clearAllMocks()

		configManager = { isFeatureConfigured: true }
		stateManager = {
			get state() {
				return "Standby"
			},
			setSystemState: vi.fn(),
		}
		cacheManager = { getHash: vi.fn().mockReturnValue("hash1") }
		vectorStore = { upsertPoints: vi.fn().mockResolvedValue(undefined) }
		scanner = { scanDirectory: vi.fn() }
		fileWatcher = { dispose: vi.fn() }
		codeParser = {
			parseFile: vi.fn().mockResolvedValue([
				{
					file_path: "/test/file.ts",
					identifier: "test",
					type: "function",
					start_line: 1,
					end_line: 5,
					content: "test",
					fileHash: "hash1",
					segmentHash: "seg1",
				},
			]),
		}
	})

	it("should return cached result for unchanged file", async () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// First parse
		const result1 = await orchestrator.getOrParseFile("/test/file.ts")
		expect(codeParser.parseFile).toHaveBeenCalledTimes(1)

		// Second parse should use cache
		const result2 = await orchestrator.getOrParseFile("/test/file.ts")
		expect(codeParser.parseFile).toHaveBeenCalledTimes(1) // Still 1, not 2
		expect(result2).toEqual(result1)
	})

	it("should re-parse file when content changes", async () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// First parse
		await orchestrator.getOrParseFile("/test/file.ts")
		expect(codeParser.parseFile).toHaveBeenCalledTimes(1)

		// Clear cache entry manually to simulate content change
		// @ts-expect-error - accessing private property for testing
		orchestrator.parseResultCache.delete("/test/file.ts")

		// Second parse should re-parse
		await orchestrator.getOrParseFile("/test/file.ts")
		expect(codeParser.parseFile).toHaveBeenCalledTimes(2)
	})

	it("should clear parse cache correctly", async () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Populate cache
		await orchestrator.getOrParseFile("/test/file.ts")

		// Clear cache
		orchestrator.clearParseCache()

		// @ts-expect-error - accessing private property for testing
		expect(orchestrator.parseResultCache.size).toBe(0)
	})

	it("should report correct cache statistics", () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		const stats = orchestrator.getParseCacheStats()
		expect(stats.maxSize).toBe(500)
		expect(stats.size).toBe(0)
	})

	it("should evict oldest cache entries when full", async () => {
		// Create orchestrator with small cache
		const smallCacheOrchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Manually set max cache size to 3 for testing
		// @ts-expect-error - accessing private property for testing
		smallCacheOrchestrator.maxParseCacheSize = 3

		// Add 4 entries to trigger eviction
		// @ts-expect-error - accessing private property for testing
		smallCacheOrchestrator.setParseCache("/test/file1.ts", [{ file_path: "f1" } as any], "hash1")
		// @ts-expect-error - accessing private property for testing
		smallCacheOrchestrator.setParseCache("/test/file2.ts", [{ file_path: "f2" } as any], "hash2")
		// @ts-expect-error - accessing private property for testing
		smallCacheOrchestrator.setParseCache("/test/file3.ts", [{ file_path: "f3" } as any], "hash3")
		// @ts-expect-error - accessing private property for testing
		smallCacheOrchestrator.setParseCache("/test/file4.ts", [{ file_path: "f4" } as any], "hash4")

		// @ts-expect-error - accessing private property for testing
		expect(smallCacheOrchestrator.parseResultCache.size).toBe(3)
		// @ts-expect-error - accessing private property for testing
		expect(smallCacheOrchestrator.parseResultCache.has("/test/file1.ts")).toBe(false) // Oldest should be evicted
	})
})

describe("CodeIndexOrchestrator - Performance", () => {
	const workspacePath = "/test/workspace"

	let configManager: any
	let stateManager: any
	let cacheManager: any
	let vectorStore: any
	let scanner: any
	let fileWatcher: any
	let codeParser: any

	beforeEach(() => {
		vi.clearAllMocks()

		configManager = { isFeatureConfigured: true }
		stateManager = {
			get state() {
				return "Standby"
			},
			setSystemState: vi.fn(),
		}
		cacheManager = {
			getHash: vi.fn().mockReturnValue("hash1"),
			getAllHashes: vi.fn().mockReturnValue({}),
		}
		vectorStore = {
			upsertPoints: vi.fn().mockResolvedValue(undefined),
			deletePointsByFilePath: vi.fn().mockResolvedValue(undefined),
		}
		scanner = { scanDirectory: vi.fn() }
		fileWatcher = { dispose: vi.fn() }
		codeParser = {
			parseFile: vi.fn().mockResolvedValue([
				{
					file_path: "/test/file.ts",
					identifier: "test",
					type: "function",
					start_line: 1,
					end_line: 5,
					content: "test",
					fileHash: "hash1",
					segmentHash: "seg1",
				},
			]),
		}
	})

	it("should track indexed file count correctly", () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		expect(orchestrator.getIndexedFileCount()).toBe(0)

		// @ts-expect-error - accessing private property for testing
		orchestrator.indexedFiles.set("/test/file1.ts", {
			path: "/test/file1.ts",
			contentHash: "hash1",
			lastIndexed: Date.now(),
			priority: FilePriority.LOW,
		})

		expect(orchestrator.getIndexedFileCount()).toBe(1)

		// @ts-expect-error - accessing private property for testing
		orchestrator.indexedFiles.set("/test/file2.ts", {
			path: "/test/file2.ts",
			contentHash: "hash2",
			lastIndexed: Date.now(),
			priority: FilePriority.LOW,
		})

		expect(orchestrator.getIndexedFileCount()).toBe(2)
	})

	it("should return all indexed files", () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// @ts-expect-error - accessing private property for testing
		orchestrator.indexedFiles.set("/test/file1.ts", {
			path: "/test/file1.ts",
			contentHash: "hash1",
			lastIndexed: Date.now(),
			priority: FilePriority.LOW,
		})

		const files = orchestrator.getIndexedFiles()
		expect(files).toHaveLength(1)
		expect(files[0].path).toBe("/test/file1.ts")
	})

	it("should handle large number of files efficiently", async () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Add 100 files
		for (let i = 0; i < 100; i++) {
			// @ts-expect-error - accessing private property for testing
			orchestrator.indexedFiles.set(`/test/file${i}.ts`, {
				path: `/test/file${i}.ts`,
				contentHash: `hash${i}`,
				lastIndexed: Date.now(),
				priority: FilePriority.LOW,
			})
		}

		expect(orchestrator.getIndexedFileCount()).toBe(100)

		// Performance test - should complete quickly
		const startTime = Date.now()
		const files = orchestrator.getIndexedFiles()
		const elapsed = Date.now() - startTime

		expect(elapsed).toBeLessThan(100) // Should complete in under 100ms
		expect(files).toHaveLength(100)
	})

	it("should not re-parse unchanged files when processing by priority", async () => {
		const orchestrator = new CodeIndexOrchestrator(
			configManager,
			stateManager,
			workspacePath,
			cacheManager,
			vectorStore,
			scanner,
			fileWatcher,
			codeParser,
		)

		// Pre-populate parse cache
		await orchestrator.getOrParseFile("/test/file.ts")
		expect(codeParser.parseFile).toHaveBeenCalledTimes(1)

		// Get from cache multiple times
		await orchestrator.getOrParseFile("/test/file.ts")
		await orchestrator.getOrParseFile("/test/file.ts")
		await orchestrator.getOrParseFile("/test/file.ts")

		// Should still only have parsed once
		expect(codeParser.parseFile).toHaveBeenCalledTimes(1)
	})

	describe("CodeIndexOrchestrator - File Type Statistics", () => {
		let orchestrator: CodeIndexOrchestrator
		let mockConfigManager: any
		let mockStateManager: any
		let mockCacheManager: any
		let mockVectorStore: any
		let mockScanner: any
		let mockFileWatcher: any
		let mockCodeParser: any
		const workspacePath = "/test/workspace"

		beforeEach(() => {
			mockConfigManager = {
				isFeatureConfigured: true,
				isFeatureEnabled: true,
			}

			mockStateManager = {
				setSystemState: vi.fn(),
				reportBlockIndexingProgress: vi.fn(),
				reportFileQueueProgress: vi.fn(),
				setFileTypeStats: vi.fn(),
				getCurrentStatus: vi.fn().mockReturnValue({
					systemStatus: "Standby",
					message: "",
					processedItems: 0,
					totalItems: 0,
					currentItemUnit: "blocks",
					fileTypeStats: [],
					totalFileCount: 0,
				}),
				state: "Standby" as const,
			}

			mockCacheManager = {
				getHash: vi.fn(),
				getAllHashes: vi.fn().mockReturnValue({}),
				initialize: vi.fn().mockResolvedValue(undefined),
			}

			mockVectorStore = {
				initialize: vi.fn().mockResolvedValue(true),
				hasIndexedData: vi.fn().mockResolvedValue(false),
				markIndexingIncomplete: vi.fn().mockResolvedValue(undefined),
				markIndexingComplete: vi.fn().mockResolvedValue(undefined),
				deleteCollection: vi.fn().mockResolvedValue(undefined),
				upsertPoints: vi.fn().mockResolvedValue(undefined),
				deletePointsByFilePath: vi.fn().mockResolvedValue(undefined),
				clearCollection: vi.fn().mockResolvedValue(undefined),
			}

			mockScanner = {
				scanDirectory: vi.fn().mockResolvedValue({
					success: true,
					stats: { filesFound: 0, blocksFound: 0 },
				}),
			}

			mockFileWatcher = {
				initialize: vi.fn().mockResolvedValue(undefined),
				onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				onDidFinishBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				dipose: vi.fn(),
			}

			mockCodeParser = {
				parseFile: vi.fn().mockResolvedValue([]),
			}

			orchestrator = new CodeIndexOrchestrator(
				mockConfigManager,
				mockStateManager,
				workspacePath,
				mockCacheManager,
				mockVectorStore,
				mockScanner,
				mockFileWatcher,
				mockCodeParser,
			)
		})

		it("should return correct file type stats for mixed files", () => {
			// Mock getAllHashes to return files with different extensions
			mockCacheManager.getAllHashes.mockReturnValue({
				"/test/file1.ts": "hash1",
				"/test/file2.ts": "hash2",
				"/test/file3.js": "hash3",
				"/test/readme.md": "hash4",
			})

			const stats = orchestrator.getFileTypeStats()

			expect(stats).toHaveLength(3)
			expect(stats[0].extension).toBe(".ts")
			expect(stats[0].count).toBe(2)
			expect(stats[1].extension).toBe(".js")
			expect(stats[1].count).toBe(1)
			expect(stats[2].extension).toBe(".md")
			expect(stats[2].count).toBe(1)
		})

		it("should sort file type stats by count descending", () => {
			// Mock getAllHashes with varying counts
			mockCacheManager.getAllHashes.mockReturnValue({
				"/test/a.py": "hash1",
				"/test/b.py": "hash2",
				"/test/c.py": "hash3",
				"/test/a.ts": "hash4",
			})

			const stats = orchestrator.getFileTypeStats()

			expect(stats[0].extension).toBe(".py")
			expect(stats[0].count).toBe(3)
			expect(stats[1].extension).toBe(".ts")
			expect(stats[1].count).toBe(1)
		})

		it("should handle files without extensions", () => {
			mockCacheManager.getAllHashes.mockReturnValue({
				"/test/Makefile": "hash1",
				"/test/Dockerfile": "hash2",
			})

			const stats = orchestrator.getFileTypeStats()

			expect(stats).toHaveLength(1)
			expect(stats[0].extension).toBe(".noext")
			expect(stats[0].count).toBe(2)
		})

		it("should return empty array when no files indexed", () => {
			const stats = orchestrator.getFileTypeStats()

			expect(stats).toEqual([])
		})

		it("should return correct total file count", () => {
			mockCacheManager.getAllHashes.mockReturnValue({
				"/test/file1.ts": "hash1",
				"/test/file2.js": "hash2",
				"/test/file3.py": "hash3",
			})

			expect(orchestrator.getTotalFileCount()).toBe(3)
		})

		it("should return zero for empty index", () => {
			expect(orchestrator.getTotalFileCount()).toBe(0)
		})

		it("should filter files by extension", () => {
			// @ts-expect-error - accessing private property for testing
			orchestrator.indexedFiles.set("/test/file1.ts", {
				path: "/test/file1.ts",
				contentHash: "hash1",
				lastIndexed: Date.now(),
				priority: FilePriority.LOW,
			})
			// @ts-expect-error - accessing private property for testing
			orchestrator.indexedFiles.set("/test/file2.ts", {
				path: "/test/file2.ts",
				contentHash: "hash2",
				lastIndexed: Date.now(),
				priority: FilePriority.LOW,
			})
			// @ts-expect-error - accessing private property for testing
			orchestrator.indexedFiles.set("/test/file3.js", {
				path: "/test/file3.js",
				contentHash: "hash3",
				lastIndexed: Date.now(),
				priority: FilePriority.LOW,
			})

			const tsFiles = orchestrator.getFilesByExtension(".ts")

			expect(tsFiles).toHaveLength(2)
			expect(tsFiles.every((f) => f.path.endsWith(".ts"))).toBe(true)
		})

		it("should filter files by extension with or without dot", () => {
			// @ts-expect-error - accessing private property for testing
			orchestrator.indexedFiles.set("/test/file1.ts", {
				path: "/test/file1.ts",
				contentHash: "hash1",
				lastIndexed: Date.now(),
				priority: FilePriority.LOW,
			})

			const filesWithDot = orchestrator.getFilesByExtension(".ts")
			const filesWithoutDot = orchestrator.getFilesByExtension("ts")

			expect(filesWithDot).toHaveLength(1)
			expect(filesWithoutDot).toHaveLength(1)
		})

		it("should update file type stats in state manager", () => {
			mockCacheManager.getAllHashes.mockReturnValue({
				"/test/file1.ts": "hash1",
				"/test/file2.js": "hash2",
			})

			orchestrator.updateFileTypeStats()

			expect(mockStateManager.setFileTypeStats).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ extension: ".ts" }),
					expect.objectContaining({ extension: ".js" }),
				]),
				2,
			)
		})

		it("should handle case-insensitive extension matching", () => {
			mockCacheManager.getAllHashes.mockReturnValue({
				"/test/file1.TS": "hash1",
				"/test/file2.ts": "hash2",
			})

			const stats = orchestrator.getFileTypeStats()

			expect(stats).toHaveLength(1)
			expect(stats[0].extension).toBe(".ts")
			expect(stats[0].count).toBe(2)
		})
	})
})
