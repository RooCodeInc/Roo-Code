import { describe, it, expect } from "vitest"
import { isPathInIgnoredDirectory } from "../ignore-utils"

describe("isPathInIgnoredDirectory", () => {
	describe(".roo folder handling", () => {
		it("should NOT ignore files in .roo directory", () => {
			expect(isPathInIgnoredDirectory("/project/.roo/config.json")).toBe(false)
			expect(isPathInIgnoredDirectory("/project/.roo/modes/custom.md")).toBe(false)
			expect(isPathInIgnoredDirectory(".roo/rules/rules.md")).toBe(false)
		})

		it("should NOT ignore .roo directory itself", () => {
			expect(isPathInIgnoredDirectory("/project/.roo")).toBe(false)
			expect(isPathInIgnoredDirectory(".roo")).toBe(false)
		})

		it("should NOT ignore nested directories within .roo", () => {
			expect(isPathInIgnoredDirectory("/project/.roo/skills/skill-name/SKILL.md")).toBe(false)
			expect(isPathInIgnoredDirectory("/project/.roo/modes/")).toBe(false)
		})
	})

	describe("other hidden directories", () => {
		it("should ignore other hidden directories starting with dot", () => {
			expect(isPathInIgnoredDirectory("/project/.git/config")).toBe(true)
			expect(isPathInIgnoredDirectory("/project/.vscode/settings.json")).toBe(true)
			expect(isPathInIgnoredDirectory("/project/.github/workflows/ci.yml")).toBe(true)
			expect(isPathInIgnoredDirectory("/project/.husky/pre-commit")).toBe(true)
		})

		it("should ignore files in hidden directories", () => {
			expect(isPathInIgnoredDirectory(".hidden/file.txt")).toBe(true)
			expect(isPathInIgnoredDirectory("/some/path/.secret/data.json")).toBe(true)
		})
	})

	describe("standard ignored directories", () => {
		it("should ignore node_modules", () => {
			expect(isPathInIgnoredDirectory("/project/node_modules/package/index.js")).toBe(true)
			expect(isPathInIgnoredDirectory("node_modules/test/file.js")).toBe(true)
		})

		it("should ignore __pycache__", () => {
			expect(isPathInIgnoredDirectory("/project/__pycache__/module.pyc")).toBe(true)
		})

		it("should ignore common build directories", () => {
			expect(isPathInIgnoredDirectory("/project/dist/bundle.js")).toBe(true)
			expect(isPathInIgnoredDirectory("/project/out/main.js")).toBe(true)
			expect(isPathInIgnoredDirectory("/project/build/dependencies/lib.jar")).toBe(true)
		})

		it("should ignore temporary directories", () => {
			expect(isPathInIgnoredDirectory("/project/tmp/cache.txt")).toBe(true)
			expect(isPathInIgnoredDirectory("/project/temp/upload.bin")).toBe(true)
		})
	})

	describe("allowed directories and files", () => {
		it("should NOT ignore regular directories and files", () => {
			expect(isPathInIgnoredDirectory("/project/src/index.ts")).toBe(false)
			expect(isPathInIgnoredDirectory("/project/lib/utils.js")).toBe(false)
			expect(isPathInIgnoredDirectory("/project/README.md")).toBe(false)
		})

		it("should NOT ignore files with dots in their names", () => {
			expect(isPathInIgnoredDirectory("/project/file.with.dots.txt")).toBe(false)
			expect(isPathInIgnoredDirectory("/project/src/test.spec.ts")).toBe(false)
		})
	})

	describe("edge cases", () => {
		it("should handle paths with multiple separators", () => {
			expect(isPathInIgnoredDirectory("/project//.roo//config.json")).toBe(false)
			expect(isPathInIgnoredDirectory("/project//.git//config")).toBe(true)
		})

		it("should handle Windows-style paths", () => {
			expect(isPathInIgnoredDirectory("C:\\project\\.roo\\config.json")).toBe(false)
			expect(isPathInIgnoredDirectory("C:\\project\\.git\\config")).toBe(true)
			expect(isPathInIgnoredDirectory("C:\\project\\node_modules\\package\\index.js")).toBe(true)
		})

		it("should handle relative paths", () => {
			expect(isPathInIgnoredDirectory(".roo/config.json")).toBe(false)
			expect(isPathInIgnoredDirectory(".git/config")).toBe(true)
			expect(isPathInIgnoredDirectory("src/.roo/file.md")).toBe(false)
		})

		it("should handle root dot correctly", () => {
			// The "." itself should not be ignored
			expect(isPathInIgnoredDirectory(".")).toBe(false)
			expect(isPathInIgnoredDirectory("./file.txt")).toBe(false)
		})
	})

	describe("mixed scenarios", () => {
		it("should allow .roo even when nested in allowed directories", () => {
			expect(isPathInIgnoredDirectory("/project/workspace/.roo/modes/custom.md")).toBe(false)
		})

		it("should ignore hidden directories even when nested in allowed directories", () => {
			expect(isPathInIgnoredDirectory("/project/src/.hidden/secret.txt")).toBe(true)
		})

		it("should handle .roo-like names correctly", () => {
			// Only exact .roo should be exempted
			expect(isPathInIgnoredDirectory("/project/.roo-test/file.txt")).toBe(true)
			expect(isPathInIgnoredDirectory("/project/.roofolder/file.txt")).toBe(true)
		})
	})
})
