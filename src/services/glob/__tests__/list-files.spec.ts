import { vi, describe, it, expect, beforeEach } from "vitest"
import * as path from "path"

// Mock ripgrep to avoid filesystem dependencies
vi.mock("../../ripgrep", () => ({
	getBinPath: vi.fn().mockResolvedValue("/mock/path/to/rg"),
}))

// Mock vscode
vi.mock("vscode", () => ({
	env: {
		appRoot: "/mock/app/root",
	},
}))

// Mock filesystem operations
vi.mock("fs", () => ({
	promises: {
		access: vi.fn().mockRejectedValue(new Error("Not found")),
		readFile: vi.fn().mockResolvedValue(""),
		readdir: vi.fn().mockResolvedValue([]),
	},
}))

vi.mock("child_process", () => ({
	spawn: vi.fn(),
}))

vi.mock("../../path", () => ({
	arePathsEqual: vi.fn().mockReturnValue(false),
}))

import { listFiles } from "../list-files"
import * as childProcess from "child_process"
import * as fs from "fs"

describe("list-files symlink support", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should include --follow flag in ripgrep arguments", async () => {
		const mockSpawn = vi.mocked(childProcess.spawn)
		const mockProcess = {
			stdout: {
				on: vi.fn((event, callback) => {
					if (event === "data") {
						// Simulate some output to complete the process
						setTimeout(() => callback("test-file.txt\n"), 10)
					}
				}),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event, callback) => {
				if (event === "close") {
					setTimeout(() => callback(0), 20)
				}
				if (event === "error") {
					// No error simulation
				}
			}),
			kill: vi.fn(),
		}

		mockSpawn.mockReturnValue(mockProcess as any)

		// Call listFiles to trigger ripgrep execution
		await listFiles("/test/dir", false, 100)

		// Verify that spawn was called with --follow flag (the critical fix)
		const [rgPath, args] = mockSpawn.mock.calls[0]
		expect(rgPath).toBe("/mock/path/to/rg")
		expect(args).toContain("--files")
		expect(args).toContain("--hidden")
		expect(args).toContain("--follow") // This is the critical assertion - the fix should add this flag

		// Platform-agnostic path check - verify the last argument is the resolved path
		const expectedPath = path.resolve("/test/dir")
		expect(args[args.length - 1]).toBe(expectedPath)
	})

	it("should include --follow flag for recursive listings too", async () => {
		const mockSpawn = vi.mocked(childProcess.spawn)
		const mockProcess = {
			stdout: {
				on: vi.fn((event, callback) => {
					if (event === "data") {
						setTimeout(() => callback("test-file.txt\n"), 10)
					}
				}),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event, callback) => {
				if (event === "close") {
					setTimeout(() => callback(0), 20)
				}
				if (event === "error") {
					// No error simulation
				}
			}),
			kill: vi.fn(),
		}

		mockSpawn.mockReturnValue(mockProcess as any)

		// Call listFiles with recursive=true
		await listFiles("/test/dir", true, 100)

		// Verify that spawn was called with --follow flag (the critical fix)
		const [rgPath, args] = mockSpawn.mock.calls[0]
		expect(rgPath).toBe("/mock/path/to/rg")
		expect(args).toContain("--files")
		expect(args).toContain("--hidden")
		expect(args).toContain("--follow") // This should be present in recursive mode too

		// Platform-agnostic path check - verify the last argument is the resolved path
		const expectedPath = path.resolve("/test/dir")
		expect(args[args.length - 1]).toBe(expectedPath)
	})
})

describe("hidden directory exclusion", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should exclude .git subdirectories from recursive directory listing", async () => {
		// Mock filesystem structure with .git subdirectories
		const mockReaddir = vi.fn()
		vi.mocked(fs.promises).readdir = mockReaddir

		// Mock the directory structure:
		// /test/
		//   .git/
		//     hooks/
		//     objects/
		//   src/
		//     components/
		mockReaddir
			.mockResolvedValueOnce([
				{ name: ".git", isDirectory: () => true, isSymbolicLink: () => false },
				{ name: "src", isDirectory: () => true, isSymbolicLink: () => false },
			])
			.mockResolvedValueOnce([
				// src subdirectories (should be included)
				{ name: "components", isDirectory: () => true, isSymbolicLink: () => false },
			])
			.mockResolvedValueOnce([]) // components/ is empty

		// Mock ripgrep to return no files
		const mockSpawn = vi.mocked(childProcess.spawn)
		const mockProcess = {
			stdout: {
				on: vi.fn((event, callback) => {
					if (event === "data") {
						// No files returned
					}
				}),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event, callback) => {
				if (event === "close") {
					setTimeout(() => callback(0), 10)
				}
			}),
			kill: vi.fn(),
		}
		mockSpawn.mockReturnValue(mockProcess as any)

		// Call listFiles with recursive=true
		const [result] = await listFiles("/test", true, 100)

		// Verify that .git subdirectories are NOT included
		const directories = result.filter((item) => item.endsWith("/"))

		// More specific checks - look for exact paths
		const hasSrcDir = directories.some((dir) => dir.endsWith("/test/src/") || dir.endsWith("src/"))
		const hasComponentsDir = directories.some(
			(dir) =>
				dir.endsWith("/test/src/components/") || dir.endsWith("src/components/") || dir.includes("components/"),
		)
		const hasGitDir = directories.some((dir) => dir.includes(".git/"))

		// Should include src/ and src/components/ but NOT .git/ or its subdirectories
		expect(hasSrcDir).toBe(true)
		expect(hasComponentsDir).toBe(true)

		// Should NOT include .git (hidden directories are excluded)
		expect(hasGitDir).toBe(false)
	})

	it("should allow explicit targeting of hidden directories", async () => {
		// Mock filesystem structure for explicit .roo-memory targeting
		const mockReaddir = vi.fn()
		vi.mocked(fs.promises).readdir = mockReaddir

		// Mock .roo-memory directory contents
		mockReaddir.mockResolvedValueOnce([
			{ name: "tasks", isDirectory: () => true, isSymbolicLink: () => false },
			{ name: "context", isDirectory: () => true, isSymbolicLink: () => false },
		])

		// Mock ripgrep to return no files
		const mockSpawn = vi.mocked(childProcess.spawn)
		const mockProcess = {
			stdout: {
				on: vi.fn((event, callback) => {
					if (event === "data") {
						// No files returned
					}
				}),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event, callback) => {
				if (event === "close") {
					setTimeout(() => callback(0), 10)
				}
			}),
			kill: vi.fn(),
		}
		mockSpawn.mockReturnValue(mockProcess as any)

		// Call listFiles explicitly targeting .roo-memory directory
		const [result] = await listFiles("/test/.roo-memory", true, 100)

		// When explicitly targeting a hidden directory, its subdirectories should be included
		const directories = result.filter((item) => item.endsWith("/"))

		const hasTasksDir = directories.some((dir) => dir.includes(".roo-memory/tasks/") || dir.includes("tasks/"))
		const hasContextDir = directories.some(
			(dir) => dir.includes(".roo-memory/context/") || dir.includes("context/"),
		)

		expect(hasTasksDir).toBe(true)
		expect(hasContextDir).toBe(true)
	})
})
