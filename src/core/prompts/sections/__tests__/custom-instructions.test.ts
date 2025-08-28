import { describe, it, expect, vi, beforeEach } from "vitest"
import * as path from "path"

// Mock modules before importing the function to test
vi.mock("fs/promises", () => ({
	default: {},
	stat: vi.fn(),
	readFile: vi.fn(),
	readdir: vi.fn(),
}))

vi.mock("glob", () => ({
	glob: vi.fn().mockResolvedValue([]),
}))

// Import after mocking
import { loadCustomInstructionFiles } from "../custom-instructions"
import * as fs from "fs/promises"
import { glob } from "glob"

describe("loadCustomInstructionFiles", () => {
	const mockCwd = "/workspace/project"

	beforeEach(() => {
		vi.clearAllMocks()
		// Reset console.warn mock
		vi.spyOn(console, "warn").mockImplementation(() => {})
	})

	describe("basic functionality", () => {
		it("should return empty string when customPaths is undefined", async () => {
			const result = await loadCustomInstructionFiles(mockCwd, undefined)
			expect(result).toBe("")
		})

		it("should return empty string when customPaths is empty array", async () => {
			const result = await loadCustomInstructionFiles(mockCwd, [])
			expect(result).toBe("")
		})
	})

	describe("single file loading", () => {
		it("should load content from a single file", async () => {
			const filePath = ".github/copilot-instructions.md"
			const resolvedPath = path.resolve(mockCwd, filePath)
			const mockContent = "Custom Instructions"

			// Setup mocks
			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 100,
			} as any)

			vi.mocked(fs.readFile).mockResolvedValue(mockContent)

			const result = await loadCustomInstructionFiles(mockCwd, [filePath])

			expect(fs.stat).toHaveBeenCalledWith(resolvedPath)
			expect(fs.readFile).toHaveBeenCalledWith(resolvedPath, "utf-8")
			expect(result).toContain("Custom Instructions")
			expect(result).toContain(`# Custom instructions from ${filePath}:`)
		})

		it("should skip files that exceed size limit", async () => {
			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 2 * 1024 * 1024, // 2MB
			} as any)

			const result = await loadCustomInstructionFiles(mockCwd, ["large-file.md"])

			expect(fs.readFile).not.toHaveBeenCalled()
			expect(result).toBe("")
		})

		it("should skip files without allowed extensions", async () => {
			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 100,
			} as any)

			const result = await loadCustomInstructionFiles(mockCwd, ["file.js"])

			expect(fs.readFile).not.toHaveBeenCalled()
			expect(result).toBe("")
		})
	})

	describe("directory loading", () => {
		it("should load all .md and .txt files from a directory", async () => {
			const dirPath = ".roocode"
			const resolvedPath = path.resolve(mockCwd, dirPath)

			// Mock stat to identify as directory
			vi.mocked(fs.stat)
				.mockResolvedValueOnce({
					isFile: () => false,
					isDirectory: () => true,
				} as any)
				// For individual files
				.mockResolvedValue({
					isFile: () => true,
					isDirectory: () => false,
					size: 100,
				} as any)

			// Mock readdir
			vi.mocked(fs.readdir).mockResolvedValue([
				{ name: "instructions.md", isFile: () => true, isDirectory: () => false },
				{ name: "rules.txt", isFile: () => true, isDirectory: () => false },
				{ name: "image.png", isFile: () => true, isDirectory: () => false },
			] as any)

			// Mock readFile
			vi.mocked(fs.readFile).mockResolvedValueOnce("Instructions content").mockResolvedValueOnce("Rules content")

			const result = await loadCustomInstructionFiles(mockCwd, [dirPath])

			expect(fs.readdir).toHaveBeenCalledWith(resolvedPath, { withFileTypes: true })
			expect(fs.readFile).toHaveBeenCalledTimes(2) // Only .md and .txt files
			expect(result).toContain("Instructions content")
			expect(result).toContain("Rules content")
		})
	})

	describe("glob patterns", () => {
		it("should expand glob patterns and load matching files", async () => {
			const pattern = "docs/**/*.md"
			const matches = [path.resolve(mockCwd, "docs/api.md"), path.resolve(mockCwd, "docs/guide.md")]

			// Mock stat to fail first (triggering glob)
			vi.mocked(fs.stat)
				.mockRejectedValueOnce(new Error("Not found"))
				.mockResolvedValue({
					isFile: () => true,
					isDirectory: () => false,
					size: 100,
				} as any)

			// Mock glob
			vi.mocked(glob).mockResolvedValue(matches)

			// Mock readFile
			vi.mocked(fs.readFile).mockResolvedValueOnce("API docs").mockResolvedValueOnce("Guide docs")

			const result = await loadCustomInstructionFiles(mockCwd, [pattern])

			expect(glob).toHaveBeenCalledWith(pattern, {
				cwd: mockCwd,
				absolute: true,
				nodir: true,
				ignore: ["**/node_modules/**", "**/.git/**"],
			})
			expect(result).toContain("API docs")
			expect(result).toContain("Guide docs")
		})
	})

	describe("security validation", () => {
		it("should reject paths outside workspace and parent", async () => {
			const outsidePath = "/etc/passwd"

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 50,
			} as any)

			const result = await loadCustomInstructionFiles(mockCwd, [outsidePath])

			expect(fs.readFile).not.toHaveBeenCalled()
			expect(console.warn).toHaveBeenCalledWith(
				expect.stringContaining("Skipping instruction path outside allowed directories"),
			)
			expect(result).toBe("")
		})

		it("should allow parent directory access", async () => {
			const parentPath = "../parent-instructions.md"
			// This resolves to /workspace/parent-instructions.md which is in the parent dir
			const resolvedPath = "/workspace/parent-instructions.md"

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 50,
			} as any)

			vi.mocked(fs.readFile).mockResolvedValue("Parent instructions")

			const result = await loadCustomInstructionFiles(mockCwd, [parentPath])

			expect(result).toContain("Parent instructions")
			expect(result).toContain("# Custom instructions from ../parent-instructions.md:")
		})

		it("should allow workspace subdirectories", async () => {
			const subPath = "src/rules/custom.md"

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 50,
			} as any)

			vi.mocked(fs.readFile).mockResolvedValue("Subdirectory content")

			const result = await loadCustomInstructionFiles(mockCwd, [subPath])

			expect(result).toContain("Subdirectory content")
			expect(result).toContain("# Custom instructions from src/rules/custom.md:")
		})
	})

	describe("error handling", () => {
		it("should handle file read errors gracefully", async () => {
			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 100,
			} as any)

			vi.mocked(fs.readFile).mockRejectedValue(new Error("Permission denied"))

			const result = await loadCustomInstructionFiles(mockCwd, ["protected.md"])

			expect(console.warn).toHaveBeenCalledWith(
				expect.stringContaining("Error reading instruction file"),
				expect.any(Error),
			)
			expect(result).toBe("")
		})

		it("should handle glob errors gracefully", async () => {
			vi.mocked(fs.stat).mockRejectedValue(new Error("Not found"))

			vi.mocked(glob).mockRejectedValue(new Error("Invalid pattern"))

			const result = await loadCustomInstructionFiles(mockCwd, ["[invalid"])

			expect(console.warn).toHaveBeenCalledWith(
				expect.stringContaining("Error processing custom instruction path"),
				expect.any(Error),
			)
			expect(result).toBe("")
		})

		it("should handle directory read errors gracefully", async () => {
			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => false,
				isDirectory: () => true,
			} as any)

			vi.mocked(fs.readdir).mockRejectedValue(new Error("Permission denied"))

			const result = await loadCustomInstructionFiles(mockCwd, [".roocode"])

			// Should fall through to glob attempt
			expect(result).toBe("")
		})
	})

	describe("content formatting", () => {
		it("should format content with proper headers", async () => {
			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 50,
			} as any)
			vi.mocked(fs.readFile).mockResolvedValue("Test content")

			const result = await loadCustomInstructionFiles(mockCwd, ["test.md"])

			expect(result).toContain("# Custom instructions from test.md:")
			expect(result).toContain("Test content")
		})

		it("should combine multiple files with proper formatting", async () => {
			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 50,
			} as any)
			vi.mocked(fs.readFile).mockResolvedValueOnce("Content 1").mockResolvedValueOnce("Content 2")

			const result = await loadCustomInstructionFiles(mockCwd, ["file1.md", "file2.md"])

			expect(result).toMatch(
				/# Custom instructions from file1\.md:[\s\S]*Content 1[\s\S]*# Custom instructions from file2\.md:[\s\S]*Content 2/,
			)
		})
	})

	describe("mixed path types", () => {
		it("should handle a mix of files, directories, and globs", async () => {
			// Setup for single file
			vi.mocked(fs.stat)
				.mockResolvedValueOnce({
					isFile: () => true,
					isDirectory: () => false,
					size: 50,
				} as any)
				// Setup for directory
				.mockResolvedValueOnce({
					isFile: () => false,
					isDirectory: () => true,
				} as any)
				// Setup for glob (will fail stat, triggering glob)
				.mockRejectedValueOnce(new Error("Not found"))
				// For directory file and glob file
				.mockResolvedValue({
					isFile: () => true,
					isDirectory: () => false,
					size: 50,
				} as any)

			// Setup directory listing
			vi.mocked(fs.readdir).mockResolvedValue([
				{ name: "dir-file.md", isFile: () => true, isDirectory: () => false },
			] as any)

			// Setup glob
			vi.mocked(glob).mockResolvedValue([path.resolve(mockCwd, "docs/glob-file.md")])

			// Setup file reads
			vi.mocked(fs.readFile)
				.mockResolvedValueOnce("Single file content")
				.mockResolvedValueOnce("Directory file content")
				.mockResolvedValueOnce("Glob file content")

			const result = await loadCustomInstructionFiles(mockCwd, ["single.md", ".roocode", "docs/**/*.md"])

			expect(result).toContain("Single file content")
			expect(result).toContain("Directory file content")
			expect(result).toContain("Glob file content")
		})
	})
})
