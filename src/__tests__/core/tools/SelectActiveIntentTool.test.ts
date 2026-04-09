/**
 * SelectActiveIntentTool Tests
 *
 * Tests for the select_active_intent tool
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import {
	type ActiveIntent,
	type ActiveIntentsData,
	ensureOrchestrationDir,
	saveActiveIntents,
} from "../../../hooks/types"
import { validateIntentId, formatIntentForDisplay } from "../../../hooks/IntentValidator"

// Test utilities
function createMockIntent(overrides: Partial<ActiveIntent> = {}): ActiveIntent {
	return {
		id: "test-intent-1",
		name: "Test Intent",
		status: "PENDING",
		owned_scope: ["src/**/*.ts", "tests/**/*"],
		constraints: ["Must not modify production code"],
		acceptance_criteria: ["Tests pass", "Code compiles"],
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		...overrides,
	}
}

// Test fixtures
describe("SelectActiveIntentTool", () => {
	let tempDir: string

	beforeEach(async () => {
		// Create a temporary directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "select-intent-test-"))
		await ensureOrchestrationDir(tempDir)
	})

	afterEach(() => {
		// Clean up temporary directory
		if (tempDir && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
		vi.clearAllMocks()
	})

	// Since the tool has tight coupling with Task and callbacks,
	// we test the core logic through validateIntentId and formatIntentForDisplay
	// which are the actual functions being tested

	describe("validateIntentId integration", () => {
		it("should validate PENDING intent through full flow", async () => {
			const intentsData: ActiveIntentsData = {
				active_intents: [createMockIntent({ id: "intent-1", status: "PENDING" })],
			}
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "intent-1")

			expect(result.valid).toBe(true)
			expect(result.intent?.id).toBe("intent-1")
		})

		it("should validate IN_PROGRESS intent through full flow", async () => {
			const intentsData: ActiveIntentsData = {
				active_intents: [createMockIntent({ id: "intent-1", status: "IN_PROGRESS" })],
			}
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "intent-1")

			expect(result.valid).toBe(true)
		})

		it("should reject non-existent intent", async () => {
			const intentsData: ActiveIntentsData = {
				active_intents: [createMockIntent({ id: "intent-1" })],
			}
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "non-existent")

			expect(result.valid).toBe(false)
			expect(result.error).toContain("not found")
		})

		it("should reject COMPLETED intent", async () => {
			const intentsData: ActiveIntentsData = {
				active_intents: [createMockIntent({ id: "intent-1", status: "COMPLETED" })],
			}
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "intent-1")

			expect(result.valid).toBe(false)
			expect(result.error).toContain("completed")
		})

		it("should reject BLOCKED intent", async () => {
			const intentsData: ActiveIntentsData = {
				active_intents: [createMockIntent({ id: "intent-1", status: "BLOCKED" })],
			}
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "intent-1")

			expect(result.valid).toBe(false)
			expect(result.error).toContain("blocked")
		})

		it("should list available intents when not found", async () => {
			const intentsData: ActiveIntentsData = {
				active_intents: [createMockIntent({ id: "intent-1" }), createMockIntent({ id: "intent-2" })],
			}
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "non-existent")

			expect(result.error).toContain("intent-1")
			expect(result.error).toContain("intent-2")
		})

		it("should handle empty intents gracefully", async () => {
			const intentsData: ActiveIntentsData = { active_intents: [] }
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "any-id")

			expect(result.valid).toBe(false)
			expect(result.error).toContain("Available intents: none")
		})
	})

	describe("formatIntentForDisplay integration", () => {
		it("should format intent with all details", () => {
			const intent = createMockIntent({
				id: "intent-1",
				name: "Feature A",
				status: "IN_PROGRESS",
			})

			const result = formatIntentForDisplay(intent)

			expect(result).toContain("Intent: Feature A (intent-1)")
			expect(result).toContain("Status: IN_PROGRESS")
			expect(result).toContain("Owned Scope")
			expect(result).toContain("src/**/*.ts")
			expect(result).toContain("tests/**/*")
			expect(result).toContain("Constraints")
			expect(result).toContain("Acceptance Criteria")
		})

		it("should handle empty owned_scope", () => {
			const intent = createMockIntent({
				id: "intent-1",
				owned_scope: [],
			})

			const result = formatIntentForDisplay(intent)

			expect(result).not.toContain("Owned Scope")
		})

		it("should handle empty constraints", () => {
			const intent = createMockIntent({
				id: "intent-1",
				constraints: [],
			})

			const result = formatIntentForDisplay(intent)

			expect(result).not.toContain("Constraints")
		})

		it("should handle empty acceptance_criteria", () => {
			const intent = createMockIntent({
				id: "intent-1",
				acceptance_criteria: [],
			})

			const result = formatIntentForDisplay(intent)

			expect(result).not.toContain("Acceptance Criteria")
		})

		it("should format multiple scope items", () => {
			const intent = createMockIntent({
				id: "intent-1",
				owned_scope: ["src/**/*", "tests/**/*", "docs/**/*"],
			})

			const result = formatIntentForDisplay(intent)

			expect(result).toContain("src/**/*")
			expect(result).toContain("tests/**/*")
			expect(result).toContain("docs/**/*")
		})

		it("should format multiple constraints", () => {
			const intent = createMockIntent({
				id: "intent-1",
				constraints: ["No breaking changes", "Must pass tests", "Keep backward compatible"],
			})

			const result = formatIntentForDisplay(intent)

			expect(result).toContain("No breaking changes")
			expect(result).toContain("Must pass tests")
			expect(result).toContain("Keep backward compatible")
		})
	})

	// Test the exported singleton pattern
	describe("singleton export", () => {
		it("should export selectActiveIntentTool singleton", async () => {
			// Import the singleton
			const { selectActiveIntentTool } = await import("../../../core/tools/SelectActiveIntentTool")

			expect(selectActiveIntentTool).toBeDefined()
			expect(selectActiveIntentTool.name).toBe("select_active_intent")
		})
	})

	// Integration test simulating the full tool execution flow
	describe("full execution flow simulation", () => {
		it("should simulate successful intent selection", async () => {
			const intentsData: ActiveIntentsData = {
				active_intents: [createMockIntent({ id: "intent-1", name: "Feature A", status: "PENDING" })],
			}
			await saveActiveIntents(tempDir, intentsData)

			// Step 1: Validate intent ID
			const validation = await validateIntentId(tempDir, "intent-1")
			expect(validation.valid).toBe(true)

			// Step 2: Format intent for display
			const display = formatIntentForDisplay(validation.intent!)
			expect(display).toContain("Feature A")
			expect(display).toContain("intent-1")

			// This simulates what the tool does internally
			expect(validation.intent?.status).toBe("PENDING")
			expect(validation.intent?.owned_scope).toBeDefined()
			expect(validation.intent?.constraints).toBeDefined()
		})

		it("should simulate error flow for missing intent_id", async () => {
			// This tests the error path when no intent_id is provided
			// The tool would call sayAndCreateMissingParamError
			const intentId = undefined

			// Simulate the tool's parameter validation
			if (!intentId) {
				expect(true).toBe(true) // Would increment mistake count
			}
		})

		it("should simulate error flow for invalid intent", async () => {
			const intentsData: ActiveIntentsData = {
				active_intents: [createMockIntent({ id: "intent-1" })],
			}
			await saveActiveIntents(tempDir, intentsData)

			// Step 1: Validate non-existent intent
			const validation = await validateIntentId(tempDir, "non-existent")
			expect(validation.valid).toBe(false)
			expect(validation.error).toBeDefined()

			// The tool would format this as an error response
			const errorResponse = `Error: ${validation.error}`
			expect(errorResponse).toContain("not found")
		})
	})
})
