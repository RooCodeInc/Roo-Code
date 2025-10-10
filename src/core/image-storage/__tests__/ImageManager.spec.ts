import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { ImageManager } from "../ImageManager"
import { fileExistsAtPath } from "../../../utils/fs"

describe("ImageManager", () => {
	const testStoragePath = path.join(__dirname, "test-storage")
	const testTaskId = "test-task-123"
	let imageManager: ImageManager

	// 测试用的Base64图片数据（1x1透明PNG）
	const testImageData =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
	const testImageData2 =
		"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q=="

	beforeEach(async () => {
		imageManager = new ImageManager(testStoragePath)
		// 清理测试目录
		await fs.rm(testStoragePath, { recursive: true, force: true })
	})

	afterEach(async () => {
		// 清理测试目录
		await fs.rm(testStoragePath, { recursive: true, force: true })
	})

	describe("saveImage", () => {
		it("should save image and return image ID", async () => {
			const imageId = await imageManager.saveImage(testTaskId, testImageData)

			expect(imageId).toBeDefined()
			expect(typeof imageId).toBe("string")
			expect(imageId.length).toBeGreaterThan(0)

			// 验证文件已创建
			const taskImageDir = path.join(testStoragePath, "images", testTaskId)
			const files = await fs.readdir(taskImageDir)
			expect(files.length).toBe(1)
			expect(files[0]).toContain(imageId)
		})

		it("should save image with correct extension", async () => {
			const imageId = await imageManager.saveImage(testTaskId, testImageData)

			const taskImageDir = path.join(testStoragePath, "images", testTaskId)
			const files = await fs.readdir(taskImageDir)
			expect(files[0]).toMatch(/\.png$/)
		})

		it("should save JPEG image with correct extension", async () => {
			const imageId = await imageManager.saveImage(testTaskId, testImageData2)

			const taskImageDir = path.join(testStoragePath, "images", testTaskId)
			const files = await fs.readdir(taskImageDir)
			expect(files[0]).toMatch(/\.jpeg$/)
		})

		it("should throw error for invalid image data format", async () => {
			await expect(imageManager.saveImage(testTaskId, "invalid-data")).rejects.toThrow(
				"Invalid image data format",
			)
		})

		it("should create task directory if it doesn't exist", async () => {
			const taskImageDir = path.join(testStoragePath, "images", testTaskId)
			const existsBefore = await fileExistsAtPath(taskImageDir)
			expect(existsBefore).toBe(false)

			await imageManager.saveImage(testTaskId, testImageData)

			const existsAfter = await fileExistsAtPath(taskImageDir)
			expect(existsAfter).toBe(true)
		})
	})

	describe("loadImage", () => {
		it("should load saved image", async () => {
			const imageId = await imageManager.saveImage(testTaskId, testImageData)
			const loadedImage = await imageManager.loadImage(testTaskId, imageId)

			expect(loadedImage).toBeDefined()
			expect(loadedImage).toContain("data:image/png;base64,")
		})

		it("should return undefined for non-existent image", async () => {
			const loadedImage = await imageManager.loadImage(testTaskId, "non-existent-id")
			expect(loadedImage).toBeUndefined()
		})

		it("should return undefined for non-existent task", async () => {
			const loadedImage = await imageManager.loadImage("non-existent-task", "some-id")
			expect(loadedImage).toBeUndefined()
		})

		it("should load image with correct MIME type", async () => {
			const imageId = await imageManager.saveImage(testTaskId, testImageData2)
			const loadedImage = await imageManager.loadImage(testTaskId, imageId)

			expect(loadedImage).toBeDefined()
			expect(loadedImage).toContain("data:image/jpeg;base64,")
		})
	})

	describe("deleteImage", () => {
		it("should delete existing image", async () => {
			const imageId = await imageManager.saveImage(testTaskId, testImageData)

			const taskImageDir = path.join(testStoragePath, "images", testTaskId)
			let files = await fs.readdir(taskImageDir)
			expect(files.length).toBe(1)

			await imageManager.deleteImage(testTaskId, imageId)

			files = await fs.readdir(taskImageDir)
			expect(files.length).toBe(0)
		})

		it("should not throw error when deleting non-existent image", async () => {
			await expect(imageManager.deleteImage(testTaskId, "non-existent-id")).resolves.not.toThrow()
		})

		it("should not throw error when deleting from non-existent task", async () => {
			await expect(imageManager.deleteImage("non-existent-task", "some-id")).resolves.not.toThrow()
		})
	})

	describe("cleanupOrphanedImages", () => {
		it("should clean up orphaned images", async () => {
			const imageId1 = await imageManager.saveImage(testTaskId, testImageData)
			const imageId2 = await imageManager.saveImage(testTaskId, testImageData2)
			const imageId3 = await imageManager.saveImage(testTaskId, testImageData)

			// 只保留imageId1和imageId2
			const referencedIds = new Set([imageId1, imageId2])
			const cleanedCount = await imageManager.cleanupOrphanedImages(testTaskId, referencedIds)

			expect(cleanedCount).toBe(1) // imageId3 should be cleaned

			// 验证剩余文件
			const taskImageDir = path.join(testStoragePath, "images", testTaskId)
			const files = await fs.readdir(taskImageDir)
			expect(files.length).toBe(2)
		})

		it("should not clean up referenced images", async () => {
			const imageId1 = await imageManager.saveImage(testTaskId, testImageData)
			const imageId2 = await imageManager.saveImage(testTaskId, testImageData2)

			const referencedIds = new Set([imageId1, imageId2])
			const cleanedCount = await imageManager.cleanupOrphanedImages(testTaskId, referencedIds)

			expect(cleanedCount).toBe(0)

			const taskImageDir = path.join(testStoragePath, "images", testTaskId)
			const files = await fs.readdir(taskImageDir)
			expect(files.length).toBe(2)
		})

		it("should return 0 for non-existent task", async () => {
			const referencedIds = new Set(["id1", "id2"])
			const cleanedCount = await imageManager.cleanupOrphanedImages("non-existent-task", referencedIds)

			expect(cleanedCount).toBe(0)
		})

		it("should clean up all images when no references", async () => {
			await imageManager.saveImage(testTaskId, testImageData)
			await imageManager.saveImage(testTaskId, testImageData2)

			const referencedIds = new Set<string>()
			const cleanedCount = await imageManager.cleanupOrphanedImages(testTaskId, referencedIds)

			expect(cleanedCount).toBe(2)

			const taskImageDir = path.join(testStoragePath, "images", testTaskId)
			const files = await fs.readdir(taskImageDir)
			expect(files.length).toBe(0)
		})
	})

	describe("cleanupTaskImages", () => {
		it("should clean up all task images", async () => {
			await imageManager.saveImage(testTaskId, testImageData)
			await imageManager.saveImage(testTaskId, testImageData2)

			const taskImageDir = path.join(testStoragePath, "images", testTaskId)
			const existsBefore = await fileExistsAtPath(taskImageDir)
			expect(existsBefore).toBe(true)

			await imageManager.cleanupTaskImages(testTaskId)

			const existsAfter = await fileExistsAtPath(taskImageDir)
			expect(existsAfter).toBe(false)
		})

		it("should not throw error for non-existent task", async () => {
			await expect(imageManager.cleanupTaskImages("non-existent-task")).resolves.not.toThrow()
		})
	})

	describe("saveImages (batch)", () => {
		it("should save multiple images", async () => {
			const imageIds = await imageManager.saveImages(testTaskId, [testImageData, testImageData2])

			expect(imageIds.length).toBe(2)
			expect(imageIds[0]).toBeDefined()
			expect(imageIds[1]).toBeDefined()

			const taskImageDir = path.join(testStoragePath, "images", testTaskId)
			const files = await fs.readdir(taskImageDir)
			expect(files.length).toBe(2)
		})

		it("should handle empty array", async () => {
			const imageIds = await imageManager.saveImages(testTaskId, [])
			expect(imageIds.length).toBe(0)
		})
	})

	describe("loadImages (batch)", () => {
		it("should load multiple images", async () => {
			const imageIds = await imageManager.saveImages(testTaskId, [testImageData, testImageData2])
			const loadedImages = await imageManager.loadImages(testTaskId, imageIds)

			expect(loadedImages.length).toBe(2)
			expect(loadedImages[0]).toContain("data:image/")
			expect(loadedImages[1]).toContain("data:image/")
		})

		it("should skip non-existent images", async () => {
			const imageId1 = await imageManager.saveImage(testTaskId, testImageData)

			const loadedImages = await imageManager.loadImages(testTaskId, [imageId1, "non-existent-id"])

			expect(loadedImages.length).toBe(1)
			expect(loadedImages[0]).toContain("data:image/")
		})

		it("should handle empty array", async () => {
			const loadedImages = await imageManager.loadImages(testTaskId, [])
			expect(loadedImages.length).toBe(0)
		})
	})

	describe("getImageStats", () => {
		it("should return correct stats", async () => {
			await imageManager.saveImage(testTaskId, testImageData)
			await imageManager.saveImage(testTaskId, testImageData2)

			const stats = await imageManager.getImageStats(testTaskId)

			expect(stats.count).toBe(2)
			expect(stats.totalSizeMB).toBeGreaterThan(0)
		})

		it("should return zero stats for non-existent task", async () => {
			const stats = await imageManager.getImageStats("non-existent-task")

			expect(stats.count).toBe(0)
			expect(stats.totalSizeMB).toBe(0)
		})

		it("should return zero stats for empty task directory", async () => {
			const stats = await imageManager.getImageStats(testTaskId)

			expect(stats.count).toBe(0)
			expect(stats.totalSizeMB).toBe(0)
		})
	})

	describe("round-trip test", () => {
		it("should preserve image data through save and load", async () => {
			const imageId = await imageManager.saveImage(testTaskId, testImageData)
			const loadedImage = await imageManager.loadImage(testTaskId, imageId)

			expect(loadedImage).toBeDefined()

			// 提取Base64数据部分进行比较
			const originalBase64 = testImageData.split(",")[1]
			const loadedBase64 = loadedImage!.split(",")[1]

			expect(loadedBase64).toBe(originalBase64)
		})
	})
})
