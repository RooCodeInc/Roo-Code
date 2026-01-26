import { calculateTaskStorageSize, formatBytes } from "../task-storage-size"

// Mock storage to avoid VS Code config access during tests
vi.mock("../storage", () => ({
	getStorageBasePath: (p: string) => Promise.resolve(p),
}))

// Mock fs/promises
const mockReaddir = vi.fn()

vi.mock("fs/promises", () => ({
	readdir: (...args: unknown[]) => mockReaddir(...args),
}))

// formatBytes is still exported for backwards compatibility but not used by calculateTaskStorageSize
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

	it("should return zero count when tasks directory does not exist", async () => {
		mockReaddir.mockRejectedValue(new Error("ENOENT: no such file or directory"))

		const result = await calculateTaskStorageSize("/global/storage")

		expect(result).toEqual({
			taskCount: 0,
		})
	})

	it("should return zero count for empty tasks directory", async () => {
		mockReaddir.mockResolvedValue([])

		const result = await calculateTaskStorageSize("/global/storage")

		expect(result).toEqual({
			taskCount: 0,
		})
	})

	it("should count task directories correctly", async () => {
		// Mock the tasks directory read
		mockReaddir.mockImplementation((dirPath: string) => {
			const pathStr = typeof dirPath === "string" ? dirPath : String(dirPath)
			if (pathStr.endsWith("tasks")) {
				// Return task directories
				return Promise.resolve([
					{ name: "task-1", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
					{ name: "task-2", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
					{ name: "task-3", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
				])
			}
			return Promise.resolve([])
		})

		const result = await calculateTaskStorageSize("/global/storage")

		expect(result.taskCount).toBe(3)
	})

	it("should only count directories, not files in tasks folder", async () => {
		mockReaddir.mockImplementation((dirPath: string) => {
			const pathStr = typeof dirPath === "string" ? dirPath : String(dirPath)
			if (pathStr.endsWith("tasks")) {
				return Promise.resolve([
					{ name: "task-1", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
					{ name: "task-2", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
					{
						name: "some-file.txt",
						isDirectory: () => false,
						isFile: () => true,
						isSymbolicLink: () => false,
					}, // Should not count as task
					{
						name: "another-file.json",
						isDirectory: () => false,
						isFile: () => true,
						isSymbolicLink: () => false,
					}, // Should not count as task
				])
			}
			return Promise.resolve([])
		})

		const result = await calculateTaskStorageSize("/global/storage")

		// Only directories count as tasks
		expect(result.taskCount).toBe(2)
	})

	it("should handle large task counts efficiently (does not recurse into subdirectories)", async () => {
		// Simulate 9000 task directories - this should be fast since we don't recurse
		const manyTasks = Array.from({ length: 9000 }, (_, i) => ({
			name: `task-${i}`,
			isDirectory: () => true,
			isFile: () => false,
			isSymbolicLink: () => false,
		}))

		mockReaddir.mockImplementation((dirPath: string) => {
			const pathStr = typeof dirPath === "string" ? dirPath : String(dirPath)
			if (pathStr.endsWith("tasks")) {
				return Promise.resolve(manyTasks)
			}
			return Promise.resolve([])
		})

		const startTime = Date.now()
		const result = await calculateTaskStorageSize("/global/storage")
		const elapsed = Date.now() - startTime

		expect(result.taskCount).toBe(9000)
		// Should complete quickly since we're not recursing into directories
		expect(elapsed).toBeLessThan(100) // Should be nearly instant
	})

	it("should handle readdir errors gracefully", async () => {
		mockReaddir.mockRejectedValue(new Error("Permission denied"))

		const result = await calculateTaskStorageSize("/global/storage")

		expect(result).toEqual({
			taskCount: 0,
		})
	})
})
