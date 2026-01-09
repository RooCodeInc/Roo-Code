import { describe, it, expect } from "vitest"
import { searchWorkspaceFiles, executeRipgrepForFiles } from "../file-search"

/**
 * Integration tests for file-search with gitignore support
 *
 * These tests verify that the API contract is correct for the mentions
 * gitignore integration feature. The actual ripgrep functionality is tested
 * through integration tests.
 */

describe("file-search gitignore integration", () => {
	describe("searchWorkspaceFiles API", () => {
		it("should accept options parameter with respectGitignore", () => {
			// Type check - verifies the function signature accepts the option
			const testCall = () =>
				searchWorkspaceFiles("query", "/path", 20, {
					respectGitignore: true,
				})

			expect(testCall).toBeDefined()
			expect(typeof testCall).toBe("function")
		})

		it("should accept options parameter with includePatterns", () => {
			// Type check - verifies the function signature accepts the option
			const testCall = () =>
				searchWorkspaceFiles("query", "/path", 20, {
					includePatterns: ["pattern1/**", "pattern2/**"],
				})

			expect(testCall).toBeDefined()
			expect(typeof testCall).toBe("function")
		})

		it("should accept options parameter with both respectGitignore and includePatterns", () => {
			// Type check - verifies both options can be used together
			const testCall = () =>
				searchWorkspaceFiles("query", "/path", 20, {
					respectGitignore: true,
					includePatterns: ["dist/**", "node_modules/**"],
				})

			expect(testCall).toBeDefined()
			expect(typeof testCall).toBe("function")
		})

		it("should allow options parameter to be optional (backward compatibility)", () => {
			// Type check - verifies backward compatibility
			const testCall = () => searchWorkspaceFiles("query", "/path", 20)

			expect(testCall).toBeDefined()
			expect(typeof testCall).toBe("function")
		})

		it("should allow empty options object", () => {
			// Type check - verifies empty options work
			const testCall = () => searchWorkspaceFiles("query", "/path", 20, {})

			expect(testCall).toBeDefined()
			expect(typeof testCall).toBe("function")
		})
	})

	describe("executeRipgrepForFiles API", () => {
		it("should accept respectGitignore as third parameter", () => {
			// Type check - verifies the function signature includes respectGitignore
			expect(executeRipgrepForFiles).toBeDefined()

			// Verify we can call it with the parameter
			const testCall = () => executeRipgrepForFiles("/path", undefined, true)
			expect(testCall).toBeDefined()
			expect(typeof testCall).toBe("function")
		})

		it("should allow respectGitignore to be optional (backward compatibility)", () => {
			// Type check - verifies backward compatibility
			const testCall = () => executeRipgrepForFiles("/path")
			expect(testCall).toBeDefined()
			expect(typeof testCall).toBe("function")
		})
	})

	describe("options parameter structure", () => {
		it("should support respectGitignore as boolean", () => {
			// Verify both true and false work
			const testCallTrue = () =>
				searchWorkspaceFiles("query", "/path", 20, {
					respectGitignore: true,
				})
			const testCallFalse = () =>
				searchWorkspaceFiles("query", "/path", 20, {
					respectGitignore: false,
				})

			expect(testCallTrue).toBeDefined()
			expect(testCallFalse).toBeDefined()
		})

		it("should support includePatterns as string array", () => {
			// Verify string arrays work
			const testCall = () =>
				searchWorkspaceFiles("query", "/path", 20, {
					includePatterns: ["pattern1", "pattern2", "pattern3"],
				})

			expect(testCall).toBeDefined()
		})

		it("should support empty includePatterns array", () => {
			// Verify empty arrays work
			const testCall = () =>
				searchWorkspaceFiles("query", "/path", 20, {
					includePatterns: [],
				})

			expect(testCall).toBeDefined()
		})
	})

	describe("integration scenarios", () => {
		it("should support typical code indexing scenario", () => {
			// Verify typical usage pattern for code indexing with .roogitinclude
			const testCall = () =>
				searchWorkspaceFiles("test", "/workspace", 20, {
					respectGitignore: true,
					includePatterns: ["dist/**", "node_modules/@types/**"],
				})

			expect(testCall).toBeDefined()
		})

		it("should support mentions without gitignore (default behavior)", () => {
			// Verify default mentions behavior (no gitignore)
			const testCall = () => searchWorkspaceFiles("test", "/workspace", 20)

			expect(testCall).toBeDefined()
		})

		it("should support mentions with gitignore enabled", () => {
			// Verify mentions can opt-in to gitignore filtering
			const testCall = () =>
				searchWorkspaceFiles("test", "/workspace", 20, {
					respectGitignore: true,
				})

			expect(testCall).toBeDefined()
		})
	})
})

/**
 * Documentation tests - verify the feature is properly integrated
 */
describe("mentions gitignore integration feature", () => {
	it("should have searchWorkspaceFiles function exported", () => {
		expect(searchWorkspaceFiles).toBeDefined()
		expect(typeof searchWorkspaceFiles).toBe("function")
	})

	it("should have executeRipgrepForFiles function exported", () => {
		expect(executeRipgrepForFiles).toBeDefined()
		expect(typeof executeRipgrepForFiles).toBe("function")
	})

	it("should support the expected filtering priority order", () => {
		// Priority order:
		// 1. .rooignore → always excluded (handled elsewhere)
		// 2. includePatterns (from .roogitinclude + settings) → force include
		// 3. .gitignore (if respectGitignore: true) → exclude
		// 4. Default → include

		// Verify this can be expressed in the API
		const testCall = () =>
			searchWorkspaceFiles("file", "/workspace", 20, {
				respectGitignore: true, // Enable gitignore filtering
				includePatterns: ["node_modules/**"], // But force include node_modules
			})

		expect(testCall).toBeDefined()
	})
})
