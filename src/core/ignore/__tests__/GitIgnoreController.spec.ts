// npx vitest core/ignore/__tests__/GitIgnoreController.spec.ts

import type { Mock } from "vitest"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import path from "path"
import * as vscode from "vscode"
import { GitIgnoreController } from "../GitIgnoreController"
import { fileExistsAtPath } from "../../../utils/fs"
import * as fs from "fs/promises"
import * as fsSync from "fs"

// Mock dependencies
vi.mock("fs/promises")
vi.mock("fs")
vi.mock("../../../utils/fs")

// Mock vscode
vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }

	return {
		workspace: {
			createFileSystemWatcher: vi.fn(() => ({
				onDidCreate: vi.fn(() => mockDisposable),
				onDidChange: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				dispose: vi.fn(),
			})),
		},
		RelativePattern: vi.fn().mockImplementation((base, pattern) => ({
			base,
			pattern,
		})),
	}
})

describe("GitIgnoreController", () => {
	const TEST_CWD = "/test/path"
	let controller: GitIgnoreController
	let mockFileExists: Mock<typeof fileExistsAtPath>
	let mockReadFile: Mock<typeof fs.readFile>
	let mockWatcher: any

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Setup mock file watcher
		mockWatcher = {
			onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			dispose: vi.fn(),
		}

		// @ts-expect-error - Mocking
		vscode.workspace.createFileSystemWatcher.mockReturnValue(mockWatcher)

		// Setup fs mocks (exactly like RooIgnoreController)
		mockFileExists = fileExistsAtPath as Mock<typeof fileExistsAtPath>
		mockReadFile = fs.readFile as Mock<typeof fs.readFile>

		// Setup fsSync mocks with default behavior (return path as-is, like regular files)
		const mockRealpathSync = vi.mocked(fsSync.realpathSync)
		mockRealpathSync.mockImplementation((filePath: any) => filePath.toString())

		// Create controller
		controller = new GitIgnoreController(TEST_CWD)
	})

	afterEach(() => {
		if (controller) {
			controller.dispose()
		}
	})

	describe("initialization", () => {
		it("should initialize without .gitignore files", async () => {
			// Setup mocks to simulate no .gitignore files
			mockFileExists.mockResolvedValue(false)

			await controller.initialize()

			// Should allow all access when no .gitignore files exist
			expect(controller.validateAccess("any/file.ts")).toBe(true)
			expect(controller.hasGitignoreFiles()).toBe(false)
		})

		it("should discover and load root .gitignore file", async () => {
			// Setup mocks to simulate root .gitignore file
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(filePath === path.join(TEST_CWD, ".gitignore"))
			})
			mockReadFile.mockResolvedValue("node_modules/\n*.log\n")

			await controller.initialize()

			// Verify file was discovered
			expect(controller.hasGitignoreFiles()).toBe(true)
			expect(controller.getGitignoreFiles()).toContain(path.join(TEST_CWD, ".gitignore"))

			// Verify patterns are applied
			expect(controller.validateAccess("node_modules/package.json")).toBe(false)
			expect(controller.validateAccess("debug.log")).toBe(false)
			expect(controller.validateAccess("src/index.ts")).toBe(true)
		})
	})

	describe("validateAccess", () => {
		beforeEach(async () => {
			// Setup a basic .gitignore for testing
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(filePath === path.join(TEST_CWD, ".gitignore"))
			})
			mockReadFile.mockResolvedValue("node_modules/\n*.log\n/build\n")

			await controller.initialize()
		})

		it("should block files matching .gitignore patterns", () => {
			expect(controller.validateAccess("node_modules/package.json")).toBe(false)
			expect(controller.validateAccess("debug.log")).toBe(false)
			expect(controller.validateAccess("build")).toBe(false)
		})

		it("should allow files not matching .gitignore patterns", () => {
			expect(controller.validateAccess("src/index.ts")).toBe(true)
			expect(controller.validateAccess("README.md")).toBe(true)
			expect(controller.validateAccess("package.json")).toBe(true)
		})

		it("should allow all access when no .gitignore files exist", async () => {
			// Create a new controller with no .gitignore
			mockFileExists.mockResolvedValue(false)
			const emptyController = new GitIgnoreController(TEST_CWD)
			await emptyController.initialize()

			expect(emptyController.validateAccess("node_modules/package.json")).toBe(true)
			expect(emptyController.validateAccess("debug.log")).toBe(true)
			expect(emptyController.validateAccess("any/file.ts")).toBe(true)

			emptyController.dispose()
		})

		it("should discover and load nested .gitignore files", async () => {
			// Setup mocks to simulate both root and nested .gitignore files
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(
					filePath === path.join(TEST_CWD, ".gitignore") ||
						filePath === path.join(TEST_CWD, "src", ".gitignore"),
				)
			})

			// Mock different content for each file
			mockReadFile.mockImplementation((filePath: any) => {
				// Normalize path separators for cross-platform compatibility
				const normalizedPath = filePath.toString().replace(/\\/g, "/")
				if (normalizedPath.endsWith("src/.gitignore")) {
					return Promise.resolve("*.tmp\n")
				}
				return Promise.resolve("node_modules/\n*.log\n")
			})

			await controller.initialize()

			// Verify both files were discovered
			expect(controller.hasGitignoreFiles()).toBe(true)
			const gitignoreFiles = controller.getGitignoreFiles()
			expect(gitignoreFiles).toContain(path.join(TEST_CWD, ".gitignore"))
			expect(gitignoreFiles).toContain(path.join(TEST_CWD, "src", ".gitignore"))

			// Verify patterns from both files are applied
			expect(controller.validateAccess("node_modules/package.json")).toBe(false) // Root .gitignore
			expect(controller.validateAccess("debug.log")).toBe(false) // Root .gitignore
			expect(controller.validateAccess("src/temp.tmp")).toBe(false) // Nested .gitignore
			expect(controller.validateAccess("src/index.ts")).toBe(true) // Should be allowed
		})

		it("should filter deeply nested files from nested .gitignore patterns", async () => {
			// Setup mocks to simulate nested .gitignore file
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(
					filePath === path.join(TEST_CWD, ".gitignore") ||
						filePath === path.join(TEST_CWD, "src", ".gitignore"),
				)
			})

			// Mock different content for each file
			mockReadFile.mockImplementation((filePath: any) => {
				// Normalize path separators for cross-platform compatibility
				const normalizedPath = filePath.toString().replace(/\\/g, "/")
				if (normalizedPath.endsWith("src/.gitignore")) {
					// Pattern that should match files at any depth within src/
					return Promise.resolve("*.tmp\n*.cache\n")
				}
				return Promise.resolve("node_modules/\n")
			})

			await controller.initialize()

			// Test direct children of src/
			expect(controller.validateAccess("src/temp.tmp")).toBe(false)
			expect(controller.validateAccess("src/data.cache")).toBe(false)

			// Test deeply nested files (2 levels deep)
			expect(controller.validateAccess("src/utils/temp.tmp")).toBe(false)
			expect(controller.validateAccess("src/components/data.cache")).toBe(false)

			// Test very deeply nested files (3+ levels deep)
			expect(controller.validateAccess("src/utils/helpers/temp.tmp")).toBe(false)
			expect(controller.validateAccess("src/components/ui/buttons/data.cache")).toBe(false)

			// Test that non-matching files are allowed at all depths
			expect(controller.validateAccess("src/index.ts")).toBe(true)
			expect(controller.validateAccess("src/utils/helper.ts")).toBe(true)
			expect(controller.validateAccess("src/components/ui/Button.tsx")).toBe(true)

			// Test that patterns don't leak outside src/
			expect(controller.validateAccess("temp.tmp")).toBe(true)
			expect(controller.validateAccess("lib/temp.tmp")).toBe(true)
			expect(controller.validateAccess("test/data.cache")).toBe(true)
		})
	})

	describe("filterPaths", () => {
		beforeEach(async () => {
			// Setup .gitignore patterns
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(filePath === path.join(TEST_CWD, ".gitignore"))
			})
			mockReadFile.mockResolvedValue("*.log\nnode_modules/\n")

			await controller.initialize()
		})

		it("should filter out ignored paths", () => {
			const paths = ["src/index.ts", "debug.log", "node_modules/package.json", "README.md", "error.log"]

			const filtered = controller.filterPaths(paths)

			expect(filtered).toEqual(["src/index.ts", "README.md"])
		})

		it("should return all paths when no .gitignore exists", async () => {
			// Create controller with no .gitignore
			mockFileExists.mockResolvedValue(false)
			const emptyController = new GitIgnoreController(TEST_CWD)
			await emptyController.initialize()

			const paths = ["src/index.ts", "debug.log", "node_modules/package.json"]
			const filtered = emptyController.filterPaths(paths)

			expect(filtered).toEqual(paths)

			emptyController.dispose()
		})
	})

	describe("utility methods", () => {
		it("should return gitignore file paths", async () => {
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(filePath === path.join(TEST_CWD, ".gitignore"))
			})
			mockReadFile.mockResolvedValue("*.log\n")

			await controller.initialize()

			const files = controller.getGitignoreFiles()
			expect(files).toContain(path.join(TEST_CWD, ".gitignore"))
		})

		it("should return gitignore content", async () => {
			const content = "*.log\nnode_modules/\n"
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(filePath === path.join(TEST_CWD, ".gitignore"))
			})
			mockReadFile.mockResolvedValue(content)

			await controller.initialize()

			const gitignoreFile = path.join(TEST_CWD, ".gitignore")
			expect(controller.getGitignoreContent(gitignoreFile)).toBe(content)
		})
	})

	describe("escaped literals", () => {
		it("should treat \\# as a literal # pattern, not a comment", async () => {
			// Setup .gitignore with escaped # pattern
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(filePath === path.join(TEST_CWD, ".gitignore"))
			})
			// \#foo should match a file literally named "#foo"
			// Also include a real comment to verify it's ignored
			mockReadFile.mockResolvedValue("\\#foo\n# This is a comment\n*.log\n")

			await controller.initialize()

			// File named "#foo" should be blocked (pattern matches literal #)
			expect(controller.validateAccess("#foo")).toBe(false)

			// File named "# This is a comment" should NOT be blocked (it was a comment line)
			expect(controller.validateAccess("# This is a comment")).toBe(true)

			// Other files should follow normal patterns
			expect(controller.validateAccess("test.log")).toBe(false)
			expect(controller.validateAccess("src/index.ts")).toBe(true)
		})
		it("should treat \\# as a literal # pattern in nested .gitignore (exposes bug in line 136)", async () => {
			// This test exposes the bug in line 136 of GitIgnoreController.ts
			// where !line.startsWith("#") incorrectly filters out \# patterns
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(
					filePath === path.join(TEST_CWD, ".gitignore") ||
						filePath === path.join(TEST_CWD, "src", ".gitignore"),
				)
			})

			mockReadFile.mockImplementation((filePath: any) => {
				const normalizedPath = filePath.toString().replace(/\\/g, "/")
				if (normalizedPath.endsWith("src/.gitignore")) {
					// Escaped # should match literal # file
					return Promise.resolve("\\#special\n# Real comment\n")
				}
				return Promise.resolve("")
			})

			await controller.initialize()

			// File named "#special" in src/ should be blocked
			// BUG: This currently passes (file is allowed) because line 136 filters out \#special
			expect(controller.validateAccess("src/#special")).toBe(false)

			// Real comment should not create a pattern
			expect(controller.validateAccess("src/# Real comment")).toBe(true)
		})

		it("should treat \\! as a literal ! pattern, not a negation", async () => {
			// Setup .gitignore with escaped ! pattern
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(filePath === path.join(TEST_CWD, ".gitignore"))
			})
			// First ignore all .txt files, then \!keep.txt should match literal "!keep.txt"
			mockReadFile.mockResolvedValue("*.txt\n\\!keep.txt\n")

			await controller.initialize()

			// All .txt files should be blocked
			expect(controller.validateAccess("file.txt")).toBe(false)
			expect(controller.validateAccess("keep.txt")).toBe(false)

			// File literally named "!keep.txt" should also be blocked (not negated)
			expect(controller.validateAccess("!keep.txt")).toBe(false)

			// Non-.txt files should be allowed
			expect(controller.validateAccess("src/index.ts")).toBe(true)
		})

		it("should handle multiple escaped patterns in the same file", async () => {
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(filePath === path.join(TEST_CWD, ".gitignore"))
			})
			// Mix of escaped and normal patterns
			mockReadFile.mockResolvedValue("\\#comment-like\n\\!negation-like\n*.log\n")

			await controller.initialize()

			// Escaped patterns should match literal files
			expect(controller.validateAccess("#comment-like")).toBe(false)
			expect(controller.validateAccess("!negation-like")).toBe(false)

			// Normal patterns should work
			expect(controller.validateAccess("debug.log")).toBe(false)
			expect(controller.validateAccess("src/index.ts")).toBe(true)
		})

		it("should handle escaped patterns in nested .gitignore files", async () => {
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(
					filePath === path.join(TEST_CWD, ".gitignore") ||
						filePath === path.join(TEST_CWD, "src", ".gitignore"),
				)
			})

			mockReadFile.mockImplementation((filePath: any) => {
				const normalizedPath = filePath.toString().replace(/\\/g, "/")
				if (normalizedPath.endsWith("src/.gitignore")) {
					// Nested .gitignore with escaped patterns
					// Include a real comment to verify it's properly ignored
					return Promise.resolve("\\#special\n# This is a comment\n\\!important\n")
				}
				return Promise.resolve("*.log\n")
			})

			await controller.initialize()

			// Escaped patterns in nested .gitignore should match literal files in that directory
			expect(controller.validateAccess("src/#special")).toBe(false)
			expect(controller.validateAccess("src/!important")).toBe(false)

			// Real comment should not create a pattern
			expect(controller.validateAccess("src/# This is a comment")).toBe(true)

			// Should not affect files outside src/
			expect(controller.validateAccess("#special")).toBe(true)
			expect(controller.validateAccess("!important")).toBe(true)

			// Root patterns should still work
			expect(controller.validateAccess("debug.log")).toBe(false)
		})

		it("should not treat escaped \\! as negation in nested .gitignore", async () => {
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(
					filePath === path.join(TEST_CWD, ".gitignore") ||
						filePath === path.join(TEST_CWD, "src", ".gitignore"),
				)
			})

			mockReadFile.mockImplementation((filePath: any) => {
				const normalizedPath = filePath.toString().replace(/\\/g, "/")
				if (normalizedPath.endsWith("src/.gitignore")) {
					// First ignore all .txt, then try to use escaped ! (should NOT negate)
					return Promise.resolve("*.txt\n\\!keep.txt\n")
				}
				return Promise.resolve("")
			})

			await controller.initialize()

			// All .txt files in src/ should be blocked
			expect(controller.validateAccess("src/file.txt")).toBe(false)
			expect(controller.validateAccess("src/keep.txt")).toBe(false)

			// File literally named "!keep.txt" should also be blocked (not negated)
			expect(controller.validateAccess("src/!keep.txt")).toBe(false)

			// Non-.txt files should be allowed
			expect(controller.validateAccess("src/index.ts")).toBe(true)
		})

		it("should correctly distinguish between comments and escaped # patterns", async () => {
			mockFileExists.mockImplementation((filePath: string) => {
				return Promise.resolve(
					filePath === path.join(TEST_CWD, ".gitignore") ||
						filePath === path.join(TEST_CWD, "src", ".gitignore"),
				)
			})

			mockReadFile.mockImplementation((filePath: any) => {
				const normalizedPath = filePath.toString().replace(/\\/g, "/")
				if (normalizedPath.endsWith("src/.gitignore")) {
					// Mix of real comments and escaped # patterns
					return Promise.resolve("# This is a comment\n" + "\\#not-a-comment\n" + "*.tmp\n")
				}
				return Promise.resolve("# Root comment\n*.log\n")
			})

			await controller.initialize()

			// Escaped # pattern should match literal file
			expect(controller.validateAccess("src/#not-a-comment")).toBe(false)

			// Comments should not create patterns
			expect(controller.validateAccess("src/# This is a comment")).toBe(true)

			// Normal patterns should work
			expect(controller.validateAccess("src/file.tmp")).toBe(false)
			expect(controller.validateAccess("test.log")).toBe(false)
		})
	})
})
