import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { TaskMetadata, FileMetadataEntry } from "../FileContextTrackerTypes"

// Mock dependencies before importing FileContextTracker
const mockGetTaskMetadata = vi.fn()
const mockSaveTaskMetadata = vi.fn()

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
		createFileSystemWatcher: vi.fn(() => ({
			onDidChange: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
	RelativePattern: vi.fn(),
}))

vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi.fn().mockResolvedValue("/test/task/dir"),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(true),
}))

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
	},
}))

// Import after mocks
import { FileContextTracker } from "../FileContextTracker"

describe("FileContextTracker.rewindToTimestamp", () => {
	let tracker: FileContextTracker
	let mockProvider: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockProvider = {
			contextProxy: {
				globalStorageUri: { fsPath: "/test/global/storage" },
			},
		}

		tracker = new FileContextTracker(mockProvider, "test-task-id")

		// Override getTaskMetadata and saveTaskMetadata for testing
		tracker.getTaskMetadata = mockGetTaskMetadata
		tracker.saveTaskMetadata = mockSaveTaskMetadata
	})

	afterEach(() => {
		tracker.dispose()
	})

	describe("basic rewind functionality", () => {
		it("should remove entries where containingMessageTs >= cutoffTs", async () => {
			const metadata: TaskMetadata = {
				files_in_context: [
					{
						path: "file1.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 1000,
						roo_edit_date: null,
						containingMessageTs: 1000, // Before cutoff - should keep
					},
					{
						path: "file2.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 2000,
						roo_edit_date: null,
						containingMessageTs: 2000, // At cutoff - should remove
					},
					{
						path: "file3.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 3000,
						roo_edit_date: null,
						containingMessageTs: 3000, // After cutoff - should remove
					},
				],
			}

			mockGetTaskMetadata.mockResolvedValue(metadata)
			mockSaveTaskMetadata.mockResolvedValue(undefined)

			await tracker.rewindToTimestamp(2000)

			expect(mockSaveTaskMetadata).toHaveBeenCalledWith("test-task-id", {
				files_in_context: [
					expect.objectContaining({
						path: "file1.ts",
						containingMessageTs: 1000,
					}),
				],
			})
		})

		it("should not remove entries without containingMessageTs", async () => {
			const metadata: TaskMetadata = {
				files_in_context: [
					{
						path: "legacy-file.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 3000,
						roo_edit_date: null,
						// No containingMessageTs - legacy entry
					},
					{
						path: "new-file.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 3000,
						roo_edit_date: null,
						containingMessageTs: 3000, // After cutoff - should remove
					},
				],
			}

			mockGetTaskMetadata.mockResolvedValue(metadata)
			mockSaveTaskMetadata.mockResolvedValue(undefined)

			await tracker.rewindToTimestamp(2000)

			expect(mockSaveTaskMetadata).toHaveBeenCalledWith("test-task-id", {
				files_in_context: [
					expect.objectContaining({
						path: "legacy-file.ts",
						record_state: "active",
					}),
				],
			})
		})
	})

	describe("stale entry restoration", () => {
		it("should restore newest stale entry to active when active entry is removed", async () => {
			const metadata: TaskMetadata = {
				files_in_context: [
					{
						path: "file.ts",
						record_state: "stale",
						record_source: "read_tool",
						roo_read_date: 1000,
						roo_edit_date: null,
						containingMessageTs: 1000,
					},
					{
						path: "file.ts",
						record_state: "stale",
						record_source: "read_tool",
						roo_read_date: 1500, // Newer stale entry
						roo_edit_date: null,
						containingMessageTs: 1500,
					},
					{
						path: "file.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 2000,
						roo_edit_date: null,
						containingMessageTs: 2000, // Will be removed
					},
				],
			}

			mockGetTaskMetadata.mockResolvedValue(metadata)
			mockSaveTaskMetadata.mockResolvedValue(undefined)

			await tracker.rewindToTimestamp(2000)

			// Verify the saved metadata
			expect(mockSaveTaskMetadata).toHaveBeenCalledWith("test-task-id", {
				files_in_context: expect.arrayContaining([
					expect.objectContaining({
						path: "file.ts",
						roo_read_date: 1000,
						record_state: "stale", // First entry stays stale
					}),
					expect.objectContaining({
						path: "file.ts",
						roo_read_date: 1500,
						record_state: "active", // Newest stale entry restored to active
					}),
				]),
			})

			// Verify the removed entry is gone
			const savedMetadata = mockSaveTaskMetadata.mock.calls[0][1] as TaskMetadata
			expect(savedMetadata.files_in_context).toHaveLength(2)
			expect(savedMetadata.files_in_context.find((e) => e.roo_read_date === 2000)).toBeUndefined()
		})

		it("should not restore stale entry if active entry still exists after rewind", async () => {
			const metadata: TaskMetadata = {
				files_in_context: [
					{
						path: "file.ts",
						record_state: "stale",
						record_source: "read_tool",
						roo_read_date: 500,
						roo_edit_date: null,
						containingMessageTs: 500,
					},
					{
						path: "file.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 1000,
						roo_edit_date: null,
						containingMessageTs: 1000, // Before cutoff - stays active
					},
					{
						path: "file.ts",
						record_state: "stale", // Already stale
						record_source: "read_tool",
						roo_read_date: 1500,
						roo_edit_date: null,
						containingMessageTs: 3000, // After cutoff - will be removed
					},
				],
			}

			mockGetTaskMetadata.mockResolvedValue(metadata)
			mockSaveTaskMetadata.mockResolvedValue(undefined)

			await tracker.rewindToTimestamp(2000)

			const savedMetadata = mockSaveTaskMetadata.mock.calls[0][1] as TaskMetadata

			// The original active entry should still be active
			const activeEntry = savedMetadata.files_in_context.find((e) => e.roo_read_date === 1000)
			expect(activeEntry?.record_state).toBe("active")

			// The remaining stale entry should still be stale (not promoted)
			const staleEntry = savedMetadata.files_in_context.find((e) => e.roo_read_date === 500)
			expect(staleEntry?.record_state).toBe("stale")
		})

		it("should handle multiple files with different rewind scenarios", async () => {
			const metadata: TaskMetadata = {
				files_in_context: [
					// File A: active entry removed, has stale to restore
					{
						path: "fileA.ts",
						record_state: "stale",
						record_source: "read_tool",
						roo_read_date: 1000,
						roo_edit_date: null,
						containingMessageTs: 1000,
					},
					{
						path: "fileA.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 3000,
						roo_edit_date: null,
						containingMessageTs: 3000, // Removed
					},
					// File B: active entry stays (before cutoff)
					{
						path: "fileB.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 1500,
						roo_edit_date: null,
						containingMessageTs: 1500,
					},
					// File C: all entries removed
					{
						path: "fileC.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 3000,
						roo_edit_date: null,
						containingMessageTs: 3000, // Removed
					},
				],
			}

			mockGetTaskMetadata.mockResolvedValue(metadata)
			mockSaveTaskMetadata.mockResolvedValue(undefined)

			await tracker.rewindToTimestamp(2000)

			const savedMetadata = mockSaveTaskMetadata.mock.calls[0][1] as TaskMetadata

			// FileA: stale entry should be restored to active
			const fileAEntry = savedMetadata.files_in_context.find((e) => e.path === "fileA.ts")
			expect(fileAEntry?.record_state).toBe("active")
			expect(fileAEntry?.roo_read_date).toBe(1000)

			// FileB: should stay as-is
			const fileBEntry = savedMetadata.files_in_context.find((e) => e.path === "fileB.ts")
			expect(fileBEntry?.record_state).toBe("active")
			expect(fileBEntry?.roo_read_date).toBe(1500)

			// FileC: should be completely removed
			const fileCEntry = savedMetadata.files_in_context.find((e) => e.path === "fileC.ts")
			expect(fileCEntry).toBeUndefined()
		})
	})

	describe("edge cases", () => {
		it("should handle empty metadata", async () => {
			const metadata: TaskMetadata = {
				files_in_context: [],
			}

			mockGetTaskMetadata.mockResolvedValue(metadata)
			mockSaveTaskMetadata.mockResolvedValue(undefined)

			await tracker.rewindToTimestamp(2000)

			expect(mockSaveTaskMetadata).toHaveBeenCalledWith("test-task-id", {
				files_in_context: [],
			})
		})

		it("should handle entries with null containingMessageTs", async () => {
			const metadata: TaskMetadata = {
				files_in_context: [
					{
						path: "file.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 3000,
						roo_edit_date: null,
						containingMessageTs: null, // Explicitly null
					},
				],
			}

			mockGetTaskMetadata.mockResolvedValue(metadata)
			mockSaveTaskMetadata.mockResolvedValue(undefined)

			await tracker.rewindToTimestamp(2000)

			// Entry with null containingMessageTs should be preserved
			const savedMetadata = mockSaveTaskMetadata.mock.calls[0][1] as TaskMetadata
			expect(savedMetadata.files_in_context).toHaveLength(1)
		})

		it("should handle stale entries without roo_read_date", async () => {
			const metadata: TaskMetadata = {
				files_in_context: [
					{
						path: "file.ts",
						record_state: "stale",
						record_source: "user_edited",
						roo_read_date: null, // No roo_read_date
						roo_edit_date: null,
						user_edit_date: 1000,
						containingMessageTs: 1000,
					},
					{
						path: "file.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: 2000,
						roo_edit_date: null,
						containingMessageTs: 2000, // Will be removed
					},
				],
			}

			mockGetTaskMetadata.mockResolvedValue(metadata)
			mockSaveTaskMetadata.mockResolvedValue(undefined)

			await tracker.rewindToTimestamp(2000)

			// Stale entry without roo_read_date should NOT be restored
			// (only entries with roo_read_date are considered for restoration)
			const savedMetadata = mockSaveTaskMetadata.mock.calls[0][1] as TaskMetadata
			const remainingEntry = savedMetadata.files_in_context.find((e) => e.path === "file.ts")
			expect(remainingEntry?.record_state).toBe("stale")
		})

		it("should handle errors gracefully", async () => {
			mockGetTaskMetadata.mockRejectedValue(new Error("Test error"))

			// Should not throw
			await expect(tracker.rewindToTimestamp(2000)).resolves.not.toThrow()

			// saveTaskMetadata should not be called if getTaskMetadata fails
			expect(mockSaveTaskMetadata).not.toHaveBeenCalled()
		})
	})
})
