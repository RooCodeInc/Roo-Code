// npx vitest run core/context-tracking/__tests__/FileContextTracker.spec.ts

import * as crypto from "crypto"
import { FileContextTracker } from "../FileContextTracker"
import type { TaskMetadata } from "../FileContextTrackerTypes"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidChange: vi.fn(),
			onDidCreate: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		}),
	},
	RelativePattern: vi.fn(),
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
}))

// Mock fs/promises
const mockFsReadFile = vi.fn()
vi.mock("fs/promises", () => ({
	default: {
		readFile: (...args: unknown[]) => mockFsReadFile(...args),
		writeFile: vi.fn().mockResolvedValue(undefined),
		mkdir: vi.fn().mockResolvedValue(undefined),
	},
	readFile: (...args: unknown[]) => mockFsReadFile(...args),
	writeFile: vi.fn().mockResolvedValue(undefined),
	mkdir: vi.fn().mockResolvedValue(undefined),
}))

// Mock fileExistsAtPath
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

// Mock storage utils
vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi.fn().mockResolvedValue("/test/storage/task123"),
}))

// Mock safeWriteJson
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

// Mock ClineProvider
vi.mock("../../webview/ClineProvider", () => ({
	ClineProvider: vi.fn(),
}))

describe("FileContextTracker", () => {
	describe("computeContentHash", () => {
		it("should compute MD5 hash of content", () => {
			const content = "Hello, World!"
			const expectedHash = crypto.createHash("md5").update(content).digest("hex")

			const hash = FileContextTracker.computeContentHash(content)

			expect(hash).toBe(expectedHash)
		})

		it("should return different hashes for different content", () => {
			const content1 = "Hello, World!"
			const content2 = "Hello, World!!"

			const hash1 = FileContextTracker.computeContentHash(content1)
			const hash2 = FileContextTracker.computeContentHash(content2)

			expect(hash1).not.toBe(hash2)
		})

		it("should return same hash for same content", () => {
			const content = "Test content for hashing"

			const hash1 = FileContextTracker.computeContentHash(content)
			const hash2 = FileContextTracker.computeContentHash(content)

			expect(hash1).toBe(hash2)
		})

		it("should handle empty string", () => {
			const content = ""
			const expectedHash = crypto.createHash("md5").update(content).digest("hex")

			const hash = FileContextTracker.computeContentHash(content)

			expect(hash).toBe(expectedHash)
		})

		it("should handle multi-line content", () => {
			const content = "Line 1\nLine 2\nLine 3"
			const expectedHash = crypto.createHash("md5").update(content).digest("hex")

			const hash = FileContextTracker.computeContentHash(content)

			expect(hash).toBe(expectedHash)
		})
	})

	describe("isFileUnchangedInContext", () => {
		let tracker: FileContextTracker
		let mockProvider: any

		beforeEach(() => {
			mockProvider = {
				contextProxy: {
					globalStorageUri: { fsPath: "/test/storage" },
				},
			}
			tracker = new FileContextTracker(mockProvider, "task123")
		})

		it("should return false when no active read entry exists", async () => {
			// Mock getTaskMetadata to return empty metadata
			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [],
			})

			const result = await tracker.isFileUnchangedInContext("test.ts")

			expect(result).toBe(false)
		})

		it("should return false when entry has no content_hash", async () => {
			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [
					{
						path: "test.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: Date.now(),
						roo_edit_date: null,
						user_edit_date: null,
						// No content_hash
					},
				],
			})

			const result = await tracker.isFileUnchangedInContext("test.ts")

			expect(result).toBe(false)
		})

		it("should return false when user edited file after read", async () => {
			const readTime = Date.now() - 1000
			const editTime = Date.now()
			const contentHash = FileContextTracker.computeContentHash("original content")

			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [
					{
						path: "test.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: readTime,
						roo_edit_date: null,
						user_edit_date: editTime, // User edited after read
						content_hash: contentHash,
					},
				],
			})

			const result = await tracker.isFileUnchangedInContext("test.ts")

			expect(result).toBe(false)
		})

		it("should return false when file hash does not match", async () => {
			const contentHash = FileContextTracker.computeContentHash("original content")
			const newContentHash = FileContextTracker.computeContentHash("modified content")

			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [
					{
						path: "test.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: Date.now(),
						roo_edit_date: null,
						user_edit_date: null,
						content_hash: contentHash,
					},
				],
			})

			// Mock computeFileHash to return different hash
			vi.spyOn(tracker, "computeFileHash").mockResolvedValue(newContentHash)

			const result = await tracker.isFileUnchangedInContext("test.ts")

			expect(result).toBe(false)
		})

		it("should return true when file is unchanged in context", async () => {
			const contentHash = FileContextTracker.computeContentHash("same content")

			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [
					{
						path: "test.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: Date.now(),
						roo_edit_date: null,
						user_edit_date: null,
						content_hash: contentHash,
					},
				],
			})

			// Mock computeFileHash to return same hash
			vi.spyOn(tracker, "computeFileHash").mockResolvedValue(contentHash)

			const result = await tracker.isFileUnchangedInContext("test.ts")

			expect(result).toBe(true)
		})

		it("should return true when user_edit_date is before roo_read_date", async () => {
			const editTime = Date.now() - 2000
			const readTime = Date.now() - 1000 // Read after edit
			const contentHash = FileContextTracker.computeContentHash("content")

			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [
					{
						path: "test.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: readTime,
						roo_edit_date: null,
						user_edit_date: editTime,
						content_hash: contentHash,
					},
				],
			})

			vi.spyOn(tracker, "computeFileHash").mockResolvedValue(contentHash)

			const result = await tracker.isFileUnchangedInContext("test.ts")

			expect(result).toBe(true)
		})

		it("should use most recent active entry when multiple exist", async () => {
			const olderHash = FileContextTracker.computeContentHash("old content")
			const newerHash = FileContextTracker.computeContentHash("new content")
			const currentHash = newerHash

			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [
					{
						path: "test.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: Date.now() - 2000,
						roo_edit_date: null,
						user_edit_date: null,
						content_hash: olderHash,
					},
					{
						path: "test.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: Date.now() - 1000, // More recent
						roo_edit_date: null,
						user_edit_date: null,
						content_hash: newerHash,
					},
				],
			})

			vi.spyOn(tracker, "computeFileHash").mockResolvedValue(currentHash)

			const result = await tracker.isFileUnchangedInContext("test.ts")

			expect(result).toBe(true)
		})

		it("should return false when file cannot be read", async () => {
			const contentHash = FileContextTracker.computeContentHash("content")

			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [
					{
						path: "test.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: Date.now(),
						roo_edit_date: null,
						user_edit_date: null,
						content_hash: contentHash,
					},
				],
			})

			// Mock computeFileHash to return null (file read failed)
			vi.spyOn(tracker, "computeFileHash").mockResolvedValue(null)

			const result = await tracker.isFileUnchangedInContext("test.ts")

			expect(result).toBe(false)
		})

		it("should only consider active entries, not stale ones", async () => {
			const contentHash = FileContextTracker.computeContentHash("content")

			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [
					{
						path: "test.ts",
						record_state: "stale", // Not active
						record_source: "read_tool",
						roo_read_date: Date.now(),
						roo_edit_date: null,
						user_edit_date: null,
						content_hash: contentHash,
					},
				],
			})

			const result = await tracker.isFileUnchangedInContext("test.ts")

			expect(result).toBe(false)
		})
	})

	describe("trackFileContext with content hash", () => {
		let tracker: FileContextTracker
		let mockProvider: any
		let savedMetadata: TaskMetadata | null

		beforeEach(() => {
			savedMetadata = null
			mockProvider = {
				contextProxy: {
					globalStorageUri: { fsPath: "/test/storage" },
				},
			}
			tracker = new FileContextTracker(mockProvider, "task123")

			// Spy on saveTaskMetadata to capture what's being saved
			vi.spyOn(tracker, "saveTaskMetadata").mockImplementation(async (_taskId, metadata) => {
				savedMetadata = metadata
			})
		})

		it("should store content_hash when provided for read_tool", async () => {
			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [],
			})

			const contentHash = FileContextTracker.computeContentHash("file content")
			await tracker.trackFileContext("test.ts", "read_tool", contentHash)

			expect(savedMetadata).not.toBeNull()
			expect(savedMetadata!.files_in_context).toHaveLength(1)
			expect(savedMetadata!.files_in_context[0].content_hash).toBe(contentHash)
			expect(savedMetadata!.files_in_context[0].record_source).toBe("read_tool")
		})

		it("should store content_hash when provided for file_mentioned", async () => {
			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [],
			})

			const contentHash = FileContextTracker.computeContentHash("mentioned file content")
			await tracker.trackFileContext("test.ts", "file_mentioned", contentHash)

			expect(savedMetadata).not.toBeNull()
			expect(savedMetadata!.files_in_context[0].content_hash).toBe(contentHash)
		})

		it("should set content_hash to null for user_edited", async () => {
			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [],
			})

			// Even if hash is provided, user_edited should invalidate it
			await tracker.trackFileContext("test.ts", "user_edited", "some_hash")

			expect(savedMetadata).not.toBeNull()
			expect(savedMetadata!.files_in_context[0].content_hash).toBeNull()
		})

		it("should store content_hash for roo_edited when provided", async () => {
			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [],
			})

			const contentHash = FileContextTracker.computeContentHash("edited content")
			await tracker.trackFileContext("test.ts", "roo_edited", contentHash)

			expect(savedMetadata).not.toBeNull()
			expect(savedMetadata!.files_in_context[0].content_hash).toBe(contentHash)
		})

		it("should mark existing entries as stale when tracking new read", async () => {
			const oldHash = FileContextTracker.computeContentHash("old content")
			const newHash = FileContextTracker.computeContentHash("new content")

			vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({
				files_in_context: [
					{
						path: "test.ts",
						record_state: "active",
						record_source: "read_tool",
						roo_read_date: Date.now() - 1000,
						roo_edit_date: null,
						user_edit_date: null,
						content_hash: oldHash,
					},
				],
			})

			await tracker.trackFileContext("test.ts", "read_tool", newHash)

			expect(savedMetadata).not.toBeNull()
			// Should have 2 entries - one stale, one new active
			expect(savedMetadata!.files_in_context).toHaveLength(2)
			expect(savedMetadata!.files_in_context[0].record_state).toBe("stale")
			expect(savedMetadata!.files_in_context[1].record_state).toBe("active")
			expect(savedMetadata!.files_in_context[1].content_hash).toBe(newHash)
		})
	})

	describe("computeFileHash", () => {
		let tracker: FileContextTracker
		let mockProvider: any

		beforeEach(() => {
			mockProvider = {
				contextProxy: {
					globalStorageUri: { fsPath: "/test/storage" },
				},
			}
			tracker = new FileContextTracker(mockProvider, "task123")
		})

		it("should return hash of file content", async () => {
			const fileContent = "file content here"
			mockFsReadFile.mockResolvedValue(fileContent)

			const hash = await tracker.computeFileHash("test.ts")

			expect(hash).toBe(FileContextTracker.computeContentHash(fileContent))
		})

		it("should return null when file read fails", async () => {
			mockFsReadFile.mockRejectedValue(new Error("File not found"))

			const hash = await tracker.computeFileHash("nonexistent.ts")

			expect(hash).toBeNull()
		})

		it("should return null when no workspace folder", async () => {
			// Override getCwd to return undefined
			vi.spyOn(tracker as any, "getCwd").mockReturnValue(undefined)

			const hash = await tracker.computeFileHash("test.ts")

			expect(hash).toBeNull()
		})
	})
})
