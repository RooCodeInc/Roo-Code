import * as path from "path"
import * as fs from "fs"
import * as os from "os"

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

// Mock child_process to simulate ripgrep behavior
vi.mock("child_process", () => ({
	spawn: vi.fn(),
}))

vi.mock("../../path", () => ({
	arePathsEqual: vi.fn().mockReturnValue(false),
}))

import { listFiles } from "../list-files"
import * as childProcess from "child_process"

describe("list-files gitignore recursion optimization", () => {
	let tempDir: string
	let originalCwd: string
	let mockSpawn: any

	beforeEach(async () => {
		vi.clearAllMocks()

		// Create a temporary directory for testing
		tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "roo-gitignore-optimization-test-"))
		originalCwd = process.cwd()

		// Setup mock spawn
		mockSpawn = vi.mocked(childProcess.spawn)
	})

	afterEach(async () => {
		process.chdir(originalCwd)
		// Clean up temp directory
		await fs.promises.rm(tempDir, { recursive: true, force: true })
	})

	it("should avoid recursing into directories ignored by question/* pattern", async () => {
		// Setup deep directory structure
		await fs.promises.mkdir(path.join(tempDir, "question"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "question", "a"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "question", "a", "deep1"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "question", "a", "deep2"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "question", "b"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "question", "b", "deep1"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "src"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "src", "components"), { recursive: true })

		// Create .gitignore file with question/* pattern
		await fs.promises.writeFile(path.join(tempDir, ".gitignore"), "question/*\n")

		// Create some files
		await fs.promises.writeFile(path.join(tempDir, "src", "index.ts"), "console.log('hello')")
		await fs.promises.writeFile(
			path.join(tempDir, "src", "components", "app.tsx"),
			"export default () => <div>App</div>",
		)
		await fs.promises.writeFile(path.join(tempDir, "question", "a", "file.txt"), "content in a")
		await fs.promises.writeFile(path.join(tempDir, "question", "a", "deep1", "deep.txt"), "deep content")
		await fs.promises.writeFile(path.join(tempDir, "question", "b", "file.txt"), "content in b")

		// Track ripgrep calls to verify optimization
		const ripgrepCalls: any[] = []
		mockSpawn.mockImplementation((rgPath: string, args: string[]) => {
			ripgrepCalls.push({ rgPath, args })

			// Mock process that returns only non-ignored files
			const mockProcess = {
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === "data") {
							// Only return src files, not question files
							const files =
								[path.join(tempDir, "src", "index.ts"), path.join(tempDir, "src", "components")].join(
									"\n",
								) + "\n"
							setTimeout(() => callback(files), 10)
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
				}),
				kill: vi.fn(),
			}
			return mockProcess
		})

		// Call listFiles in recursive mode
		const [files, didHitLimit] = await listFiles(tempDir, true, 100)

		// Filter out only directories from the results
		const directoriesInResult = files.filter((f) => f.endsWith("/"))

		// The optimization should prevent recursion into ignored directories
		// but the top-level ignored directories might still appear in the results
		// This is because listFiles first adds directories to results, then checks if it should recurse

		// Verify that allowed directories ARE included
		expect(directoriesInResult).toContain(path.join(tempDir, "src") + "/")
		expect(directoriesInResult).toContain(path.join(tempDir, "src", "components") + "/")

		// The key test: verify that ripgrep was called with minimal calls for question directory
		// This proves that our optimization is working at the recursion level
		const questionRipgrepCalls = ripgrepCalls.filter((call) =>
			call.args.some((arg: string) => arg.includes("question")),
		)

		// Should have minimal ripgrep calls for question directory due to optimization
		expect(questionRipgrepCalls.length).toBeLessThan(3) // Much fewer than would be without optimization

		// Additional check: verify that deep question subdirectories are not in the results
		// This confirms that recursion was prevented
		expect(directoriesInResult).not.toContain(path.join(tempDir, "question", "a", "deep1") + "/")
		expect(directoriesInResult).not.toContain(path.join(tempDir, "question", "a", "deep2") + "/")
		expect(directoriesInResult).not.toContain(path.join(tempDir, "question", "b", "deep1") + "/")
	})

	it("should avoid recursing into directories ignored by question/** pattern", async () => {
		// Setup deep directory structure
		await fs.promises.mkdir(path.join(tempDir, "question"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "question", "a"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "question", "a", "b"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "question", "a", "b", "c"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "src"), { recursive: true })

		// Create .gitignore file with question/** pattern
		await fs.promises.writeFile(path.join(tempDir, ".gitignore"), "question/**\n")

		// Create some files
		await fs.promises.writeFile(path.join(tempDir, "src", "index.ts"), "console.log('hello')")
		await fs.promises.writeFile(path.join(tempDir, "question", "a", "file.txt"), "content")

		// Track ripgrep calls
		const ripgrepCalls: any[] = []
		mockSpawn.mockImplementation((rgPath: string, args: string[]) => {
			ripgrepCalls.push({ rgPath, args })

			const mockProcess = {
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === "data") {
							// Only return src files
							const files = [path.join(tempDir, "src", "index.ts")].join("\n") + "\n"
							setTimeout(() => callback(files), 10)
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
				}),
				kill: vi.fn(),
			}
			return mockProcess
		})

		// Call listFiles in recursive mode
		const [files, didHitLimit] = await listFiles(tempDir, true, 100)

		// Filter out only directories from the results
		const directoriesInResult = files.filter((f) => f.endsWith("/"))

		// Verify that allowed directories ARE included
		expect(directoriesInResult).toContain(path.join(tempDir, "src") + "/")

		// Should have minimal ripgrep calls for question directory
		const questionRipgrepCalls = ripgrepCalls.filter((call) =>
			call.args.some((arg: any) => arg.includes("question")),
		)

		expect(questionRipgrepCalls.length).toBeLessThan(2)

		// Additional check: verify that deep question subdirectories are not in the results
		// This confirms that recursion was prevented
		expect(directoriesInResult).not.toContain(path.join(tempDir, "question", "a", "b") + "/")
		expect(directoriesInResult).not.toContain(path.join(tempDir, "question", "a", "b", "c") + "/")
	})

	it("should handle mixed ignore patterns correctly", async () => {
		// Setup directory structure
		await fs.promises.mkdir(path.join(tempDir, "question"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "question", "allowed"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "temp"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "temp", "subdir"), { recursive: true })
		await fs.promises.mkdir(path.join(tempDir, "src"), { recursive: true })

		// Create .gitignore file with mixed patterns
		await fs.promises.writeFile(path.join(tempDir, ".gitignore"), "question/*\ntemp/\n")

		// Create some files
		await fs.promises.writeFile(path.join(tempDir, "src", "index.ts"), "console.log('hello')")
		await fs.promises.writeFile(path.join(tempDir, "temp", "file.txt"), "temp content")

		// Track ripgrep calls
		const ripgrepCalls: any[] = []
		mockSpawn.mockImplementation((rgPath: string, args: string[]) => {
			ripgrepCalls.push({ rgPath, args })

			const mockProcess = {
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === "data") {
							// Only return src files
							const files = [path.join(tempDir, "src", "index.ts")].join("\n") + "\n"
							setTimeout(() => callback(files), 10)
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
				}),
				kill: vi.fn(),
			}
			return mockProcess
		})

		// Call listFiles in recursive mode
		const [files, didHitLimit] = await listFiles(tempDir, true, 100)

		// Filter out only directories from the results
		const directoriesInResult = files.filter((f) => f.endsWith("/"))

		// Verify that allowed directories ARE included
		expect(directoriesInResult).toContain(path.join(tempDir, "src") + "/")

		// Should have minimal ripgrep calls for both question and temp directories
		const ignoredRipgrepCalls = ripgrepCalls.filter((call) =>
			call.args.some((arg: any) => arg.includes("question") || arg.includes("temp")),
		)

		expect(ignoredRipgrepCalls.length).toBeLessThan(4)

		// Additional check: verify that deep subdirectories of ignored directories are not in the results
		// This confirms that recursion was prevented
		expect(directoriesInResult).not.toContain(path.join(tempDir, "question", "allowed") + "/")
		expect(directoriesInResult).not.toContain(path.join(tempDir, "temp", "subdir") + "/")
	})
})
