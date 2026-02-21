import { describe, it, expect } from "vitest"
import { formatToolError, ErrorFormatters } from "../errorFormatter"

describe("errorFormatter", () => {
	describe("formatToolError", () => {
		it("returns valid JSON with error, reason, and recoverable", () => {
			const json = formatToolError("TEST_ERROR", "Something went wrong")
			const parsed = JSON.parse(json)
			expect(parsed.error).toBe("TEST_ERROR")
			expect(parsed.reason).toBe("Something went wrong")
			expect(parsed.recoverable).toBe(true)
			expect(parsed.suggestion).toBeUndefined()
		})

		it("includes suggestion when provided", () => {
			const json = formatToolError("ERR", "Reason", "Try again")
			const parsed = JSON.parse(json)
			expect(parsed.suggestion).toBe("Try again")
		})

		it("defaults recoverable to true", () => {
			const json = formatToolError("ERR", "Reason")
			expect(JSON.parse(json).recoverable).toBe(true)
		})

		it("accepts recoverable false", () => {
			const json = formatToolError("ERR", "Reason", undefined, false)
			expect(JSON.parse(json).recoverable).toBe(false)
		})

		it("outputs pretty-printed JSON (indented)", () => {
			const json = formatToolError("A", "B")
			expect(json).toContain("\n  ")
		})
	})

	describe("ErrorFormatters", () => {
		it("missingIntent returns MISSING_INTENT with suggestion", () => {
			const json = ErrorFormatters.missingIntent()
			const parsed = JSON.parse(json)
			expect(parsed.error).toBe("MISSING_INTENT")
			expect(parsed.reason).toContain("No active intent")
			expect(parsed.suggestion).toContain("select_active_intent")
		})

		it("intentNotFound includes intent ID", () => {
			const json = ErrorFormatters.intentNotFound("INT-001")
			const parsed = JSON.parse(json)
			expect(parsed.error).toBe("INTENT_NOT_FOUND")
			expect(parsed.reason).toContain("INT-001")
			expect(parsed.reason).toContain("active_intents.yaml")
		})

		it("scopeViolation includes intent name, id, and path", () => {
			const json = ErrorFormatters.scopeViolation("Add dark mode", "INT-001", "other/foo.ts")
			const parsed = JSON.parse(json)
			expect(parsed.error).toBe("SCOPE_VIOLATION")
			expect(parsed.reason).toContain("Add dark mode")
			expect(parsed.reason).toContain("INT-001")
			expect(parsed.reason).toContain("other/foo.ts")
			expect(parsed.suggestion).toContain("scope expansion")
		})

		it("userRejected includes action", () => {
			const json = ErrorFormatters.userRejected("write_to_file")
			const parsed = JSON.parse(json)
			expect(parsed.error).toBe("USER_REJECTED")
			expect(parsed.reason).toContain("write_to_file")
		})

		it("noScope includes intent ID and suggestion", () => {
			const json = ErrorFormatters.noScope("INT-002")
			const parsed = JSON.parse(json)
			expect(parsed.error).toBe("NO_SCOPE_DEFINED")
			expect(parsed.reason).toContain("INT-002")
			expect(parsed.reason).toContain("owned_scope")
			expect(parsed.suggestion).toContain("active_intents.yaml")
		})
	})
})
