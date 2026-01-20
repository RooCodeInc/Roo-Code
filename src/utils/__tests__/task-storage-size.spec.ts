import * as path from "path"
import { calculateTaskStorageSize, formatBytes } from "../task-storage-size"

// Mock fs/promises
const mockReaddir = vi.fn()
const mockStat = vi.fn()

vi.mock("fs/promises", () => ({
	readdir: (...args: unknown[]) => mockReaddir(...args),
	stat: (...args: unknown[]) => mockStat(...args),
}))

describe("formatBytes", () => {
	it("should format 0 bytes", () => {
		expect(formatBytes(0)).toBe("0 B")
	})

	it("should format bytes less than 1 KB", () => {
		expect(formatBytes(512)).toBe("512 B")
		expect(formatBytes(1)).toBe("1 B")
	})

	it("should format kilobytes (0 decimal places)", () => {
		expect(formatBytes(1024)).toBe("1 KB")
		expect(formatBytes(2048)).toBe("2 KB")
		expect(formatBytes(1536)).toBe("2 KB") // Rounds to nearest integer
		expect(formatBytes(1280)).toBe("1 KB") // Rounds down
	})

	it("should format megabytes (2 decimal places)", () => {
		expect(formatBytes(1048576)).toBe("1.00 MB")
		expect(formatBytes(1572864)).toBe("1.50 MB")
		expect(formatBytes(10485760)).toBe("10.00 MB")
	})

	it("should format gigabytes (2 decimal places)", () => {
		expect(formatBytes(1073741824)).toBe("1.00 GB")
		expect(formatBytes(2147483648)).toBe("2.00 GB")
	})

	it("should format terabytes (2 decimal places)", () => {
		expect(formatBytes(1099511627776)).toBe("1.00 TB")
	})

	it("should handle decimal precision correctly", () => {
		expect(formatBytes(1234567)).toBe("1.18 MB")
		expect(formatBytes(123456789)).toBe("117.74 MB")
	})
})

describe("calculateTaskStorageSize", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should return zeros when tasks directory does not exist", async () => {
		mockReaddir.mockRejectedValue(new Error("ENOENT: no such file or directory"))

		const result = await calculateTaskStorageSize("/global/storage")

		expect(result).toEqual({
			totalBytes: 0,
			taskCount: 0,
			formattedSize: "0 B",
		})
	})

	it("should calculate size of empty tasks directory", async () => {
		mockReaddir.mockResolvedValue([])

		const result = await calculateTaskStorageSize("/global/storage")

		expect(result).toEqual({
			totalBytes: 0,
			taskCount: 0,
			formattedSize: "0 B",
		})
	})

	it("should count task directories correctly", async () => {
		// Mock the tasks directory read
		mockReaddir.mockImplementation((dirPath: string, options?: { withFileTypes: boolean }) => {
			const pathStr = typeof dirPath === "string" ? dirPath : String(dirPath)
			if (pathStr.endsWith("tasks")) {
				// Return task directories
				return Promise.resolve([
					{ name: "task-1", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
					{ name: "task-2", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
					{ name: "task-3", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
				])
			}
			// Task subdirectories are empty
			return Promise.resolve([])
		})

		const result = await calculateTaskStorageSize("/global/storage")

		expect(result.taskCount).toBe(3)
	})

	it("should calculate total size including files", async () => {
		// Mock the tasks directory read
		mockReaddir.mockImplementation((dirPath: string) => {
			const pathStr = typeof dirPath === "string" ? dirPath : String(dirPath)
			if (pathStr.endsWith("tasks")) {
				return Promise.resolve([
					{ name: "task-1", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
				])
			}
			if (pathStr.includes("task-1")) {
				return Promise.resolve([
					{ name: "file1.txt", isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
					{ name: "file2.json", isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
				])
			}
			return Promise.resolve([])
		})

		mockStat.mockImplementation((filePath: string) => {
			if (filePath.includes("file1.txt")) {
				return Promise.resolve({ size: 1024 })
			}
			if (filePath.includes("file2.json")) {
				return Promise.resolve({ size: 2048 })
			}
			return Promise.resolve({ size: 0 })
		})

		const result = await calculateTaskStorageSize("/global/storage")

		expect(result.totalBytes).toBe(3072)
		expect(result.formattedSize).toBe("3 KB")
		expect(result.taskCount).toBe(1)
	})

	it("should handle nested directories (like checkpoints)", async () => {
		mockReaddir.mockImplementation((dirPath: string) => {
			const pathStr = typeof dirPath === "string" ? dirPath : String(dirPath)
			if (pathStr.endsWith("tasks")) {
				return Promise.resolve([
					{ name: "task-1", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
				])
			}
			if (pathStr.endsWith("task-1") && !pathStr.includes("checkpoints")) {
				return Promise.resolve([
					{
						name: "api_conversation.json",
						isDirectory: () => false,
						isFile: () => true,
						isSymbolicLink: () => false,
					},
					{ name: "checkpoints", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
				])
			}
			if (pathStr.includes("checkpoints")) {
				return Promise.resolve([
					{
						name: "checkpoint-1.json",
						isDirectory: () => false,
						isFile: () => true,
						isSymbolicLink: () => false,
					},
				])
			}
			return Promise.resolve([])
		})

		mockStat.mockImplementation((filePath: string) => {
			if (filePath.includes("api_conversation.json")) {
				return Promise.resolve({ size: 5000 })
			}
			if (filePath.includes("checkpoint-1.json")) {
				return Promise.resolve({ size: 10000 })
			}
			return Promise.resolve({ size: 0 })
		})

		const result = await calculateTaskStorageSize("/global/storage")

		expect(result.totalBytes).toBe(15000)
		expect(result.taskCount).toBe(1)
	})

	it("should handle stat errors gracefully", async () => {
		mockReaddir.mockImplementation((dirPath: string) => {
			const pathStr = typeof dirPath === "string" ? dirPath : String(dirPath)
			if (pathStr.endsWith("tasks")) {
				return Promise.resolve([
					{ name: "task-1", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
				])
			}
			return Promise.resolve([
				{ name: "broken-file.txt", isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
			])
		})

		mockStat.mockRejectedValue(new Error("Permission denied"))

		const result = await calculateTaskStorageSize("/global/storage")

		// Should still return a result, just with 0 bytes for the failed stat
		expect(result.taskCount).toBe(1)
		expect(result.totalBytes).toBe(0)
	})

	it("should handle mixed files and directories in tasks folder", async () => {
		mockReaddir.mockImplementation((dirPath: string) => {
			const pathStr = typeof dirPath === "string" ? dirPath : String(dirPath)
			if (pathStr.endsWith("tasks")) {
				return Promise.resolve([
					{ name: "task-1", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
					{
						name: "some-file.txt",
						isDirectory: () => false,
						isFile: () => true,
						isSymbolicLink: () => false,
					}, // Should not count as task
				])
			}
			return Promise.resolve([])
		})

		mockStat.mockImplementation((filePath: string) => {
			if (filePath.includes("some-file.txt")) {
				return Promise.resolve({ size: 100 })
			}
			return Promise.resolve({ size: 0 })
		})

		const result = await calculateTaskStorageSize("/global/storage")

		// Only directories count as tasks
		expect(result.taskCount).toBe(1)
		// But file size should be included
		expect(result.totalBytes).toBe(100)
	})
})
