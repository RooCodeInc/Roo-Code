/**
 * AutonomousRecovery.test.ts — Tests for Phase 2 Autonomous Recovery
 *
 * Tests that rejection events are correctly formatted as structured
 * JSON tool-errors for the AI model to self-correct.
 */

import { describe, it, expect } from "vitest"
import { AutonomousRecovery } from "../AutonomousRecovery"
import { RiskTier } from "../CommandClassifier"
import type { ClassificationResult } from "../CommandClassifier"

describe("AutonomousRecovery", () => {
	// ── formatRejection ──────────────────────────────────────────────

	describe("formatRejection", () => {
		it("formats rejection with correct error type", () => {
			const classification: ClassificationResult = {
				tier: RiskTier.DESTRUCTIVE,
				reason: "Tool modifies the filesystem.",
			}

			const result = AutonomousRecovery.formatRejection(
				"write_to_file",
				classification,
				"User rejected the operation",
				"INT-001",
			)

			expect(result).toContain("AUTHORIZATION_REJECTED")
			expect(result).toContain("write_to_file")
			expect(result).toContain("INT-001")
			expect(result).toContain("hook_rejection")
		})

		it("includes recovery guidance", () => {
			const classification: ClassificationResult = {
				tier: RiskTier.CRITICAL,
				reason: "Force push detected",
				matchedPattern: "Force push (git push --force)",
			}

			const result = AutonomousRecovery.formatRejection(
				"execute_command",
				classification,
				"User rejected critical command",
				"INT-002",
			)

			expect(result).toContain("Recovery guidance")
			expect(result).toContain("DO NOT retry")
			expect(result).toContain("CRITICAL")
			expect(result).toContain("Force push")
		})

		it("handles null activeIntentId", () => {
			const classification: ClassificationResult = {
				tier: RiskTier.DESTRUCTIVE,
				reason: "Filesystem modification.",
			}

			const result = AutonomousRecovery.formatRejection("apply_diff", classification, "Rejected", null)

			expect(result).toContain("AUTHORIZATION_REJECTED")
			expect(result).toContain("apply_diff")
		})
	})

	// ── formatScopeViolation ─────────────────────────────────────────

	describe("formatScopeViolation", () => {
		it("formats scope violation with target path and owned scope", () => {
			const result = AutonomousRecovery.formatScopeViolation(
				"write_to_file",
				"src/billing/invoice.ts",
				["src/auth/**", "src/middleware/jwt.ts"],
				"INT-001",
			)

			expect(result).toContain("SCOPE_VIOLATION")
			expect(result).toContain("src/billing/invoice.ts")
			expect(result).toContain("src/auth/**")
			expect(result).toContain("INT-001")
			expect(result).toContain("NOT authorized")
		})

		it("includes guidance to request scope expansion", () => {
			const result = AutonomousRecovery.formatScopeViolation(
				"edit",
				"src/other/file.ts",
				["src/auth/**"],
				"INT-001",
			)

			expect(result).toContain("scope expansion")
			expect(result).toContain("Recovery guidance")
		})
	})

	// ── formatHookError ──────────────────────────────────────────────

	describe("formatHookError", () => {
		it("formats generic hook errors", () => {
			const result = AutonomousRecovery.formatHookError(
				"write_to_file",
				"YAML parse error: unexpected token",
				"INT-001",
			)

			expect(result).toContain("HOOK_ERROR")
			expect(result).toContain("YAML parse error")
			expect(result).toContain("write_to_file")
		})
	})

	// ── JSON Structure ───────────────────────────────────────────────

	describe("JSON structure", () => {
		it("produces valid parseable JSON within the XML tags", () => {
			const classification: ClassificationResult = {
				tier: RiskTier.DESTRUCTIVE,
				reason: "Test",
			}

			const result = AutonomousRecovery.formatRejection("write_to_file", classification, "Rejected", "INT-001")

			// Extract JSON from between the XML tags
			const jsonMatch = /<hook_rejection>\n([\s\S]*?)\n<\/hook_rejection>/.exec(result)
			expect(jsonMatch).not.toBeNull()

			const parsed = JSON.parse(jsonMatch![1])
			expect(parsed.type).toBe("AUTHORIZATION_REJECTED")
			expect(parsed.blockedTool).toBe("write_to_file")
			expect(parsed.activeIntentId).toBe("INT-001")
			expect(parsed.timestamp).toBeTruthy()
			expect(Array.isArray(parsed.recovery_guidance)).toBe(true)
		})
	})
})
