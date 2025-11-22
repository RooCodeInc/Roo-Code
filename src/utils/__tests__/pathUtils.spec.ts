import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as path from "path"
import * as os from "os"
import { isPathInAllowedDirectories } from "../pathUtils"

// Mock os module
vi.mock("os")

describe("isPathInAllowedDirectories", () => {
	const originalPlatform = process.platform

	beforeEach(() => {
		// Default mock for os.homedir
		vi.mocked(os.homedir).mockReturnValue("/home/user")
	})

	afterEach(() => {
		vi.clearAllMocks()
		Object.defineProperty(process, "platform", { value: originalPlatform })
	})

	describe("basic path matching", () => {
		it("should return false when allowed directories list is empty", () => {
			expect(isPathInAllowedDirectories("/some/path/file.txt", [])).toBe(false)
		})

		it("should return false when allowed directories list is undefined", () => {
			expect(isPathInAllowedDirectories("/some/path/file.txt", undefined as unknown as string[])).toBe(false)
		})

		it("should match exact directory path", () => {
			const allowedDirs = ["/allowed/path"]
			expect(isPathInAllowedDirectories("/allowed/path/file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("/allowed/path/subdir/file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("/other/path/file.txt", allowedDirs)).toBe(false)
		})

		it("should handle trailing slashes correctly", () => {
			const allowedDirs = ["/allowed/path/"]
			expect(isPathInAllowedDirectories("/allowed/path/file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("/allowed/path/subdir/file.txt", allowedDirs)).toBe(true)
		})
	})

	describe("tilde expansion", () => {
		it("should expand ~ to home directory", () => {
			// os.homedir is mocked to return '/home/user'
			const allowedDirs = ["~/projects"]
			expect(isPathInAllowedDirectories("/home/user/projects/file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("/home/user/projects/subdir/file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("/home/other/projects/file.txt", allowedDirs)).toBe(false)
		})

		it("should handle ~ in the middle of path", () => {
			const allowedDirs = ["/path/with/~/in/middle"]
			expect(isPathInAllowedDirectories("/path/with/~/in/middle/file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("/path/with/~expanded/in/middle/file.txt", allowedDirs)).toBe(false)
		})
	})

	describe("gitignore-style wildcard patterns", () => {
		describe("asterisk (*) wildcard", () => {
			it("should match directories with * wildcard", () => {
				const allowedDirs = ["/usr/include/Qt*"]
				expect(isPathInAllowedDirectories("/usr/include/Qt/file.txt", allowedDirs)).toBe(true)
				expect(isPathInAllowedDirectories("/usr/include/QtCore/file.txt", allowedDirs)).toBe(true)
				expect(isPathInAllowedDirectories("/usr/include/QtWidgets/file.txt", allowedDirs)).toBe(true)
				expect(isPathInAllowedDirectories("/usr/include/Qt5/file.txt", allowedDirs)).toBe(true)
				expect(isPathInAllowedDirectories("/usr/include/GTK/file.txt", allowedDirs)).toBe(false)
			})

			it("should match with trailing /* pattern", () => {
				const allowedDirs = ["/usr/include/*"]
				expect(isPathInAllowedDirectories("/usr/include/Qt/file.txt", allowedDirs)).toBe(true)
				expect(isPathInAllowedDirectories("/usr/include/QtCore/file.txt", allowedDirs)).toBe(true)
				expect(isPathInAllowedDirectories("/usr/include/subdir/file.txt", allowedDirs)).toBe(true)
			})

			it("should match nested paths with ** pattern", () => {
				const allowedDirs = ["~/projects/**"]
				expect(isPathInAllowedDirectories("/home/user/projects/app1/src/file.txt", allowedDirs)).toBe(true)
				expect(isPathInAllowedDirectories("/home/user/projects/app2/lib/file.txt", allowedDirs)).toBe(true)
			})
		})

		describe("question mark (?) wildcard", () => {
			it("should match exactly one character", () => {
				const allowedDirs = ["/usr/include/Qt?"]
				expect(isPathInAllowedDirectories("/usr/include/Qt5/file.txt", allowedDirs)).toBe(true)
				expect(isPathInAllowedDirectories("/usr/include/Qt6/file.txt", allowedDirs)).toBe(true)
				expect(isPathInAllowedDirectories("/usr/include/Qt/file.txt", allowedDirs)).toBe(false)
				expect(isPathInAllowedDirectories("/usr/include/Qt10/file.txt", allowedDirs)).toBe(false)
			})
		})
	})

	describe("multiple allowed directories", () => {
		it("should match if any pattern matches", () => {
			const allowedDirs = ["/usr/include/Qt*", "~/projects/*", "/tmp/build*"]
			expect(isPathInAllowedDirectories("/usr/include/QtCore/file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("/home/user/projects/app/file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("/tmp/build123/file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("/other/path/file.txt", allowedDirs)).toBe(false)
		})
	})

	describe("path normalization", () => {
		it("should normalize paths before matching", () => {
			const allowedDirs = ["/allowed/path"]
			expect(isPathInAllowedDirectories("/allowed/path/../path/file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("/allowed/./path/file.txt", allowedDirs)).toBe(true)
		})
	})

	describe("platform-specific behavior", () => {
		it.skip("should handle Windows paths on Windows", () => {
			// Skipped: Windows-specific test that requires Windows platform
			Object.defineProperty(process, "platform", { value: "win32", configurable: true })
			vi.mocked(os.homedir).mockReturnValue("C:\\Users\\user")

			const allowedDirs = ["C:\\projects\\*"]
			expect(isPathInAllowedDirectories("C:\\projects\\app\\file.txt", allowedDirs)).toBe(true)
			expect(isPathInAllowedDirectories("C:\\other\\file.txt", allowedDirs)).toBe(false)
		})

		it.skip("should handle Windows home directory expansion", () => {
			// Skipped: Windows-specific test that requires Windows platform
			Object.defineProperty(process, "platform", { value: "win32", configurable: true })
			vi.mocked(os.homedir).mockReturnValue("C:\\Users\\user")

			const allowedDirs = ["~\\projects"]
			expect(isPathInAllowedDirectories("C:\\Users\\user\\projects\\file.txt", allowedDirs)).toBe(true)
		})
	})

	describe("edge cases", () => {
		it("should handle empty string path", () => {
			const allowedDirs = ["/allowed/path"]
			expect(isPathInAllowedDirectories("", allowedDirs)).toBe(false)
		})

		it("should handle root path", () => {
			const allowedDirs = ["/"]
			expect(isPathInAllowedDirectories("/any/file.txt", allowedDirs)).toBe(true)
		})

		it("should not match parent directories", () => {
			const allowedDirs = ["/allowed/path/subdir"]
			expect(isPathInAllowedDirectories("/allowed/path/file.txt", allowedDirs)).toBe(false)
			expect(isPathInAllowedDirectories("/allowed/file.txt", allowedDirs)).toBe(false)
		})

		it("should handle special characters in paths", () => {
			const allowedDirs = ["/path/with.dots/and[brackets]/and(parens)"]
			expect(isPathInAllowedDirectories("/path/with.dots/and[brackets]/and(parens)/file.txt", allowedDirs)).toBe(
				true,
			)
		})
	})
})
