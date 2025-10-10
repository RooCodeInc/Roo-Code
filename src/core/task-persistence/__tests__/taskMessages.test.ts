import { describe, it, expect, beforeEach, vi } from "vitest"
import { readTaskMessages, saveTaskMessages } from "../taskMessages"
import { ImageManager } from "../../image-storage/ImageManager"
import type { ClineMessage } from "@roo-code/types"

// Mock dependencies
vi.mock("../../../utils/fs")
vi.mock("../../../utils/storage")
vi.mock("../../../utils/safeWriteJson")
vi.mock("../../image-storage/ImageManager")
vi.mock("fs/promises")

describe("taskMessages", () => {
	const testTaskId = "test-task-123"
	const testGlobalStoragePath = "/test/storage"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("readTaskMessages", () => {
		it("should return empty array when file does not exist", async () => {
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const { getTaskDirectoryPath } = await import("../../../utils/storage")

			vi.mocked(getTaskDirectoryPath).mockResolvedValue("/test/storage/tasks/test-task-123")
			vi.mocked(fileExistsAtPath).mockResolvedValue(false)

			const result = await readTaskMessages({
				taskId: testTaskId,
				globalStoragePath: testGlobalStoragePath,
			})

			expect(result).toEqual([])
		})

		it("should read and parse messages from file", async () => {
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const { getTaskDirectoryPath } = await import("../../../utils/storage")
			const fs = await import("fs/promises")

			const mockMessages: ClineMessage[] = [
				{
					ts: Date.now(),
					type: "say",
					say: "text",
					text: "Hello world",
				},
			]

			vi.mocked(getTaskDirectoryPath).mockResolvedValue("/test/storage/tasks/test-task-123")
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessages) as any)

			const result = await readTaskMessages({
				taskId: testTaskId,
				globalStoragePath: testGlobalStoragePath,
			})

			expect(result).toEqual(mockMessages)
		})

		it("should restore images from imageIds", async () => {
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const { getTaskDirectoryPath } = await import("../../../utils/storage")
			const fs = await import("fs/promises")

			const mockImageId = "test-image-123"
			const mockImageData = "data:image/png;base64,iVBORw0KGgoAAAANS"

			const mockMessages: ClineMessage[] = [
				{
					ts: Date.now(),
					type: "say",
					say: "text",
					text: "Message with image",
					imageIds: [mockImageId],
				},
			]

			vi.mocked(getTaskDirectoryPath).mockResolvedValue("/test/storage/tasks/test-task-123")
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessages) as any)

			// Mock ImageManager
			const mockLoadImages = vi.fn().mockResolvedValue([mockImageData])
			vi.mocked(ImageManager).mockImplementation(
				() =>
					({
						loadImages: mockLoadImages,
					}) as any,
			)

			const result = await readTaskMessages({
				taskId: testTaskId,
				globalStoragePath: testGlobalStoragePath,
			})

			expect(result).toHaveLength(1)
			expect(result[0].images).toEqual([mockImageData])
			expect(result[0].imageIds).toEqual([mockImageId])
			expect(mockLoadImages).toHaveBeenCalledWith(testTaskId, [mockImageId])
		})

		it("should handle multiple messages with images", async () => {
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const { getTaskDirectoryPath } = await import("../../../utils/storage")
			const fs = await import("fs/promises")

			const mockImageId1 = "test-image-1"
			const mockImageId2 = "test-image-2"
			const mockImageData1 = "data:image/png;base64,AAA"
			const mockImageData2 = "data:image/png;base64,BBB"

			const mockMessages: ClineMessage[] = [
				{
					ts: Date.now(),
					type: "say",
					say: "text",
					text: "First message",
					imageIds: [mockImageId1],
				},
				{
					ts: Date.now() + 1000,
					type: "say",
					say: "text",
					text: "Second message",
					imageIds: [mockImageId2],
				},
			]

			vi.mocked(getTaskDirectoryPath).mockResolvedValue("/test/storage/tasks/test-task-123")
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessages) as any)

			// Mock ImageManager to return different images for different calls
			const mockLoadImages = vi
				.fn()
				.mockResolvedValueOnce([mockImageData1])
				.mockResolvedValueOnce([mockImageData2])

			vi.mocked(ImageManager).mockImplementation(
				() =>
					({
						loadImages: mockLoadImages,
					}) as any,
			)

			const result = await readTaskMessages({
				taskId: testTaskId,
				globalStoragePath: testGlobalStoragePath,
			})

			expect(result).toHaveLength(2)
			expect(result[0].images).toEqual([mockImageData1])
			expect(result[1].images).toEqual([mockImageData2])
		})

		it("should handle image loading errors gracefully", async () => {
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const { getTaskDirectoryPath } = await import("../../../utils/storage")
			const fs = await import("fs/promises")

			const mockImageId = "test-image-fail"

			const mockMessages: ClineMessage[] = [
				{
					ts: Date.now(),
					type: "say",
					say: "text",
					text: "Message with failed image",
					imageIds: [mockImageId],
				},
			]

			vi.mocked(getTaskDirectoryPath).mockResolvedValue("/test/storage/tasks/test-task-123")
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessages) as any)

			// Mock ImageManager to throw error
			const mockLoadImages = vi.fn().mockRejectedValue(new Error("Image load failed"))
			vi.mocked(ImageManager).mockImplementation(
				() =>
					({
						loadImages: mockLoadImages,
					}) as any,
			)

			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const result = await readTaskMessages({
				taskId: testTaskId,
				globalStoragePath: testGlobalStoragePath,
			})

			expect(result).toHaveLength(1)
			expect(result[0].images).toBeUndefined()
			expect(result[0].imageIds).toEqual([mockImageId])
			expect(consoleSpy).toHaveBeenCalled()

			consoleSpy.mockRestore()
		})

		it("should not process messages without imageIds", async () => {
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const { getTaskDirectoryPath } = await import("../../../utils/storage")
			const fs = await import("fs/promises")

			const mockMessages: ClineMessage[] = [
				{
					ts: Date.now(),
					type: "say",
					say: "text",
					text: "Message without images",
				},
			]

			vi.mocked(getTaskDirectoryPath).mockResolvedValue("/test/storage/tasks/test-task-123")
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessages) as any)

			const mockLoadImages = vi.fn()
			vi.mocked(ImageManager).mockImplementation(
				() =>
					({
						loadImages: mockLoadImages,
					}) as any,
			)

			const result = await readTaskMessages({
				taskId: testTaskId,
				globalStoragePath: testGlobalStoragePath,
			})

			expect(result).toEqual(mockMessages)
			expect(mockLoadImages).not.toHaveBeenCalled()
		})

		it("should handle empty imageIds array", async () => {
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const { getTaskDirectoryPath } = await import("../../../utils/storage")
			const fs = await import("fs/promises")

			const mockMessages: ClineMessage[] = [
				{
					ts: Date.now(),
					type: "say",
					say: "text",
					text: "Message with empty imageIds",
					imageIds: [],
				},
			]

			vi.mocked(getTaskDirectoryPath).mockResolvedValue("/test/storage/tasks/test-task-123")
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessages) as any)

			const mockLoadImages = vi.fn()
			vi.mocked(ImageManager).mockImplementation(
				() =>
					({
						loadImages: mockLoadImages,
					}) as any,
			)

			const result = await readTaskMessages({
				taskId: testTaskId,
				globalStoragePath: testGlobalStoragePath,
			})

			expect(result).toEqual(mockMessages)
			expect(mockLoadImages).not.toHaveBeenCalled()
		})
	})

	describe("saveTaskMessages", () => {
		it("should save messages to file", async () => {
			const { safeWriteJson } = await import("../../../utils/safeWriteJson")
			const { getTaskDirectoryPath } = await import("../../../utils/storage")

			const mockMessages: ClineMessage[] = [
				{
					ts: Date.now(),
					type: "say",
					say: "text",
					text: "Test message",
				},
			]

			vi.mocked(getTaskDirectoryPath).mockResolvedValue("/test/storage/tasks/test-task-123")

			await saveTaskMessages({
				taskId: testTaskId,
				globalStoragePath: testGlobalStoragePath,
				messages: mockMessages,
			})

			expect(safeWriteJson).toHaveBeenCalledWith(expect.stringContaining("ui_messages.json"), mockMessages)
		})
	})
})
