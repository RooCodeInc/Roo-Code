import fs from "fs/promises"
import path from "path"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { checkFileSizeForRead, checkBatchFileSizeForRead, FILE_SIZE_LIMITS } from "../fileSizeHelpers"

const TEST_DIR = path.join(__dirname, "test-files")

describe("fileSizeHelpers", () => {
	beforeAll(async () => {
		// Create test directory
		await fs.mkdir(TEST_DIR, { recursive: true })

		// Create small file (10 KB)
		const smallContent = "x".repeat(10 * 1024)
		await fs.writeFile(path.join(TEST_DIR, "small.txt"), smallContent)

		// Create medium file (200 KB - should trigger warning)
		const mediumContent = "x".repeat(200 * 1024)
		await fs.writeFile(path.join(TEST_DIR, "medium.txt"), mediumContent)

		// Create large file (1.5 MB - should be blocked)
		const largeContent = "x".repeat(1.5 * 1024 * 1024)
		await fs.writeFile(path.join(TEST_DIR, "large.txt"), largeContent)
	})

	afterAll(async () => {
		// Clean up test files
		await fs.rm(TEST_DIR, { recursive: true, force: true })
	})

	describe("checkFileSizeForRead", () => {
		it("should allow small files without warning", async () => {
			const result = await checkFileSizeForRead(path.join(TEST_DIR, "small.txt"))

			expect(result.shouldWarn).toBe(false)
			expect(result.shouldBlock).toBe(false)
			expect(result.sizeInBytes).toBeGreaterThan(0)
			expect(result.estimatedTokens).toBeGreaterThan(0)
		})

		it("should warn for medium-sized files", async () => {
			const result = await checkFileSizeForRead(path.join(TEST_DIR, "medium.txt"))

			expect(result.shouldWarn).toBe(true)
			expect(result.shouldBlock).toBe(false)
			expect(result.warningMessage).toBeDefined()
			expect(result.warningMessage).toContain("Large file warning")
		})

		it("should block large files", async () => {
			const result = await checkFileSizeForRead(path.join(TEST_DIR, "large.txt"))

			expect(result.shouldWarn).toBe(false)
			expect(result.shouldBlock).toBe(true)
			expect(result.errorMessage).toBeDefined()
			expect(result.errorMessage).toContain("exceeds maximum allowed size")
		})

		it("should estimate tokens correctly", async () => {
			const result = await checkFileSizeForRead(path.join(TEST_DIR, "small.txt"))
			const expectedTokens = Math.ceil(result.sizeInBytes / FILE_SIZE_LIMITS.BYTES_PER_TOKEN)

			expect(result.estimatedTokens).toBe(expectedTokens)
		})
	})

	describe("checkBatchFileSizeForRead", () => {
		it("should allow batch of small files", async () => {
			const files = [
				path.join(TEST_DIR, "small.txt"),
				path.join(TEST_DIR, "small.txt"), // Same file twice for testing
			]

			const result = await checkBatchFileSizeForRead(files)

			expect(result.shouldWarn).toBe(false)
			expect(result.shouldBlock).toBe(false)
			// Map will only have 1 entry since both paths are identical
			expect(result.fileResults.size).toBe(1)
			// But total size should still count both files
			const singleFileResult = await checkFileSizeForRead(path.join(TEST_DIR, "small.txt"))
			expect(result.totalSizeInBytes).toBe(singleFileResult.sizeInBytes * 2)
		})

		it("should warn for batch with medium files", async () => {
			const files = [path.join(TEST_DIR, "medium.txt"), path.join(TEST_DIR, "medium.txt")]

			const result = await checkBatchFileSizeForRead(files)

			expect(result.shouldWarn).toBe(true)
			expect(result.shouldBlock).toBe(false)
			expect(result.warningMessage).toBeDefined()
		})

		it("should block batch with any large file", async () => {
			const files = [path.join(TEST_DIR, "small.txt"), path.join(TEST_DIR, "large.txt")]

			const result = await checkBatchFileSizeForRead(files)

			expect(result.shouldBlock).toBe(true)
			expect(result.errorMessage).toBeDefined()
			expect(result.errorMessage).toContain("exceed maximum size limit")
		})

		it("should block batch when total size exceeds limit", async () => {
			// Create enough medium files to exceed batch total limit
			const files = Array(15).fill(path.join(TEST_DIR, "medium.txt"))

			const result = await checkBatchFileSizeForRead(files)

			expect(result.shouldBlock).toBe(true)
			expect(result.errorMessage).toBeDefined()
			expect(result.errorMessage).toContain("Total batch size")
		})

		it("should calculate total size correctly", async () => {
			const files = [path.join(TEST_DIR, "small.txt"), path.join(TEST_DIR, "small.txt")]

			const result = await checkBatchFileSizeForRead(files)
			const singleFileResult = await checkFileSizeForRead(path.join(TEST_DIR, "small.txt"))

			expect(result.totalSizeInBytes).toBe(singleFileResult.sizeInBytes * 2)
			expect(result.totalEstimatedTokens).toBe(singleFileResult.estimatedTokens * 2)
		})
	})
})
