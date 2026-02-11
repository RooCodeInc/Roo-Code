import * as path from "path"
import * as childProcess from "child_process"
import { listFiles } from "../list-files"

vi.mock("child_process")
vi.mock("fs")
vi.mock("vscode", () => ({
	env: {
		appRoot: "/mock/vscode/app/root",
	},
}))

vi.mock("../../ripgrep", () => ({
	getBinPath: vi.fn().mockResolvedValue("/mock/path/to/rg"),
}))

vi.mock("../list-files", async () => {
	const actual = await vi.importActual("../list-files")
	return {
		...actual,
		handleSpecialDirectories: vi.fn(),
	}
})

describe("listFiles", () => {
	it("should return empty array immediately when limit is 0", async () => {
		const results: string[] = []
		for await (const file of listFiles("/test/path", true, 0)) {
			results.push(file)
		}

		expect(results).toEqual([])
	})
})

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

// Import fs to set up mocks
import * as fs from "fs"

// Ensure fs.promises.readdir is properly mocked to return empty arrays
// This prevents the generator from hanging during recursive directory scanning
vi.mocked(fs.promises.readdir).mockResolvedValue([])

vi.mock("child_process", () => ({
	spawn: vi.fn(),
}))

vi.mock("../../path", () => ({
	arePathsEqual: vi.fn().mockReturnValue(false),
}))

