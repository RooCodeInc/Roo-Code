// npx vitest run src/services/checkpoints/__tests__/rooignore-support.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { getExcludePatterns } from "../excludes"

describe("Checkpoint .rooignore Support", () => {
	let tempDir: string

	beforeEach(async () => {
		// Create a temporary directory for testing
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "checkpoint-test-"))
	})

	afterEach(async () => {
		// Clean up temporary directory
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe("getExcludePatterns", () => {
		it("should include patterns from .rooignore file", async () => {
			// Create a .rooignore file with test patterns
			const rooIgnoreContent = `
# Test patterns
*.secret
private/
temp*.txt
!important.txt
			`.trim()

			await fs.writeFile(path.join(tempDir, ".rooignore"), rooIgnoreContent)

			// Get exclude patterns
			const patterns = await getExcludePatterns(tempDir)

			// Verify .rooignore patterns are included
			expect(patterns).toContain("*.secret")
			expect(patterns).toContain("private/")
			expect(patterns).toContain("temp*.txt")
			expect(patterns).toContain("!important.txt")
		})

		it("should filter out comments and empty lines from .rooignore", async () => {
			// Create a .rooignore file with comments and empty lines
			const rooIgnoreContent = `
# This is a comment
*.log

# Another comment
  # Indented comment
*.tmp
  
  
*.cache
			`.trim()

			await fs.writeFile(path.join(tempDir, ".rooignore"), rooIgnoreContent)

			// Get exclude patterns
			const patterns = await getExcludePatterns(tempDir)

			// Verify only actual patterns are included
			expect(patterns).toContain("*.log")
			expect(patterns).toContain("*.tmp")
			expect(patterns).toContain("*.cache")

			// Verify comments are not included
			expect(patterns).not.toContain("# This is a comment")
			expect(patterns).not.toContain("# Another comment")
			expect(patterns).not.toContain("# Indented comment")
		})

		it("should handle missing .rooignore file gracefully", async () => {
			// Don't create a .rooignore file

			// Get exclude patterns
			const patterns = await getExcludePatterns(tempDir)

			// Should still include default patterns
			expect(patterns).toContain(".git/")
			expect(patterns).toContain("node_modules/")
			expect(patterns).toContain("*.log")

			// Should not throw an error
			expect(patterns).toBeDefined()
			expect(Array.isArray(patterns)).toBe(true)
		})

		it("should handle .rooignore read errors gracefully", async () => {
			// Create a .rooignore file
			await fs.writeFile(path.join(tempDir, ".rooignore"), "*.test")

			// Mock fs.readFile to throw an error
			const originalReadFile = fs.readFile
			const readFileSpy = vi.spyOn(fs, "readFile").mockImplementation(async (filePath, encoding) => {
				if (filePath.toString().endsWith(".rooignore")) {
					throw new Error("Permission denied")
				}
				return originalReadFile(filePath as any, encoding as any)
			})

			// Mock console.error to suppress error output
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Get exclude patterns
			const patterns = await getExcludePatterns(tempDir)

			// Should still include default patterns
			expect(patterns).toContain(".git/")
			expect(patterns).toContain("node_modules/")

			// Verify error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error reading .rooignore for checkpoint excludes:",
				expect.any(Error),
			)

			// Restore mocks
			readFileSpy.mockRestore()
			consoleErrorSpy.mockRestore()
		})

		it("should combine .rooignore patterns with default patterns", async () => {
			// Create a .rooignore file
			const rooIgnoreContent = `
custom-folder/
*.custom
			`.trim()

			await fs.writeFile(path.join(tempDir, ".rooignore"), rooIgnoreContent)

			// Get exclude patterns
			const patterns = await getExcludePatterns(tempDir)

			// Should include both default and custom patterns
			expect(patterns).toContain(".git/")
			expect(patterns).toContain("node_modules/")
			expect(patterns).toContain("*.log")
			expect(patterns).toContain("custom-folder/")
			expect(patterns).toContain("*.custom")
		})

		it("should handle complex .rooignore patterns", async () => {
			// Create a .rooignore file with various pattern types
			const rooIgnoreContent = `
# Directories
build/
dist/
coverage/

# Files by extension
*.env
*.env.local
*.env.*.local

# Specific files
.DS_Store
Thumbs.db

# Negation patterns
!important.env

# Glob patterns
test-*.json
**/temp/**
src/**/generated/
			`.trim()

			await fs.writeFile(path.join(tempDir, ".rooignore"), rooIgnoreContent)

			// Get exclude patterns
			const patterns = await getExcludePatterns(tempDir)

			// Verify all pattern types are included
			expect(patterns).toContain("build/")
			expect(patterns).toContain("dist/")
			expect(patterns).toContain("coverage/")
			expect(patterns).toContain("*.env")
			expect(patterns).toContain("*.env.local")
			expect(patterns).toContain("*.env.*.local")
			expect(patterns).toContain(".DS_Store")
			expect(patterns).toContain("Thumbs.db")
			expect(patterns).toContain("!important.env")
			expect(patterns).toContain("test-*.json")
			expect(patterns).toContain("**/temp/**")
			expect(patterns).toContain("src/**/generated/")
		})
	})
})
