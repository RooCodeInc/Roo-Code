import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { loadRoogitincludePatterns, matchesIncludePatterns } from "../list-files"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

describe("roogitinclude functionality", () => {
	let tempDir: string

	beforeEach(async () => {
		// Create a temporary directory for tests
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roogitinclude-test-"))
	})

	afterEach(async () => {
		// Clean up temporary directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	describe("loadRoogitincludePatterns", () => {
		it("should load patterns from .roogitinclude file", async () => {
			const roogitincludePath = path.join(tempDir, ".roogitinclude")
			await fs.writeFile(
				roogitincludePath,
				`# Comment line
generated/**
dist/types/**
!dist/types/excluded.ts

# Another comment
build/output.js`,
			)

			const patterns = await loadRoogitincludePatterns(tempDir)

			expect(patterns).toEqual(["generated/**", "dist/types/**", "!dist/types/excluded.ts", "build/output.js"])
		})

		it("should filter out empty lines", async () => {
			const roogitincludePath = path.join(tempDir, ".roogitinclude")
			await fs.writeFile(
				roogitincludePath,
				`generated/**

dist/types/**


build/output.js`,
			)

			const patterns = await loadRoogitincludePatterns(tempDir)

			expect(patterns).toEqual(["generated/**", "dist/types/**", "build/output.js"])
		})

		it("should filter out comment lines", async () => {
			const roogitincludePath = path.join(tempDir, ".roogitinclude")
			await fs.writeFile(
				roogitincludePath,
				`# This is a comment
generated/**
# Another comment
dist/types/**
## Double hash comment
build/output.js`,
			)

			const patterns = await loadRoogitincludePatterns(tempDir)

			expect(patterns).toEqual(["generated/**", "dist/types/**", "build/output.js"])
		})

		it("should trim whitespace from patterns", async () => {
			const roogitincludePath = path.join(tempDir, ".roogitinclude")
			await fs.writeFile(
				roogitincludePath,
				`  generated/**  
   dist/types/**
build/output.js   `,
			)

			const patterns = await loadRoogitincludePatterns(tempDir)

			expect(patterns).toEqual(["generated/**", "dist/types/**", "build/output.js"])
		})

		it("should return empty array when .roogitinclude does not exist", async () => {
			const patterns = await loadRoogitincludePatterns(tempDir)

			expect(patterns).toEqual([])
		})

		it("should return empty array when .roogitinclude cannot be read", async () => {
			const roogitincludePath = path.join(tempDir, ".roogitinclude")
			await fs.writeFile(roogitincludePath, "generated/**")
			// Make file unreadable (this might not work on all systems)
			try {
				await fs.chmod(roogitincludePath, 0o000)
			} catch (error) {
				// Skip this test if chmod fails (e.g., on Windows)
				return
			}

			const patterns = await loadRoogitincludePatterns(tempDir)

			expect(patterns).toEqual([])

			// Restore permissions for cleanup
			await fs.chmod(roogitincludePath, 0o644)
		})

		it("should handle empty .roogitinclude file", async () => {
			const roogitincludePath = path.join(tempDir, ".roogitinclude")
			await fs.writeFile(roogitincludePath, "")

			const patterns = await loadRoogitincludePatterns(tempDir)

			expect(patterns).toEqual([])
		})

		it("should handle .roogitinclude with only comments and empty lines", async () => {
			const roogitincludePath = path.join(tempDir, ".roogitinclude")
			await fs.writeFile(
				roogitincludePath,
				`# Comment only

# Another comment

`,
			)

			const patterns = await loadRoogitincludePatterns(tempDir)

			expect(patterns).toEqual([])
		})
	})

	describe("matchesIncludePatterns", () => {
		it("should return true when file matches a pattern", () => {
			const patterns = ["generated/**", "dist/types/**"]

			expect(matchesIncludePatterns("generated/file.ts", patterns)).toBe(true)
			expect(matchesIncludePatterns("generated/nested/file.ts", patterns)).toBe(true)
			expect(matchesIncludePatterns("dist/types/file.ts", patterns)).toBe(true)
		})

		it("should return false when file does not match any pattern", () => {
			const patterns = ["generated/**", "dist/types/**"]

			expect(matchesIncludePatterns("src/file.ts", patterns)).toBe(false)
			expect(matchesIncludePatterns("other/file.ts", patterns)).toBe(false)
		})

		it("should return false when patterns array is empty", () => {
			const patterns: string[] = []

			expect(matchesIncludePatterns("generated/file.ts", patterns)).toBe(false)
			expect(matchesIncludePatterns("any/file.ts", patterns)).toBe(false)
		})

		it("should handle single file patterns", () => {
			const patterns = ["specific-file.ts", "another.js"]

			expect(matchesIncludePatterns("specific-file.ts", patterns)).toBe(true)
			expect(matchesIncludePatterns("another.js", patterns)).toBe(true)
			expect(matchesIncludePatterns("other-file.ts", patterns)).toBe(false)
		})

		it("should handle wildcard patterns", () => {
			const patterns = ["*.generated.ts", "test-*.js"]

			expect(matchesIncludePatterns("types.generated.ts", patterns)).toBe(true)
			expect(matchesIncludePatterns("test-utils.js", patterns)).toBe(true)
			expect(matchesIncludePatterns("regular.ts", patterns)).toBe(false)
		})

		it("should handle nested path patterns", () => {
			const patterns = ["src/generated/**/*.ts", "dist/**/types/*"]

			expect(matchesIncludePatterns("src/generated/api/types.ts", patterns)).toBe(true)
			expect(matchesIncludePatterns("dist/esm/types/index.d.ts", patterns)).toBe(true)
			expect(matchesIncludePatterns("src/regular/file.ts", patterns)).toBe(false)
		})

		it("should handle negation patterns", () => {
			const patterns = ["generated/**", "!generated/excluded.ts"]

			expect(matchesIncludePatterns("generated/file.ts", patterns)).toBe(true)
			expect(matchesIncludePatterns("generated/excluded.ts", patterns)).toBe(false)
		})

		it("should be case-insensitive (ignore library default behavior)", () => {
			const patterns = ["Generated/**"]

			expect(matchesIncludePatterns("Generated/file.ts", patterns)).toBe(true)
			expect(matchesIncludePatterns("generated/file.ts", patterns)).toBe(true)
			expect(matchesIncludePatterns("GENERATED/file.ts", patterns)).toBe(true)
		})
	})

	describe("Priority order integration", () => {
		it("should document priority: .rooignore > .roogitinclude > .gitignore", () => {
			// This is a documentation test to ensure the priority order is clear
			// The actual priority implementation is tested in scanner and file-watcher tests
			const priorityOrder = {
				1: ".rooignore - always excluded (cannot be overridden)",
				2: ".roogitinclude + includePatterns setting - force include (overrides gitignore)",
				3: ".gitignore (if respectGitignore: true) - exclude",
				4: "default - include",
			}

			expect(priorityOrder[1]).toContain(".rooignore")
			expect(priorityOrder[2]).toContain(".roogitinclude")
			expect(priorityOrder[3]).toContain(".gitignore")
			expect(priorityOrder[4]).toBe("default - include")
		})
	})
})