describe("list-files symlink support", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should include --follow flag in ripgrep arguments", async () => {
		const mockSpawn = vi.mocked(childProcess.spawn)

		// Store callbacks so we can invoke them
		let dataCallback: any = null
		let closeCallback: any = null

		const mockProcess = {
			stdout: {
				on: vi.fn((event: string, callback: any) => {
					if (event === "data") {
						dataCallback = callback
					}
				}),
				pause: vi.fn(),
				resume: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event: string, callback: any) => {
				if (event === "close") {
					closeCallback = callback
				}
			}),
			kill: vi.fn(),
		}

		mockSpawn.mockReturnValue(mockProcess as any)

		// Use a test directory path
		const testDir = "/test/dir"

		// Start consuming the generator
		const gen = listFiles(testDir, false, 100)
		const results: string[] = []

		// Consume the generator in the background
		const consumePromise = (async () => {
			for await (const file of gen) {
				results.push(file)
			}
		})()

		// Wait a bit for the generator to start
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate ripgrep output
		dataCallback?.("test-file.txt\n")

		// Wait a bit for the data to be processed
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate process closing
		closeCallback?.(0)

		// Wait for the generator to complete
		await consumePromise

		// Verify that spawn was called with --follow flag (the critical fix)
		const [rgPath, args] = mockSpawn.mock.calls[0]
		expect(rgPath).toBe("/mock/path/to/rg")
		expect(args).toContain("--files")
		expect(args).toContain("--hidden")
		expect(args).toContain("--follow") // This is the critical assertion - the fix should add this flag

		// Platform-agnostic path check - verify the last argument ends with the expected path
		const lastArg = args[args.length - 1]
		// On Windows, the path might be resolved to something like D:\test\dir
		// On Unix, it would be /test/dir
		// So we just check that it ends with the expected segments
		expect(lastArg).toMatch(/[/\\]test[/\\]dir$/)
	})

	it("should include --follow flag for recursive listings too", async () => {
		const mockSpawn = vi.mocked(childProcess.spawn)

		// Store callbacks so we can invoke them
		let dataCallback: any = null
		let closeCallback: any = null

		const mockProcess = {
			stdout: {
				on: vi.fn((event: string, callback: any) => {
					if (event === "data") {
						dataCallback = callback
					}
				}),
				pause: vi.fn(),
				resume: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event: string, callback: any) => {
				if (event === "close") {
					closeCallback = callback
				}
			}),
			kill: vi.fn(),
		}

		mockSpawn.mockReturnValue(mockProcess as any)

		// Use a test directory path
		const testDir = "/test/dir"

		// Start consuming the generator
		const gen = listFiles(testDir, true, 100)
		const results: string[] = []

		// Consume the generator in the background
		const consumePromise = (async () => {
			for await (const file of gen) {
				results.push(file)
			}
		})()

		// Wait a bit for the generator to start
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate ripgrep output
		dataCallback?.("test-file.txt\n")

		// Wait a bit for the data to be processed
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate process closing
		closeCallback?.(0)

		// Wait for the generator to complete
		await consumePromise

		// Verify that spawn was called with --follow flag (the critical fix)
		const [rgPath, args] = mockSpawn.mock.calls[0]
		expect(rgPath).toBe("/mock/path/to/rg")
		expect(args).toContain("--files")
		expect(args).toContain("--hidden")
		expect(args).toContain("--follow") // This should be present in recursive mode too

		// Platform-agnostic path check - verify the last argument ends with the expected path
		const lastArg = args[args.length - 1]
		// On Windows, the path might be resolved to something like D:\test\dir
		// On Unix, it would be /test/dir
		// So we just check that it ends with the expected segments
		expect(lastArg).toMatch(/[/\\]test[/\\]dir$/)
	})

	it("should ensure first-level directories are included when limit is reached", async () => {
		// Mock fs.promises.readdir to simulate a directory structure
		const mockReaddir = vi.mocked(fs.promises.readdir)

		// Root directory with first-level directories
		mockReaddir.mockResolvedValueOnce([
			{ name: "a_dir", isDirectory: () => true, isSymbolicLink: () => false, isFile: () => false } as any,
			{ name: "b_dir", isDirectory: () => true, isSymbolicLink: () => false, isFile: () => false } as any,
			{ name: "c_dir", isDirectory: () => true, isSymbolicLink: () => false, isFile: () => false } as any,
			{ name: "file1.txt", isDirectory: () => false, isSymbolicLink: () => false, isFile: () => true } as any,
			{ name: "file2.txt", isDirectory: () => false, isSymbolicLink: () => false, isFile: () => true } as any,
		])

		// Mock ripgrep to return many files (simulating hitting the limit)
		const mockSpawn = vi.mocked(childProcess.spawn)

		// Store callbacks so we can invoke them
		let dataCallback: any = null
		let closeCallback: any = null

		const mockProcess = {
			stdout: {
				on: vi.fn((event: string, callback: any) => {
					if (event === "data") {
						dataCallback = callback
					}
				}),
				pause: vi.fn(),
				resume: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event: string, callback: any) => {
				if (event === "close") {
					closeCallback = callback
				}
			}),
			kill: vi.fn(),
		}
		mockSpawn.mockReturnValue(mockProcess as any)

		// Mock fs.promises.access to simulate .gitignore doesn't exist
		vi.mocked(fs.promises.access).mockRejectedValue(new Error("File not found"))

		// Call listFiles with recursive=true and a small limit
		const gen = listFiles("/test/dir", true, 10)
		const results: string[] = []

		// Consume the generator in the background
		const consumePromise = (async () => {
			for await (const file of gen) {
				results.push(file)
			}
		})()

		// Wait a bit for the generator to start
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate ripgrep output - return many file paths to trigger the limit
		// Note: ripgrep returns relative paths
		const paths =
			[
				"a_dir/",
				"a_dir/subdir1/",
				"a_dir/subdir1/file1.txt",
				"a_dir/subdir1/file2.txt",
				"a_dir/subdir2/",
				"a_dir/subdir2/file3.txt",
				"a_dir/file4.txt",
				"a_dir/file5.txt",
				"file1.txt",
				"file2.txt",
				// Note: b_dir and c_dir are missing from ripgrep output
			].join("\n") + "\n"
		dataCallback?.(paths)

		// Wait a bit for the data to be processed
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate process closing
		closeCallback?.(0)

		// Wait for the generator to complete
		await consumePromise

		const limitReached = results.length >= 10

		// Verify that we got results and hit the limit
		expect(results.length).toBe(10)
		expect(limitReached).toBe(true)

		// Count directories in results
		const directories = results.filter((r) => r.endsWith("/"))

		// We should have at least the 3 first-level directories
		// even if ripgrep didn't return all of them
		expect(directories.length).toBeGreaterThanOrEqual(3)

		// Verify all first-level directories are included
		const hasADir = results.some((r) => r.endsWith("a_dir/"))
		const hasBDir = results.some((r) => r.endsWith("b_dir/"))
		const hasCDir = results.some((r) => r.endsWith("c_dir/"))

		expect(hasADir).toBe(true)
		expect(hasBDir).toBe(true)
		expect(hasCDir).toBe(true)
	}, 30000) // Increase timeout to 30s
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

		// Store callbacks so we can invoke them
		let closeCallback: any = null

		const mockProcess = {
			stdout: {
				on: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event: string, callback: any) => {
				if (event === "close") {
					closeCallback = callback
				}
			}),
			kill: vi.fn(),
		}
		mockSpawn.mockReturnValue(mockProcess as any)

		// Call listFiles with recursive=true
		const gen = listFiles("/test", true, 100)
		const result: string[] = []

		// Consume the generator in the background
		const consumePromise = (async () => {
			for await (const file of gen) {
				result.push(file)
			}
		})()

		// Wait a bit for the generator to start
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate process closing
		closeCallback?.(0)

		// Wait for the generator to complete
		await consumePromise

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
	}, 30000) // Increase timeout to 30s

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

		// Store callbacks so we can invoke them
		let closeCallback: any = null

		const mockProcess = {
			stdout: {
				on: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event: string, callback: any) => {
				if (event === "close") {
					closeCallback = callback
				}
			}),
			kill: vi.fn(),
		}
		mockSpawn.mockReturnValue(mockProcess as any)

		// Call listFiles explicitly targeting .roo-memory directory
		const gen = listFiles("/test/.roo-memory", true, 100)
		const result: string[] = []

		// Consume the generator in the background
		const consumePromise = (async () => {
			for await (const file of gen) {
				result.push(file)
			}
		})()

		// Wait a bit for the generator to start
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate process closing
		closeCallback?.(0)

		// Wait for the generator to complete
		await consumePromise

		// When explicitly targeting a hidden directory, its subdirectories should be included
		const directories = result.filter((item) => item.endsWith("/"))

		const hasTasksDir = directories.some((dir) => dir.includes(".roo-memory/tasks/") || dir.includes("tasks/"))
		const hasContextDir = directories.some(
			(dir) => dir.includes(".roo-memory/context/") || dir.includes("context/"),
		)

		expect(hasTasksDir).toBe(true)
		expect(hasContextDir).toBe(true)
	}, 30000) // Increase timeout to 30s

	it("should include top-level files when recursively listing a hidden directory that's also in DIRS_TO_IGNORE", async () => {
		// This test specifically addresses the bug where files at the root level of .roo/temp
		// were being excluded when using recursive listing
		const mockSpawn = vi.mocked(childProcess.spawn)

		// Store callbacks so we can invoke them
		let dataCallback: any = null
		let closeCallback: any = null

		const mockProcess = {
			stdout: {
				on: vi.fn((event: string, callback: any) => {
					if (event === "data") {
						dataCallback = callback
					}
				}),
				pause: vi.fn(),
				resume: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event: string, callback: any) => {
				if (event === "close") {
					closeCallback = callback
				}
			}),
			kill: vi.fn(),
		}

		mockSpawn.mockReturnValue(mockProcess as any)

		// Mock directory listing for .roo/temp
		const mockReaddir = vi.fn()
		vi.mocked(fs.promises).readdir = mockReaddir
		mockReaddir.mockResolvedValueOnce([{ name: "22", isDirectory: () => true, isSymbolicLink: () => false }])

		// Call listFiles targeting .roo/temp (which is both hidden and in DIRS_TO_IGNORE)
		const gen = listFiles("/test/.roo/temp", true, 100)
		const files: string[] = []

		// Consume the generator in the background
		const consumePromise = (async () => {
			for await (const file of gen) {
				files.push(file)
			}
		})()

		// Wait a bit for the generator to start
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate files that should be found in .roo/temp
		// Note: ripgrep returns relative paths
		dataCallback?.("teste1.md\n")
		dataCallback?.("22/test2.md\n")

		// Wait a bit for the data to be processed
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate process closing
		closeCallback?.(0)

		// Wait for the generator to complete
		await consumePromise

		// Verify ripgrep was called with correct arguments
		const [rgPath, args] = mockSpawn.mock.calls[0]
		expect(args).toContain("--no-ignore-vcs")
		expect(args).toContain("--no-ignore")

		// Check for the inclusion patterns that should be added
		expect(args).toContain("-g")
		const gIndex = args.indexOf("-g")
		expect(args[gIndex + 1]).toBe("*")

		// Verify that both top-level and nested files are included
		const fileNames = files.map((f) => path.basename(f))
		expect(fileNames).toContain("teste1.md")
		expect(fileNames).toContain("test2.md")

		// Ensure the top-level file is actually included
		const topLevelFile = files.find((f) => f.endsWith("teste1.md"))
		expect(topLevelFile).toBeTruthy()
	}, 30000) // Increase timeout to 30s
})

