import { describe, it, expect, vi, beforeEach } from "vitest"
import { checkFileContextStatus, getReReadNotice } from "../FileContextStatusChecker"
import type { TaskMetadata } from "../FileContextTrackerTypes"
import type { ApiMessage } from "../../task-persistence/apiMessages"

// Mock fs/promises with factory
const mockStat = vi.fn()
vi.mock("fs/promises", () => ({
	stat: (...args: unknown[]) => mockStat(...args),
}))

describe("FileContextStatusChecker", () => {
	const testFilePath = "test/file.ts"
	const testFullPath = "/workspace/test/file.ts"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("checkFileContextStatus", () => {
		describe("never_read scenario", () => {
			it("should return never_read when no entry exists for the file", async () => {
				const metadata: TaskMetadata = {
					files_in_context: [],
				}
				const messages: ApiMessage[] = []

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: true,
					reason: "never_read",
				})
			})

			it("should return never_read when entry exists but has no roo_read_date", async () => {
				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: null,
							roo_edit_date: null,
							user_edit_date: null,
						},
					],
				}
				const messages: ApiMessage[] = []

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: true,
					reason: "never_read",
				})
			})

			it("should return never_read when entry exists but is stale", async () => {
				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "stale",
							record_source: "read_tool",
							roo_read_date: Date.now() - 1000,
							roo_edit_date: null,
							user_edit_date: null,
						},
					],
				}
				const messages: ApiMessage[] = []

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: true,
					reason: "never_read",
				})
			})
		})

		describe("file_modified scenario", () => {
			it("should return file_modified when file mtime is newer than last read", async () => {
				const readDate = Date.now() - 5000
				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: readDate,
							roo_edit_date: null,
							user_edit_date: null,
						},
					],
				}
				const messages: ApiMessage[] = []

				// Mock file stat to return mtime newer than read date
				mockStat.mockResolvedValue({
					mtimeMs: Date.now(),
				})

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: true,
					reason: "file_modified",
					lastReadDate: readDate,
				})
			})

			it("should return file_modified when file stat throws error (file may not exist)", async () => {
				const readDate = Date.now() - 5000
				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: readDate,
							roo_edit_date: null,
							user_edit_date: null,
						},
					],
				}
				const messages: ApiMessage[] = []

				// Mock file stat to throw error (file doesn't exist)
				mockStat.mockRejectedValue(new Error("ENOENT"))

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: true,
					reason: "file_modified",
				})
			})
		})

		describe("message_deleted scenario", () => {
			it("should return message_deleted when containing message no longer exists", async () => {
				const readDate = Date.now() - 5000
				const messageTs = Date.now() - 4000

				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: readDate,
							roo_edit_date: null,
							user_edit_date: null,
							containingMessageTs: messageTs,
						},
					],
				}

				// No messages exist
				const messages: ApiMessage[] = []

				// Mock file stat to show file hasn't changed
				mockStat.mockResolvedValue({
					mtimeMs: readDate - 1000,
				})

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: true,
					reason: "message_deleted",
					lastReadDate: readDate,
				})
			})
		})

		describe("content_condensed scenario", () => {
			it("should return content_condensed when message was condensed with summary", async () => {
				const readDate = Date.now() - 5000
				const messageTs = Date.now() - 4000
				const condenseId = "condense-123"

				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: readDate,
							roo_edit_date: null,
							user_edit_date: null,
							containingMessageTs: messageTs,
						},
					],
				}

				const messages: ApiMessage[] = [
					{
						role: "user",
						content: "original content",
						ts: messageTs,
						condenseParent: condenseId,
					},
					{
						role: "assistant",
						content: "Summary of conversation",
						ts: Date.now() - 3000,
						isSummary: true,
						condenseId: condenseId,
					},
				]

				// Mock file stat to show file hasn't changed
				mockStat.mockResolvedValue({
					mtimeMs: readDate - 1000,
				})

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: true,
					reason: "content_condensed",
					lastReadDate: readDate,
				})
			})

			it("should not return content_condensed when message has condenseParent but no summary exists", async () => {
				const readDate = Date.now() - 5000
				const messageTs = Date.now() - 4000
				const condenseId = "condense-123"

				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: readDate,
							roo_edit_date: null,
							user_edit_date: null,
							containingMessageTs: messageTs,
						},
					],
				}

				const messages: ApiMessage[] = [
					{
						role: "user",
						content: "original content",
						ts: messageTs,
						condenseParent: condenseId,
					},
					// No summary message with matching condenseId
				]

				// Mock file stat to show file hasn't changed
				mockStat.mockResolvedValue({
					mtimeMs: readDate - 1000,
				})

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				// Should be content_current since no actual summary exists
				expect(result).toEqual({
					shouldReRead: false,
					reason: "content_current",
					lastReadDate: readDate,
				})
			})
		})

		describe("content_truncated scenario", () => {
			it("should return content_truncated when message was truncated", async () => {
				const readDate = Date.now() - 5000
				const messageTs = Date.now() - 4000
				const truncationId = "truncation-456"

				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: readDate,
							roo_edit_date: null,
							user_edit_date: null,
							containingMessageTs: messageTs,
						},
					],
				}

				const messages: ApiMessage[] = [
					{
						role: "user",
						content: "original content",
						ts: messageTs,
						truncationParent: truncationId,
					},
					{
						role: "assistant",
						content: "[Context truncation marker]",
						ts: Date.now() - 3000,
						isTruncationMarker: true,
						truncationId: truncationId,
					},
				]

				// Mock file stat to show file hasn't changed
				mockStat.mockResolvedValue({
					mtimeMs: readDate - 1000,
				})

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: true,
					reason: "content_truncated",
					lastReadDate: readDate,
				})
			})

			it("should not return content_truncated when message has truncationParent but no marker exists", async () => {
				const readDate = Date.now() - 5000
				const messageTs = Date.now() - 4000
				const truncationId = "truncation-456"

				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: readDate,
							roo_edit_date: null,
							user_edit_date: null,
							containingMessageTs: messageTs,
						},
					],
				}

				const messages: ApiMessage[] = [
					{
						role: "user",
						content: "original content",
						ts: messageTs,
						truncationParent: truncationId,
					},
					// No truncation marker with matching truncationId
				]

				// Mock file stat to show file hasn't changed
				mockStat.mockResolvedValue({
					mtimeMs: readDate - 1000,
				})

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				// Should be content_current since no actual truncation marker exists
				expect(result).toEqual({
					shouldReRead: false,
					reason: "content_current",
					lastReadDate: readDate,
				})
			})
		})

		describe("content_current scenario", () => {
			it("should return content_current when file unchanged and content still in context", async () => {
				const readDate = Date.now() - 5000
				const messageTs = Date.now() - 4000

				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: readDate,
							roo_edit_date: null,
							user_edit_date: null,
							containingMessageTs: messageTs,
						},
					],
				}

				const messages: ApiMessage[] = [
					{
						role: "user",
						content: "original content with file",
						ts: messageTs,
						// No condenseParent or truncationParent
					},
				]

				// Mock file stat to show file hasn't changed
				mockStat.mockResolvedValue({
					mtimeMs: readDate - 1000,
				})

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: false,
					reason: "content_current",
					lastReadDate: readDate,
				})
			})

			it("should return content_current when file unchanged and no containingMessageTs (legacy entry)", async () => {
				const readDate = Date.now() - 5000

				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: readDate,
							roo_edit_date: null,
							user_edit_date: null,
							// No containingMessageTs - legacy entry
						},
					],
				}

				const messages: ApiMessage[] = []

				// Mock file stat to show file hasn't changed
				mockStat.mockResolvedValue({
					mtimeMs: readDate - 1000,
				})

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: false,
					reason: "content_current",
					lastReadDate: readDate,
				})
			})
		})

		describe("multiple entries for same file", () => {
			it("should use the latest active entry for the file", async () => {
				const oldReadDate = Date.now() - 10000
				const newReadDate = Date.now() - 5000
				const messageTs = Date.now() - 4000

				const metadata: TaskMetadata = {
					files_in_context: [
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: oldReadDate,
							roo_edit_date: null,
							user_edit_date: null,
							containingMessageTs: Date.now() - 9000,
						},
						{
							path: testFilePath,
							record_state: "active",
							record_source: "read_tool",
							roo_read_date: newReadDate,
							roo_edit_date: null,
							user_edit_date: null,
							containingMessageTs: messageTs,
						},
					],
				}

				const messages: ApiMessage[] = [
					{
						role: "user",
						content: "latest read",
						ts: messageTs,
					},
				]

				// Mock file stat to show file hasn't changed
				mockStat.mockResolvedValue({
					mtimeMs: newReadDate - 1000,
				})

				const result = await checkFileContextStatus(testFilePath, testFullPath, metadata, messages)

				expect(result).toEqual({
					shouldReRead: false,
					reason: "content_current",
					lastReadDate: newReadDate,
				})
			})
		})
	})

	describe("getReReadNotice", () => {
		it("should return appropriate notice for content_condensed", () => {
			expect(getReReadNotice("content_condensed")).toBe(
				"Previous content was summarized during context condensation.",
			)
		})

		it("should return appropriate notice for content_truncated", () => {
			expect(getReReadNotice("content_truncated")).toBe(
				"Previous content was removed during sliding window truncation.",
			)
		})

		it("should return appropriate notice for file_modified", () => {
			expect(getReReadNotice("file_modified")).toBe("File has been modified since last read.")
		})

		it("should return appropriate notice for message_deleted", () => {
			expect(getReReadNotice("message_deleted")).toBe("Previous message containing file content was deleted.")
		})

		it("should return undefined for never_read", () => {
			expect(getReReadNotice("never_read")).toBeUndefined()
		})

		it("should return undefined for content_current", () => {
			expect(getReReadNotice("content_current")).toBeUndefined()
		})
	})
})
