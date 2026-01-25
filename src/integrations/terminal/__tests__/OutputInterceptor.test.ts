import * as fs from "fs"
import * as path from "path"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"

import { OutputInterceptor } from "../OutputInterceptor"
import { TerminalOutputPreviewSize } from "@roo-code/types"

// Mock filesystem operations
vi.mock("fs", () => ({
	default: {
		existsSync: vi.fn(),
		mkdirSync: vi.fn(),
		createWriteStream: vi.fn(),
		promises: {
			readdir: vi.fn(),
			unlink: vi.fn(),
		},
	},
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
	createWriteStream: vi.fn(),
	promises: {
		readdir: vi.fn(),
		unlink: vi.fn(),
	},
}))

describe("OutputInterceptor", () => {
	let mockWriteStream: any
	let storageDir: string

	beforeEach(() => {
		vi.clearAllMocks()

		storageDir = path.normalize("/tmp/test-storage")

		// Setup mock write stream
		mockWriteStream = {
			write: vi.fn(),
			end: vi.fn(),
		}

		vi.mocked(fs.existsSync).mockReturnValue(true)
		vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Buffering behavior", () => {
		it("should keep small output in memory without spilling to disk", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "echo test",
				storageDir,
				previewSize: "small", // 2KB
				compressProgressBar: false,
			})

			const smallOutput = "Hello World\n"
			interceptor.write(smallOutput)

			expect(interceptor.hasSpilledToDisk()).toBe(false)
			expect(fs.createWriteStream).not.toHaveBeenCalled()

			const result = interceptor.finalize()
			expect(result.preview).toBe(smallOutput)
			expect(result.truncated).toBe(false)
			expect(result.artifactPath).toBe(null)
			expect(result.totalBytes).toBe(Buffer.byteLength(smallOutput, "utf8"))
		})

		it("should spill to disk when output exceeds threshold", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "echo test",
				storageDir,
				previewSize: "small", // 2KB = 2048 bytes
				compressProgressBar: false,
			})

			// Write enough data to exceed 2KB threshold
			const chunk = "x".repeat(1024) // 1KB chunk
			interceptor.write(chunk) // 1KB - should stay in memory
			expect(interceptor.hasSpilledToDisk()).toBe(false)

			interceptor.write(chunk) // 2KB - should stay in memory
			expect(interceptor.hasSpilledToDisk()).toBe(false)

			interceptor.write(chunk) // 3KB - should trigger spill
			expect(interceptor.hasSpilledToDisk()).toBe(true)
			expect(fs.createWriteStream).toHaveBeenCalledWith(path.join(storageDir, "cmd-12345.txt"))
			expect(mockWriteStream.write).toHaveBeenCalled()
		})

		it("should truncate preview after spilling to disk", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "echo test",
				storageDir,
				previewSize: "small", // 2KB
				compressProgressBar: false,
			})

			// Write data that exceeds threshold
			const chunk = "x".repeat(3000)
			interceptor.write(chunk)

			expect(interceptor.hasSpilledToDisk()).toBe(true)

			const result = interceptor.finalize()
			expect(result.truncated).toBe(true)
			expect(result.artifactPath).toBe(path.join(storageDir, "cmd-12345.txt"))
			expect(Buffer.byteLength(result.preview, "utf8")).toBeLessThanOrEqual(2048)
		})

		it("should write subsequent chunks directly to disk after spilling", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "echo test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			// Trigger spill
			const largeChunk = "x".repeat(3000)
			interceptor.write(largeChunk)
			expect(interceptor.hasSpilledToDisk()).toBe(true)

			// Clear mock to track next write
			mockWriteStream.write.mockClear()

			// Write another chunk - should go directly to disk
			const nextChunk = "y".repeat(1000)
			interceptor.write(nextChunk)

			expect(mockWriteStream.write).toHaveBeenCalledWith(nextChunk)
		})
	})

	describe("Threshold settings", () => {
		it("should handle small (2KB) threshold correctly", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			// Write exactly 2KB
			interceptor.write("x".repeat(2048))
			expect(interceptor.hasSpilledToDisk()).toBe(false)

			// Write more to exceed 2KB
			interceptor.write("x")
			expect(interceptor.hasSpilledToDisk()).toBe(true)
		})

		it("should handle medium (4KB) threshold correctly", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "medium",
				compressProgressBar: false,
			})

			// Write exactly 4KB
			interceptor.write("x".repeat(4096))
			expect(interceptor.hasSpilledToDisk()).toBe(false)

			// Write more to exceed 4KB
			interceptor.write("x")
			expect(interceptor.hasSpilledToDisk()).toBe(true)
		})

		it("should handle large (8KB) threshold correctly", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "large",
				compressProgressBar: false,
			})

			// Write exactly 8KB
			interceptor.write("x".repeat(8192))
			expect(interceptor.hasSpilledToDisk()).toBe(false)

			// Write more to exceed 8KB
			interceptor.write("x")
			expect(interceptor.hasSpilledToDisk()).toBe(true)
		})
	})

	describe("Artifact creation", () => {
		it("should create directory if it doesn't exist", () => {
			vi.mocked(fs.existsSync).mockReturnValue(false)

			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			// Trigger spill
			interceptor.write("x".repeat(3000))

			expect(fs.mkdirSync).toHaveBeenCalledWith(storageDir, { recursive: true })
		})

		it("should create artifact file with correct naming pattern", () => {
			const executionId = "1706119234567"
			const interceptor = new OutputInterceptor({
				executionId,
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			// Trigger spill
			interceptor.write("x".repeat(3000))

			expect(fs.createWriteStream).toHaveBeenCalledWith(path.join(storageDir, `cmd-${executionId}.txt`))
		})

		it("should write full output to artifact, not truncated", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			const fullOutput = "x".repeat(5000)
			interceptor.write(fullOutput)

			// The write stream should receive the full buffer content
			expect(mockWriteStream.write).toHaveBeenCalledWith(fullOutput)
		})

		it("should get artifact path from getArtifactPath() method", () => {
			const executionId = "12345"
			const interceptor = new OutputInterceptor({
				executionId,
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			const expectedPath = path.join(storageDir, `cmd-${executionId}.txt`)
			expect(interceptor.getArtifactPath()).toBe(expectedPath)
		})
	})

	describe("finalize() method", () => {
		it("should return preview output for small commands", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "echo hello",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			const output = "Hello World\n"
			interceptor.write(output)

			const result = interceptor.finalize()

			expect(result.preview).toBe(output)
			expect(result.totalBytes).toBe(Buffer.byteLength(output, "utf8"))
			expect(result.artifactPath).toBe(null)
			expect(result.truncated).toBe(false)
		})

		it("should return PersistedCommandOutput for large commands", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			const largeOutput = "x".repeat(5000)
			interceptor.write(largeOutput)

			const result = interceptor.finalize()

			expect(result.truncated).toBe(true)
			expect(result.artifactPath).toBe(path.join(storageDir, "cmd-12345.txt"))
			expect(result.totalBytes).toBe(Buffer.byteLength(largeOutput, "utf8"))
			expect(Buffer.byteLength(result.preview, "utf8")).toBeLessThanOrEqual(2048)
		})

		it("should close write stream when finalizing", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			// Trigger spill
			interceptor.write("x".repeat(3000))
			interceptor.finalize()

			expect(mockWriteStream.end).toHaveBeenCalled()
		})

		it("should include correct metadata (artifactId, size, truncated flag)", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			const output = "x".repeat(5000)
			interceptor.write(output)

			const result = interceptor.finalize()

			expect(result).toHaveProperty("preview")
			expect(result).toHaveProperty("totalBytes", 5000)
			expect(result).toHaveProperty("artifactPath")
			expect(result).toHaveProperty("truncated", true)
			expect(result.artifactPath).toMatch(/cmd-12345\.txt$/)
		})
	})

	describe("Cleanup methods", () => {
		it("should clean up all artifacts in directory", async () => {
			const mockFiles = ["cmd-12345.txt", "cmd-67890.txt", "other-file.txt", "cmd-11111.txt"]
			vi.mocked(fs.promises.readdir).mockResolvedValue(mockFiles as any)
			vi.mocked(fs.promises.unlink).mockResolvedValue(undefined)

			await OutputInterceptor.cleanup(storageDir)

			expect(fs.promises.readdir).toHaveBeenCalledWith(storageDir)
			expect(fs.promises.unlink).toHaveBeenCalledTimes(3)
			expect(fs.promises.unlink).toHaveBeenCalledWith(path.join(storageDir, "cmd-12345.txt"))
			expect(fs.promises.unlink).toHaveBeenCalledWith(path.join(storageDir, "cmd-67890.txt"))
			expect(fs.promises.unlink).toHaveBeenCalledWith(path.join(storageDir, "cmd-11111.txt"))
			expect(fs.promises.unlink).not.toHaveBeenCalledWith(path.join(storageDir, "other-file.txt"))
		})

		it("should handle cleanup when directory doesn't exist", async () => {
			vi.mocked(fs.promises.readdir).mockRejectedValue(new Error("ENOENT"))

			// Should not throw
			await expect(OutputInterceptor.cleanup(storageDir)).resolves.toBeUndefined()
		})

		it("should clean up specific artifacts by executionIds", async () => {
			const mockFiles = ["cmd-12345.txt", "cmd-67890.txt", "cmd-11111.txt"]
			vi.mocked(fs.promises.readdir).mockResolvedValue(mockFiles as any)
			vi.mocked(fs.promises.unlink).mockResolvedValue(undefined)

			// Keep 12345 and 67890, delete 11111
			const keepIds = new Set(["12345", "67890"])
			await OutputInterceptor.cleanupByIds(storageDir, keepIds)

			expect(fs.promises.unlink).toHaveBeenCalledTimes(1)
			expect(fs.promises.unlink).toHaveBeenCalledWith(path.join(storageDir, "cmd-11111.txt"))
			expect(fs.promises.unlink).not.toHaveBeenCalledWith(path.join(storageDir, "cmd-12345.txt"))
			expect(fs.promises.unlink).not.toHaveBeenCalledWith(path.join(storageDir, "cmd-67890.txt"))
		})

		it("should handle unlink errors gracefully", async () => {
			const mockFiles = ["cmd-12345.txt", "cmd-67890.txt"]
			vi.mocked(fs.promises.readdir).mockResolvedValue(mockFiles as any)
			vi.mocked(fs.promises.unlink).mockRejectedValue(new Error("Permission denied"))

			// Should not throw even if unlink fails
			await expect(OutputInterceptor.cleanup(storageDir)).resolves.toBeUndefined()
		})
	})

	describe("Progress bar compression", () => {
		it("should apply compression when compressProgressBar is true", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: true,
			})

			// Output with carriage returns (simulating progress bar)
			const output = "Progress: 10%\rProgress: 50%\rProgress: 100%\n"
			interceptor.write(output)

			const result = interceptor.finalize()

			// Preview should be compressed (carriage returns processed)
			// The processCarriageReturns function should keep only the last line before \r
			expect(result.preview).not.toBe(output)
		})

		it("should not apply compression when compressProgressBar is false", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			const output = "Line 1\nLine 2\n"
			interceptor.write(output)

			const result = interceptor.finalize()
			expect(result.preview).toBe(output)
		})
	})

	describe("getBufferForUI() method", () => {
		it("should return current buffer for UI updates", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			const output = "Hello World"
			interceptor.write(output)

			expect(interceptor.getBufferForUI()).toBe(output)
		})

		it("should return truncated buffer after spilling to disk", () => {
			const interceptor = new OutputInterceptor({
				executionId: "12345",
				taskId: "task-1",
				command: "test",
				storageDir,
				previewSize: "small",
				compressProgressBar: false,
			})

			// Trigger spill
			const largeOutput = "x".repeat(5000)
			interceptor.write(largeOutput)

			const buffer = interceptor.getBufferForUI()
			expect(Buffer.byteLength(buffer, "utf8")).toBeLessThanOrEqual(2048)
		})
	})
})
