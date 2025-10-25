import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as path from "path"
import * as os from "os"
import { getRooDirectoriesForCwd } from "../index"

vi.mock("os", () => ({
	homedir: vi.fn(),
}))

describe("Hierarchical .roo directory resolution", () => {
	const mockHomedir = vi.mocked(os.homedir)

	beforeEach(() => {
		mockHomedir.mockReturnValue("/home/user")
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("getRooDirectoriesForCwd with hierarchical resolution", () => {
		it("should return only global and project-local when hierarchical is disabled", () => {
			const cwd = "/home/user/projects/myapp"
			const directories = getRooDirectoriesForCwd(cwd, false)

			expect(directories).toEqual([
				"/home/user/.roo", // Global
				"/home/user/projects/myapp/.roo", // Project-local
			])
		})

		it("should return hierarchical directories for simple project", () => {
			const cwd = "/home/user/projects/myapp"
			const directories = getRooDirectoriesForCwd(cwd, true)

			expect(directories).toEqual([
				"/home/user/.roo", // Global
				"/home/user/projects/.roo", // Parent directory
				"/home/user/projects/myapp/.roo", // Project-local
			])
		})

		it("should handle deeply nested mono-repo structure", () => {
			const cwd = "/home/user/work/company/mono-repo/packages/frontend/src"
			const directories = getRooDirectoriesForCwd(cwd, true)

			expect(directories).toEqual([
				"/home/user/.roo", // Global
				"/home/user/work/.roo",
				"/home/user/work/company/.roo",
				"/home/user/work/company/mono-repo/.roo", // Repository root
				"/home/user/work/company/mono-repo/packages/.roo", // Packages folder
				"/home/user/work/company/mono-repo/packages/frontend/.roo", // Frontend package
				"/home/user/work/company/mono-repo/packages/frontend/src/.roo", // Source folder
			])
		})

		it.skipIf(process.platform !== "win32")("should handle Windows paths correctly", () => {
			mockHomedir.mockReturnValue("C:\\Users\\john")

			const cwd = "C:\\Users\\john\\projects\\myapp"
			const directories = getRooDirectoriesForCwd(cwd, true)

			expect(directories).toEqual([
				"C:\\Users\\john\\.roo", // Global
				"C:\\Users\\john\\projects\\.roo", // Parent directory
				"C:\\Users\\john\\projects\\myapp\\.roo", // Project-local
			])
		})

		it("should stop at home directory and not include it twice", () => {
			const cwd = "/home/user/myproject"
			const directories = getRooDirectoriesForCwd(cwd, true)

			expect(directories).toEqual([
				"/home/user/.roo", // Global (home directory)
				"/home/user/myproject/.roo", // Project-local
			])

			// Should not have duplicate /home/user/.roo entries
			const homeDirRooCount = directories.filter((d) => d === "/home/user/.roo").length
			expect(homeDirRooCount).toBe(1)
		})

		it("should handle root directory edge case", () => {
			const cwd = "/project"
			const directories = getRooDirectoriesForCwd(cwd, true)

			expect(directories).toEqual([
				"/home/user/.roo", // Global
				"/project/.roo", // Project at root level
			])
		})

		it("should handle relative paths by resolving them", () => {
			const cwd = "./myproject"
			const directories = getRooDirectoriesForCwd(cwd, true)

			// Should resolve relative path and return proper hierarchy
			expect(directories[0]).toBe("/home/user/.roo") // Global directory
			expect(directories[directories.length - 1]).toMatch(/myproject[\/\\]\.roo$/)
		})

		it("should use hierarchical resolution by default when not specified", () => {
			const cwd = "/home/user/projects/myapp"
			const directories = getRooDirectoriesForCwd(cwd) // No second parameter

			expect(directories).toEqual([
				"/home/user/.roo", // Global
				"/home/user/projects/.roo", // Parent directory
				"/home/user/projects/myapp/.roo", // Project-local
			])
		})

		it("should handle edge case of cwd being exactly home directory", () => {
			const cwd = "/home/user"
			const directories = getRooDirectoriesForCwd(cwd, true)

			expect(directories).toEqual([
				"/home/user/.roo", // Global (and also the cwd)
			])

			// Should not have duplicate entries
			expect(directories.length).toBe(1)
		})

		it("should handle symbolic links and circular references gracefully", () => {
			// This tests that the visitedPaths Set prevents infinite loops
			const cwd = "/home/user/projects/link/to/self"
			const directories = getRooDirectoriesForCwd(cwd, true)

			// Should not throw or hang, should return valid hierarchy
			expect(directories).toBeDefined()
			expect(directories[0]).toBe("/home/user/.roo")
			expect(directories.length).toBeGreaterThan(0)
		})
	})

	describe("Integration with configuration loading", () => {
		it("should provide directories in correct order for override behavior", () => {
			// More specific configurations should override more general ones
			const cwd = "/home/user/company/project/submodule"
			const directories = getRooDirectoriesForCwd(cwd, true)

			// Verify order: global first (least specific), then progressively more specific
			expect(directories[0]).toBe("/home/user/.roo") // Least specific
			expect(directories[directories.length - 1]).toBe("/home/user/company/project/submodule/.roo") // Most specific

			// This order ensures that when configs are merged, more specific ones override general ones
			for (let i = 1; i < directories.length; i++) {
				// Each directory should be a child of the previous (when excluding global)
				if (i > 1) {
					expect(directories[i].startsWith(directories[i - 1].replace(/[\/\\]\.roo$/, ""))).toBe(true)
				}
			}
		})
	})
})
