// npx vitest run tests/hooks/ScopeValidator.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { ScopeValidator } from "../../src/hooks/ScopeValidator.js"

describe("ScopeValidator", () => {
	let scopeValidator: ScopeValidator

	beforeEach(() => {
		scopeValidator = new ScopeValidator()
	})

	describe("matchesAnyPattern", () => {
		it("should match single segment wildcard pattern", () => {
			expect(scopeValidator.matchesAnyPattern("src/components/Button.tsx", ["src/components/*.tsx"])).toBe(true)
			expect(scopeValidator.matchesAnyPattern("src/utils/helpers.ts", ["src/components/*.tsx"])).toBe(false)
		})

		it("should match recursive wildcard pattern", () => {
			expect(
				scopeValidator.matchesAnyPattern("src/features/auth/components/Login.tsx", ["src/features/**"]),
			).toBe(true)
			expect(scopeValidator.matchesAnyPattern("src/utils/helpers.ts", ["src/features/**"])).toBe(false)
		})

		it("should match if any pattern matches", () => {
			const patterns = ["src/components/**", "src/utils/*.ts", "tests/**"]
			expect(scopeValidator.matchesAnyPattern("src/components/Button.tsx", patterns)).toBe(true)
			expect(scopeValidator.matchesAnyPattern("src/utils/helpers.ts", patterns)).toBe(true)
			expect(scopeValidator.matchesAnyPattern("tests/unit/test.ts", patterns)).toBe(true)
			expect(scopeValidator.matchesAnyPattern("src/services/api.ts", patterns)).toBe(false)
		})

		it("should handle exact path matches", () => {
			expect(scopeValidator.matchesAnyPattern("src/app.ts", ["src/app.ts"])).toBe(true)
			expect(scopeValidator.matchesAnyPattern("src/app.ts", ["src/main.ts"])).toBe(false)
		})

		it("should handle Windows paths with backslashes", () => {
			expect(scopeValidator.matchesAnyPattern("src\\components\\Button.tsx", ["src/components/**"])).toBe(true)
		})

		it("should handle relative paths", () => {
			expect(scopeValidator.matchesAnyPattern("./src/components/Button.tsx", ["src/components/**"])).toBe(true)
		})

		it("should return false for empty patterns array", () => {
			expect(scopeValidator.matchesAnyPattern("src/components/Button.tsx", [])).toBe(false)
		})
	})

	describe("validatePath", () => {
		it("should return true if path matches scope", async () => {
			const isValid = await scopeValidator.validatePath("src/components/Button.tsx", ["src/components/**"])
			expect(isValid).toBe(true)
		})

		it("should return false if path does not match scope", async () => {
			const isValid = await scopeValidator.validatePath("src/utils/helpers.ts", ["src/components/**"])
			expect(isValid).toBe(false)
		})

		it("should normalize paths before matching", async () => {
			const isValid = await scopeValidator.validatePath("src\\components\\Button.tsx", ["src/components/**"])
			expect(isValid).toBe(true)
		})

		it("should handle multiple scope patterns", async () => {
			const patterns = ["src/components/**", "src/utils/*.ts"]
			expect(await scopeValidator.validatePath("src/components/Button.tsx", patterns)).toBe(true)
			expect(await scopeValidator.validatePath("src/utils/helpers.ts", patterns)).toBe(true)
			expect(await scopeValidator.validatePath("src/services/api.ts", patterns)).toBe(false)
		})
	})
})
