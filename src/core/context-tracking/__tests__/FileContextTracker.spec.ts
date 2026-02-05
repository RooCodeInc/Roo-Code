import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest"
import { FileContextTracker, UsageStats, ContextSummary } from "../FileContextTracker"

// Mock vscode module
const mockWatchers = new Map<string, { dispose: Mock }>()
const mockOnDidChangeCallbacks = new Map<string, () => void>()

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
		createFileSystemWatcher: vi.fn(() => {
			const filePath = `mockWatcher_${mockWatchers.size}`
			const callbacks = mockOnDidChangeCallbacks
			const watcher = {
				dispose: vi.fn(() => {
					mockWatchers.delete(filePath)
				}),
				onDidChange: vi.fn((callback: () => void) => {
					callbacks.set(filePath, callback)
				}),
			}
			mockWatchers.set(filePath, watcher)
			return watcher
		}),
	},
	Uri: {
		file: (path: string) => ({ fsPath: path }),
	},
}))

// Mock dependencies
vi.mock("../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn(),
}))

vi.mock("../../utils/storage", () => ({
	getTaskDirectoryPath: vi.fn(() => Promise.resolve("/test/task-dir")),
}))

vi.mock("../../shared/globalFileNames", () => ({
	GlobalFileNames: {
		taskMetadata: "task-metadata.json",
	},
}))

vi.mock("../../utils/fs", () => ({
	fileExistsAtPath: vi.fn(() => Promise.resolve(true)),
}))

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(() => Promise.resolve(JSON.stringify({ files_in_context: [] }))),
	},
}))

vi.mock("../config/ContextProxy", () => ({
	ContextProxy: vi.fn(),
}))

