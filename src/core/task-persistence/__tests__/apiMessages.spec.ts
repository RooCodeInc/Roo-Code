import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { readApiMessages, saveApiMessages } from "../apiMessages"

// Mock dependencies
vi.mock("../../../utils/fs")
vi.mock("../../../utils/storage")
vi.mock("fs/promises")
vi.mock("../../../utils/safeWriteJson")

const { fileExistsAtPath } = await import("../../../utils/fs")
const { getTaskDirectoryPath } = await import("../../../utils/storage")
const { safeWriteJson } = await import("../../../utils/safeWriteJson")

describe("apiMessages", () => {
	const mockTaskId = "test-task-id"
	const mockGlobalStoragePath = "/mock/storage"
	const mockTaskDir = "/mock/storage/tasks/test-task-id"
	const mockFilePath = path.join(mockTaskDir, "api_conversation_history.json")

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getTaskDirectoryPath).mockResolvedValue(mockTaskDir)
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe("readApiMessages - validation", () => {
		it("should successfully read and return valid messages", async () => {
			const validMessages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: [{ type: "text", text: "Hi there!" }] },
			]

			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validMessages))

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({ role: "user", content: "Hello" })
			expect(result[1]).toEqual({ role: "assistant", content: [{ type: "text", text: "Hi there!" }] })
		})

		it("should fix messages with undefined content", async () => {
			const messagesWithUndefinedContent = [
				{ role: "user", content: "Valid" },
				{ role: "assistant", content: undefined },
				{ role: "user", content: "Continue" },
			]

			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(messagesWithUndefinedContent))

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toHaveLength(3)
			expect(result[0].content).toBe("Valid")
			expect(result[1].content).toEqual([]) // Fixed from undefined to empty array
			expect(result[2].content).toBe("Continue")
		})

		it("should fix messages with null content", async () => {
			const messagesWithNullContent = [
				{ role: "user", content: "Valid" },
				{ role: "assistant", content: null },
				{ role: "user", content: "Continue" },
			]

			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(messagesWithNullContent))

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toHaveLength(3)
			expect(result[0].content).toBe("Valid")
			expect(result[1].content).toEqual([]) // Fixed from null to empty array
			expect(result[2].content).toBe("Continue")
		})

		it("should fix messages with non-array, non-string content", async () => {
			const messagesWithInvalidContent = [
				{ role: "user", content: "Valid" },
				{ role: "assistant", content: { invalid: "object" } },
				{ role: "user", content: "Continue" },
			]

			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(messagesWithInvalidContent))

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toHaveLength(3)
			expect(result[0].content).toBe("Valid")
			expect(result[1].content).toEqual([]) // Fixed from object to empty array
			expect(result[2].content).toBe("Continue")
		})

		it("should filter out messages with invalid roles", async () => {
			const messagesWithInvalidRoles = [
				{ role: "user", content: "Valid" },
				{ role: "invalid_role", content: "Bad message" },
				{ role: "assistant", content: "Also valid" },
			]

			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(messagesWithInvalidRoles))

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toHaveLength(2)
			expect(result[0].role).toBe("user")
			expect(result[1].role).toBe("assistant")
		})

		it("should filter out completely malformed messages (not objects)", async () => {
			const messagesWithNonObjects = [
				{ role: "user", content: "Valid" },
				null,
				"string message",
				123,
				{ role: "assistant", content: "Also valid" },
			]

			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(messagesWithNonObjects))

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toHaveLength(2)
			expect(result[0].role).toBe("user")
			expect(result[1].role).toBe("assistant")
		})

		it("should filter out invalid blocks from message content arrays", async () => {
			const messagesWithInvalidBlocks = [
				{
					role: "assistant",
					content: [
						{ type: "text", text: "Valid text" },
						null, // Invalid block
						{ invalid: "no type field" }, // Invalid block
						{ type: "text", text: "Another valid text" },
					],
				},
			]

			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(messagesWithInvalidBlocks))

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toHaveLength(1)
			expect(Array.isArray(result[0].content)).toBe(true)
			expect((result[0].content as any[]).length).toBe(2)
			expect((result[0].content as any[])[0]).toEqual({ type: "text", text: "Valid text" })
			expect((result[0].content as any[])[1]).toEqual({ type: "text", text: "Another valid text" })
		})

		it("should return empty array when parsedData is not an array", async () => {
			const nonArrayData = { invalid: "not an array" }

			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(nonArrayData))

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toEqual([])
		})

		it("should preserve valid metadata fields (ts, isSummary, etc.)", async () => {
			const messagesWithMetadata = [
				{
					role: "user",
					content: "Test",
					ts: 1234567890,
					isSummary: true,
					condenseId: "c-123",
					truncationId: "t-456",
				},
			]

			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(messagesWithMetadata))

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toHaveLength(1)
			expect(result[0].ts).toBe(1234567890)
			expect(result[0].isSummary).toBe(true)
			expect(result[0].condenseId).toBe("c-123")
			expect(result[0].truncationId).toBe("t-456")
		})

		it("should handle old claude_messages.json format with validation", async () => {
			const oldFormatMessages = [
				{ role: "user", content: "Valid" },
				{ role: "assistant", content: undefined }, // Should be fixed
			]

			// New format doesn't exist, old format exists
			vi.mocked(fileExistsAtPath)
				.mockResolvedValueOnce(false) // New format
				.mockResolvedValueOnce(true) // Old format

			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(oldFormatMessages))
			// Mock unlink to prevent errors
			;(fs as any).unlink = vi.fn().mockResolvedValue(undefined)

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("Valid")
			expect(result[1].content).toEqual([]) // Fixed from undefined
		})

		it("should return empty array when no file exists", async () => {
			vi.mocked(fileExistsAtPath).mockResolvedValue(false)

			const result = await readApiMessages({ taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(result).toEqual([])
		})
	})

	describe("saveApiMessages", () => {
		it("should call safeWriteJson with correct parameters", async () => {
			const messages = [
				{ role: "user", content: "Test" },
				{ role: "assistant", content: [{ type: "text", text: "Response" }] },
			] as any[]

			await saveApiMessages({ messages, taskId: mockTaskId, globalStoragePath: mockGlobalStoragePath })

			expect(safeWriteJson).toHaveBeenCalledWith(mockFilePath, messages)
		})
	})
})
