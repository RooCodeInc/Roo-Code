// npx vitest core/ignore/__tests__/GitIgnoreController.security.spec.ts

import type { Mock } from "vitest"

import { GitIgnoreController } from "../GitIgnoreController"
import * as path from "path"
import * as fs from "fs/promises"
import * as fsSync from "fs"
import { fileExistsAtPath } from "../../../utils/fs"

// Mock dependencies
vi.mock("fs/promises")
vi.mock("fs")
vi.mock("../../../utils/fs")
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

describe("GitIgnoreController Security Tests", () => {
	const TEST_CWD = "/test/path"
	let controller: GitIgnoreController
	let mockFileExists: Mock<typeof fileExistsAtPath>
	let mockReadFile: Mock<typeof fs.readFile>

	beforeEach(async () => {
		// Reset mocks
		vi.clearAllMocks()

		// Setup mocks
		mockFileExists = fileExistsAtPath as Mock<typeof fileExistsAtPath>
		mockReadFile = fs.readFile as Mock<typeof fs.readFile>

		// Setup fsSync mocks with default behavior (return path as-is, like regular files)
		const mockRealpathSync = vi.mocked(fsSync.realpathSync)
		mockRealpathSync.mockImplementation((filePath: any) => filePath.toString())

		// By default, setup .gitignore to exist with some patterns
		mockFileExists.mockResolvedValue(true)
		mockReadFile.mockResolvedValue("node_modules/\n.git/\nsecrets/**\n*.log\nprivate/")

		// Create and initialize controller
		controller = new GitIgnoreController(TEST_CWD)
		await controller.initialize()
	})

	describe("Path traversal protection", () => {
		/**
		 * Tests protection against path traversal attacks
		 */
		it("should handle path traversal attempts", () => {
			// Test simple path
			expect(controller.validateAccess("secrets/keys.json")).toBe(false)

			// Attempt simple path traversal
			expect(controller.validateAccess("secrets/../secrets/keys.json")).toBe(false)

			// More complex traversal
			expect(controller.validateAccess("public/../secrets/keys.json")).toBe(false)

			// Deep traversal
			expect(controller.validateAccess("public/css/../../secrets/keys.json")).toBe(false)

			// Traversal with normalized path
			expect(controller.validateAccess(path.normalize("public/../secrets/keys.json"))).toBe(false)

			// Allowed files shouldn't be affected by traversal protection
			expect(controller.validateAccess("public/css/../../public/app.js")).toBe(true)
		})

		/**
		 * Tests absolute path handling
		 */
		it("should handle absolute paths correctly", () => {
			// Absolute path to ignored file within cwd
			const absolutePathToIgnored = path.join(TEST_CWD, "secrets/keys.json")
			expect(controller.validateAccess(absolutePathToIgnored)).toBe(false)

			// Absolute path to allowed file within cwd
			const absolutePathToAllowed = path.join(TEST_CWD, "src/app.js")
			expect(controller.validateAccess(absolutePathToAllowed)).toBe(true)

			// Absolute path outside cwd should be allowed
			expect(controller.validateAccess("/etc/hosts")).toBe(true)
			expect(controller.validateAccess("/var/log/system.log")).toBe(true)
		})

		/**
		 * Tests that paths outside cwd are allowed
		 */
		it("should allow paths outside the current working directory", () => {
			// Paths outside cwd should be allowed
			expect(controller.validateAccess("../outside-project/file.txt")).toBe(true)
			expect(controller.validateAccess("../../other-project/secrets/keys.json")).toBe(true)

			// Edge case: path that would be ignored if inside cwd
			expect(controller.validateAccess("/other/path/secrets/keys.json")).toBe(true)
		})
	})

	describe("Complex pattern handling", () => {
		/**
		 * Tests combinations of paths and patterns
		 */
		it("should correctly apply complex patterns to various paths", async () => {
			// Setup complex patterns
			mockReadFile.mockResolvedValue(`
# Node modules and logs
node_modules/
*.log

# Version control
.git/
.svn/

# Secrets and config
config/secrets/**
**/*secret*
**/password*.*

# Build artifacts
dist/
build/
        
# Comments and empty lines should be ignored
      `)

			// Reinitialize controller
			await controller.initialize()

			// Test standard ignored paths
			expect(controller.validateAccess("node_modules/package.json")).toBe(false)
			expect(controller.validateAccess("app.log")).toBe(false)
			expect(controller.validateAccess(".git/config")).toBe(false)

			// Test wildcards and double wildcards
			expect(controller.validateAccess("config/secrets/api-keys.json")).toBe(false)
			expect(controller.validateAccess("src/config/secret-keys.js")).toBe(false)
			expect(controller.validateAccess("lib/utils/password-manager.ts")).toBe(false)

			// Test build artifacts
			expect(controller.validateAccess("dist/main.js")).toBe(false)
			expect(controller.validateAccess("build/index.html")).toBe(false)

			// Test paths that should be allowed
			expect(controller.validateAccess("src/app.js")).toBe(true)
			expect(controller.validateAccess("README.md")).toBe(true)
		})

		/**
		 * Tests nested .gitignore files with different patterns
		 */
		it("should handle nested .gitignore files correctly", async () => {
			// Setup mocks for both root and nested .gitignore files
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
					return Promise.resolve("*.tmp\n*.cache\n")
				}
				return Promise.resolve("node_modules/\n*.log\n")
			})

			await controller.initialize()

			// Verify patterns from both files are applied
			expect(controller.validateAccess("node_modules/package.json")).toBe(false) // Root .gitignore
			expect(controller.validateAccess("debug.log")).toBe(false) // Root .gitignore
			expect(controller.validateAccess("src/temp.tmp")).toBe(false) // Nested .gitignore
			expect(controller.validateAccess("src/data.cache")).toBe(false) // Nested .gitignore
			expect(controller.validateAccess("src/index.ts")).toBe(true) // Should be allowed
		})
	})

	describe("filterPaths security", () => {
		/**
		 * Tests filtering paths for security
		 */
		it("should correctly filter mixed paths", () => {
			const paths = [
				"src/app.js", // allowed
				"node_modules/package.json", // ignored
				"README.md", // allowed
				"secrets/keys.json", // ignored
				".git/config", // ignored
				"app.log", // ignored
				"test/test.js", // allowed
			]

			const filtered = controller.filterPaths(paths)

			// Should only contain allowed paths
			expect(filtered).toEqual(["src/app.js", "README.md", "test/test.js"])

			// Length should match allowed files
			expect(filtered.length).toBe(3)
		})

		/**
		 * Tests error handling in filterPaths
		 */
		it("should fail closed (securely) when errors occur", () => {
			// Mock validateAccess to throw error
			vi.spyOn(controller, "validateAccess").mockImplementation(() => {
				throw new Error("Test error")
			})

			// Spy on console.error
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Even with mix of allowed/ignored paths, should return empty array on error
			const filtered = controller.filterPaths(["src/app.js", "node_modules/package.json"])

			// Should fail closed (return empty array)
			expect(filtered).toEqual([])

			// Should log error
			expect(consoleSpy).toHaveBeenCalledWith("Error filtering paths:", expect.any(Error))

			// Clean up
			consoleSpy.mockRestore()
		})
	})

	describe("Edge cases", () => {
		/**
		 * Tests unusual file paths
		 */
		it("should handle unusual file paths", () => {
			expect(controller.validateAccess(".node_modules_temp/file.js")).toBe(true) // Doesn't match node_modules/
			expect(controller.validateAccess("node_modules.bak/file.js")).toBe(true) // Doesn't match node_modules/
			expect(controller.validateAccess("not_secrets/file.json")).toBe(true) // Doesn't match secrets

			// Files with dots
			expect(controller.validateAccess("src/file.with.multiple.dots.js")).toBe(true)

			// Files with no extension
			expect(controller.validateAccess("bin/executable")).toBe(true)

			// Hidden files
			expect(controller.validateAccess(".env")).toBe(true) // Not ignored by default
		})

		/**
		 * Tests empty and malformed .gitignore files
		 */
		it("should handle empty and malformed .gitignore files", async () => {
			// Test empty .gitignore
			mockReadFile.mockResolvedValue("")
			await controller.initialize()

			// Should allow all files when .gitignore is empty
			expect(controller.validateAccess("any/file.txt")).toBe(true)

			// Test .gitignore with only comments and whitespace
			mockReadFile.mockResolvedValue("# This is a comment\n\n   \n# Another comment\n")
			await controller.initialize()

			// Should allow all files when .gitignore has no patterns
			expect(controller.validateAccess("any/file.txt")).toBe(true)
		})
	})
})