describe("FileContextTracker", () => {
	let tracker: FileContextTracker
	const mockProvider = {
		contextProxy: {
			globalStorageUri: { fsPath: "/test/storage" },
		},
	} as any

	beforeEach(() => {
		vi.clearAllMocks()
		mockWatchers.clear()
		mockOnDidChangeCallbacks.clear()
		tracker = new FileContextTracker(mockProvider, "test-task-id")
	})

	afterEach(() => {
		tracker.dispose()
	})

	// ============================================================================
	// Phase 3: Usage Tracking Tests
	// ============================================================================

	describe("Usage Tracking", () => {
		it("should initialize with empty usage stats", () => {
			expect(tracker.getAllUsageStats().size).toBe(0)
		})

		it("should track read count when file is accessed", () => {
			// Simulate reading a file
			;(tracker as any).trackUsage("/test/file.ts", false)

			const stats = tracker.getUsageStats("/test/file.ts")
			expect(stats).toBeDefined()
			expect(stats?.readCount).toBe(1)
			expect(stats?.editCount).toBe(0)
		})

		it("should track edit count when file is edited", () => {
			// Simulate editing a file
			;(tracker as any).trackUsage("/test/file.ts", true)

			const stats = tracker.getUsageStats("/test/file.ts")
			expect(stats).toBeDefined()
			expect(stats?.readCount).toBe(0)
			expect(stats?.editCount).toBe(1)
		})

		it("should accumulate usage counts", () => {
			;(tracker as any).trackUsage("/test/file.ts", false)
			;(tracker as any).trackUsage("/test/file.ts", false)
			;(tracker as any).trackUsage("/test/file.ts", true)

			const stats = tracker.getUsageStats("/test/file.ts")
			expect(stats?.readCount).toBe(2)
			expect(stats?.editCount).toBe(1)
		})

		it("should update last accessed timestamp", () => {
			const before = Date.now()
			;(tracker as any).trackUsage("/test/file.ts", false)
			const after = Date.now()

			const stats = tracker.getUsageStats("/test/file.ts")
			expect(stats?.lastAccessed).toBeGreaterThanOrEqual(before)
			expect(stats?.lastAccessed).toBeLessThanOrEqual(after)
		})
	})

	describe("Hot Files Detection", () => {
		it("should return empty array when no files tracked", () => {
			expect(tracker.getHotFiles()).toEqual([])
		})

		it("should return files sorted by read count", () => {
			;(tracker as any).trackUsage("/file-a.ts", false)
			;(tracker as any).trackUsage("/file-b.ts", false)
			;(tracker as any).trackUsage("/file-b.ts", false) // Read twice

			const hotFiles = tracker.getHotFiles()
			expect(hotFiles[0]).toBe("/file-b.ts")
			expect(hotFiles[1]).toBe("/file-a.ts")
		})

		it("should respect limit parameter", () => {
			for (let i = 0; i < 15; i++) {
				;(tracker as any).trackUsage(`/file-${i}.ts`, false)
			}

			const hotFiles = tracker.getHotFiles(5)
			expect(hotFiles.length).toBe(5)
		})

		it("should handle equal read counts with stable sort", () => {
			;(tracker as any).trackUsage("/file-a.ts", false)
			;(tracker as any).trackUsage("/file-b.ts", false)

			const hotFiles = tracker.getHotFiles()
			expect(hotFiles.length).toBe(2)
			// Both files should be present, order is not guaranteed for equal counts
			expect(hotFiles).toContain("/file-a.ts")
			expect(hotFiles).toContain("/file-b.ts")
		})
	})

	// ============================================================================
	// Phase 3: Context Summary Caching Tests
	// ============================================================================

	describe("Context Summary Caching", () => {
		it("should return undefined for non-existent summary", () => {
			const cached = tracker.getCachedSummary("non-existent-hash")
			expect(cached).toBeUndefined()
		})

		it("should cache and retrieve summary", () => {
			const hash = "test-messages-hash"
			const summary = "This is a test summary"
			const tokenCount = 100

			tracker.cacheSummary(hash, summary, tokenCount)
			const cached = tracker.getCachedSummary(hash)

			expect(cached).toBeDefined()
			expect(cached?.summary).toBe(summary)
			expect(cached?.tokenCount).toBe(tokenCount)
			expect(cached?.messagesHash).toBe(hash)
		})

		it("should expire cached summaries after 1 hour", () => {
			const hash = "test-hash"
			tracker.cacheSummary(hash, "summary", 50)

			// Cache should be valid
			expect(tracker.getCachedSummary(hash)).toBeDefined()

			// Manually expire the cache (simulate time passing)
			const cache = (tracker as any).summaryCache
			const cached = cache.get(hash)
			cached.timestamp = Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago

			// Cache should now be expired
			expect(tracker.getCachedSummary(hash)).toBeUndefined()
		})

		it("should clear summary cache", () => {
			tracker.cacheSummary("hash-1", "summary-1", 50)
			tracker.cacheSummary("hash-2", "summary-2", 60)

			expect(tracker.getSummaryCacheSize()).toBe(2)

			tracker.clearSummaryCache()

			expect(tracker.getSummaryCacheSize()).toBe(0)
			expect(tracker.getCachedSummary("hash-1")).toBeUndefined()
			expect(tracker.getCachedSummary("hash-2")).toBeUndefined()
		})

		it("should report correct cache size", () => {
			expect(tracker.getSummaryCacheSize()).toBe(0)

			tracker.cacheSummary("hash-1", "summary-1", 50)
			expect(tracker.getSummaryCacheSize()).toBe(1)

			tracker.cacheSummary("hash-2", "summary-2", 60)
			expect(tracker.getSummaryCacheSize()).toBe(2)
		})
	})

	// ============================================================================
	// Phase 3: Memory Leak Prevention Tests
	// ============================================================================

	describe("Memory Leak Prevention", () => {
		it("should dispose watchers on cleanup", () => {
			// Simulate adding a watcher
			const mockWatcher = {
				dispose: vi.fn(),
			}
			;(tracker as any).fileWatchers.set("/test/file.ts", mockWatcher as any)
			;(tracker as any).usageStats.set("/test/file.ts", {
				readCount: 1,
				lastAccessed: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
				editCount: 0,
			})

			tracker.cleanupWatchers()

			expect(mockWatcher.dispose).toHaveBeenCalled()
			expect((tracker as any).fileWatchers.has("/test/file.ts")).toBe(false)
		})

		it("should not remove active watchers", () => {
			const mockWatcher = {
				dispose: vi.fn(),
			}
			;(tracker as any).fileWatchers.set("/test/file.ts", mockWatcher as any)
			;(tracker as any).usageStats.set("/test/file.ts", {
				readCount: 1,
				lastAccessed: Date.now(), // Just now
				editCount: 0,
			})

			tracker.cleanupWatchers()

			expect(mockWatcher.dispose).not.toHaveBeenCalled()
			expect((tracker as any).fileWatchers.has("/test/file.ts")).toBe(true)
		})

		it("should force cleanup all resources", () => {
			const mockWatcher = {
				dispose: vi.fn(),
			}
			;(tracker as any).fileWatchers.set("/test/file.ts", mockWatcher as any)
			;(tracker as any).usageStats.set("/test/file.ts", { readCount: 1, lastAccessed: Date.now(), editCount: 0 })
			tracker.cacheSummary("hash", "summary", 50)

			tracker.forceCleanup()

			expect(mockWatcher.dispose).toHaveBeenCalled()
			expect((tracker as any).fileWatchers.size).toBe(0)
			expect((tracker as any).usageStats.size).toBe(0)
			expect(tracker.getSummaryCacheSize()).toBe(0)
		})

		it("should handle empty cleanup gracefully", () => {
			expect(() => tracker.cleanupWatchers()).not.toThrow()
			expect(() => tracker.forceCleanup()).not.toThrow()
		})
	})

	// ============================================================================
	// Existing Functionality Tests (Backward Compatibility)
	// ============================================================================

	describe("Backward Compatibility", () => {
		it("should have taskId property", () => {
			expect(tracker.taskId).toBe("test-task-id")
		})

		it("should dispose all watchers", () => {
			const mockWatcher1 = { dispose: vi.fn() }
			const mockWatcher2 = { dispose: vi.fn() }
			;(tracker as any).fileWatchers.set("/file1.ts", mockWatcher1 as any)
			;(tracker as any).fileWatchers.set("/file2.ts", mockWatcher2 as any)

			tracker.dispose()

			expect(mockWatcher1.dispose).toHaveBeenCalled()
			expect(mockWatcher2.dispose).toHaveBeenCalled()
			expect((tracker as any).fileWatchers.size).toBe(0)
		})

		it("should clear usage stats on dispose", () => {
			;(tracker as any).usageStats.set("/file.ts", { readCount: 1, lastAccessed: Date.now(), editCount: 0 })
			tracker.dispose()

			expect((tracker as any).usageStats.size).toBe(0)
		})
	})
})
