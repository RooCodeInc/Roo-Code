/**
 * ScopeEnforcer.test.ts — Tests for Phase 2 Scope Enforcement
 *
 * Tests that file-write operations are correctly validated against
 * the active intent's owned_scope glob patterns.
 */

import { describe, it, expect } from "vitest"
import { ScopeEnforcer } from "../ScopeEnforcer"

describe("ScopeEnforcer", () => {
	const cwd = "/workspace/project"

	// ── Glob Pattern Matching ────────────────────────────────────────

	describe("scope pattern matching", () => {
		it("allows files matching ** glob pattern", () => {
			const result = ScopeEnforcer.check("src/auth/middleware.ts", ["src/auth/**"], cwd)
			expect(result.allowed).toBe(true)
			expect(result.matchedPattern).toBe("src/auth/**")
		})

		it("allows files matching exact path", () => {
			const result = ScopeEnforcer.check("src/middleware/jwt.ts", ["src/middleware/jwt.ts"], cwd)
			expect(result.allowed).toBe(true)
		})

		it("allows files matching one of multiple patterns", () => {
			const result = ScopeEnforcer.check("tests/auth/jwt.test.ts", ["src/auth/**", "tests/auth/**"], cwd)
			expect(result.allowed).toBe(true)
			expect(result.matchedPattern).toBe("tests/auth/**")
		})

		it("allows deeply nested files with ** pattern", () => {
			const result = ScopeEnforcer.check("src/auth/providers/jwt/handler.ts", ["src/auth/**"], cwd)
			expect(result.allowed).toBe(true)
		})

		it("blocks files outside all scope patterns", () => {
			const result = ScopeEnforcer.check("src/billing/invoice.ts", ["src/auth/**", "src/middleware/jwt.ts"], cwd)
			expect(result.allowed).toBe(false)
			expect(result.reason).toContain("Scope Violation")
		})

		it("blocks files in sibling directories", () => {
			const result = ScopeEnforcer.check("src/api/users.ts", ["src/auth/**"], cwd)
			expect(result.allowed).toBe(false)
		})

		it("allows when no scope is defined (backwards compatibility)", () => {
			const result = ScopeEnforcer.check("any/file.ts", [], cwd)
			expect(result.allowed).toBe(true)
		})

		it("handles * wildcard for single-segment matching", () => {
			const result = ScopeEnforcer.check("src/middleware/auth.ts", ["src/middleware/*.ts"], cwd)
			expect(result.allowed).toBe(true)
		})

		it("* wildcard does not match across directories", () => {
			const result = ScopeEnforcer.check("src/middleware/deep/auth.ts", ["src/middleware/*.ts"], cwd)
			expect(result.allowed).toBe(false)
		})
	})

	// ── Path Normalization ───────────────────────────────────────────

	describe("path normalization", () => {
		it("normalizes Windows backslash paths", () => {
			const result = ScopeEnforcer.check(String.raw`src\auth\middleware.ts`, ["src/auth/**"], cwd)
			expect(result.allowed).toBe(true)
		})

		it("strips leading ./ from paths", () => {
			const result = ScopeEnforcer.check("./src/auth/middleware.ts", ["src/auth/**"], cwd)
			expect(result.allowed).toBe(true)
		})

		it("handles absolute paths by making them relative", () => {
			const result = ScopeEnforcer.check("/workspace/project/src/auth/handler.ts", ["src/auth/**"], cwd)
			expect(result.allowed).toBe(true)
		})
	})

	// ── extractTargetPath ────────────────────────────────────────────

	describe("extractTargetPath", () => {
		it("extracts path from 'path' parameter", () => {
			const path = ScopeEnforcer.extractTargetPath("write_to_file", { path: "src/auth/main.ts" })
			expect(path).toBe("src/auth/main.ts")
		})

		it("extracts path from 'file_path' parameter", () => {
			const path = ScopeEnforcer.extractTargetPath("edit", { file_path: "src/config.ts" })
			expect(path).toBe("src/config.ts")
		})

		it("returns null when no path parameter exists", () => {
			const path = ScopeEnforcer.extractTargetPath("execute_command", { command: "npm test" })
			expect(path).toBeNull()
		})

		it("extracts path from diff header", () => {
			const diff = `--- a/src/auth/handler.ts\n+++ b/src/auth/handler.ts\n@@ -1,3 +1,4 @@`
			const path = ScopeEnforcer.extractTargetPath("apply_diff", { diff })
			expect(path).toBe("src/auth/handler.ts")
		})
	})
})