describe("buildRecursiveArgs edge cases", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should correctly detect hidden directories with trailing slashes", async () => {
		const mockSpawn = vi.mocked(childProcess.spawn)

		// Store callbacks so we can invoke them
		let dataCallback: any = null
		let closeCallback: any = null

		const mockProcess = {
			stdout: {
				on: vi.fn((event: string, callback: any) => {
					if (event === "data") {
						dataCallback = callback
					}
				}),
				pause: vi.fn(),
				resume: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event: string, callback: any) => {
				if (event === "close") {
					closeCallback = callback
				}
			}),
			kill: vi.fn(),
		}
		mockSpawn.mockReturnValue(mockProcess as any)

		// Test with trailing slash on hidden directory - consume the generator
		const gen = listFiles("/test/.hidden/", true, 100)
		const results: string[] = []

		// Consume the generator in the background
		const consumePromise = (async () => {
			for await (const file of gen) {
				results.push(file)
			}
		})()

		// Wait a bit for the generator to start
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate ripgrep output
		dataCallback?.("file.txt\n")

		// Wait a bit for the data to be processed
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate process closing
		closeCallback?.(0)

		// Wait for the generator to complete
		await consumePromise

		const [rgPath, args] = mockSpawn.mock.calls[0]
		// When targeting a hidden directory, these flags should be present
		expect(args).toContain("--no-ignore-vcs")
		expect(args).toContain("--no-ignore")
		expect(args).toContain("-g")
		const gIndex = args.indexOf("-g")
		expect(args[gIndex + 1]).toBe("*")
	})

	it("should correctly detect hidden directories with redundant separators", async () => {
		const mockSpawn = vi.mocked(childProcess.spawn)

		// Store callbacks so we can invoke them
		let dataCallback: any = null
		let closeCallback: any = null

		const mockProcess = {
			stdout: {
				on: vi.fn((event: string, callback: any) => {
					if (event === "data") {
						dataCallback = callback
					}
				}),
				pause: vi.fn(),
				resume: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event: string, callback: any) => {
				if (event === "close") {
					closeCallback = callback
				}
			}),
			kill: vi.fn(),
		}
		mockSpawn.mockReturnValue(mockProcess as any)

		// Test with redundant separators before hidden directory - consume the generator
		const gen = listFiles("/test//.hidden", true, 100)
		const results: string[] = []

		// Consume the generator in the background
		const consumePromise = (async () => {
			for await (const file of gen) {
				results.push(file)
			}
		})()

		// Wait a bit for the generator to start
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate ripgrep output
		dataCallback?.("file.txt\n")

		// Wait a bit for the data to be processed
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate process closing
		closeCallback?.(0)

		// Wait for the generator to complete
		await consumePromise

		const [rgPath, args] = mockSpawn.mock.calls[0]
		// When targeting a hidden directory, these flags should be present
		expect(args).toContain("--no-ignore-vcs")
		expect(args).toContain("--no-ignore")
		expect(args).toContain("-g")
		const gIndex = args.indexOf("-g")
		expect(args[gIndex + 1]).toBe("*")
	})

	it("should correctly detect nested hidden directories with mixed separators", async () => {
		const mockSpawn = vi.mocked(childProcess.spawn)

		// Store callbacks so we can invoke them
		let dataCallback: any = null
		let closeCallback: any = null

		const mockProcess = {
			stdout: {
				on: vi.fn((event: string, callback: any) => {
					if (event === "data") {
						dataCallback = callback
					}
				}),
				pause: vi.fn(),
				resume: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event: string, callback: any) => {
				if (event === "close") {
					closeCallback = callback
				}
			}),
			kill: vi.fn(),
		}
		mockSpawn.mockReturnValue(mockProcess as any)

		// Test with complex path including hidden directory - consume the generator
		const gen = listFiles("/test//normal/.hidden//subdir/", true, 100)
		const results: string[] = []

		// Consume the generator in the background
		const consumePromise = (async () => {
			for await (const file of gen) {
				results.push(file)
			}
		})()

		// Wait a bit for the generator to start
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate ripgrep output
		dataCallback?.("file.txt\n")

		// Wait a bit for the data to be processed
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate process closing
		closeCallback?.(0)

		// Wait for the generator to complete
		await consumePromise

		const [rgPath, args] = mockSpawn.mock.calls[0]
		// When targeting a path containing a hidden directory, these flags should be present
		expect(args).toContain("--no-ignore-vcs")
		expect(args).toContain("--no-ignore")
		expect(args).toContain("-g")
		const gIndex = args.indexOf("-g")
		expect(args[gIndex + 1]).toBe("*")
	})

	it("should not detect hidden directories when path only has dots in filenames", async () => {
		const mockSpawn = vi.mocked(childProcess.spawn)

		// Store callbacks so we can invoke them
		let dataCallback: any = null
		let closeCallback: any = null

		const mockProcess = {
			stdout: {
				on: vi.fn((event: string, callback: any) => {
					if (event === "data") {
						dataCallback = callback
					}
				}),
				pause: vi.fn(),
				resume: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event: string, callback: any) => {
				if (event === "close") {
					closeCallback = callback
				}
			}),
			kill: vi.fn(),
		}
		mockSpawn.mockReturnValue(mockProcess as any)

		// Test with a path that has dots but no hidden directories - consume the generator
		const gen = listFiles("/test/file.with.dots/normal", true, 100)
		const results: string[] = []

		// Consume the generator in the background
		const consumePromise = (async () => {
			for await (const file of gen) {
				results.push(file)
			}
		})()

		// Wait a bit for the generator to start
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate ripgrep output
		dataCallback?.("file.txt\n")

		// Wait a bit for the data to be processed
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Simulate process closing
		closeCallback?.(0)

		// Wait for the generator to complete
		await consumePromise

		const [rgPath, args] = mockSpawn.mock.calls[0]
		// Should NOT have the special flags for hidden directories
		expect(args).not.toContain("--no-ignore-vcs")
		expect(args).not.toContain("--no-ignore")
	})
})
