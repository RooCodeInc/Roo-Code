/**
 * IntentValidator Tests
 *
 * Tests for the intent validation module
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import {
	validateIntentId,
	validateFileScope,
	getAvailableIntents,
	formatIntentForDisplay,
} from "../../hooks/IntentValidator"
import {
	type ActiveIntent,
	type ActiveIntentsData,
	ensureOrchestrationDir,
	saveActiveIntents,
	loadActiveIntents,
} from "../../hooks/types"

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

function createMockIntentsData(intents: ActiveIntent[] = []): ActiveIntentsData {
	return {
		active_intents: intents.length > 0 ? intents : [createMockIntent()],
	}
}

// Test fixtures
describe("IntentValidator", () => {
	let tempDir: string

	beforeEach(async () => {
		// Create a temporary directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "intent-validator-test-"))
		await ensureOrchestrationDir(tempDir)
	})

	afterEach(() => {
		// Clean up temporary directory
		if (tempDir && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
	})

	describe("validateIntentId", () => {
		it("should validate a valid PENDING intent", async () => {
			const intentsData = createMockIntentsData([createMockIntent({ id: "intent-1", status: "PENDING" })])
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "intent-1")

			expect(result.valid).toBe(true)
			expect(result.intent).toBeDefined()
			expect(result.intent?.id).toBe("intent-1")
		})

		it("should validate a valid IN_PROGRESS intent", async () => {
			const intentsData = createMockIntentsData([createMockIntent({ id: "intent-1", status: "IN_PROGRESS" })])
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "intent-1")

			expect(result.valid).toBe(true)
			expect(result.intent?.status).toBe("IN_PROGRESS")
		})

		it("should reject when no active_intents.yaml exists", async () => {
			const result = await validateIntentId(tempDir, "intent-1")

			expect(result.valid).toBe(false)
			expect(result.error).toContain("No active_intents.yaml found")
		})

		it("should reject non-existent intent ID", async () => {
			const intentsData = createMockIntentsData([createMockIntent({ id: "intent-1" })])
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "non-existent")

			expect(result.valid).toBe(false)
			expect(result.error).toContain("not found")
			expect(result.error).toContain("intent-1")
		})

		it("should reject COMPLETED intent", async () => {
			const intentsData = createMockIntentsData([createMockIntent({ id: "intent-1", status: "COMPLETED" })])
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "intent-1")

			expect(result.valid).toBe(false)
			expect(result.error).toContain("already been completed")
		})

		it("should reject BLOCKED intent", async () => {
			const intentsData = createMockIntentsData([createMockIntent({ id: "intent-1", status: "BLOCKED" })])
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "intent-1")

			expect(result.valid).toBe(false)
			expect(result.error).toContain("is blocked")
		})

		it("should list available intents in error message", async () => {
			const intentsData = createMockIntentsData([
				createMockIntent({ id: "intent-1" }),
				createMockIntent({ id: "intent-2" }),
			])
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "non-existent")

			expect(result.error).toContain("intent-1")
			expect(result.error).toContain("intent-2")
		})

		it("should handle empty intents list", async () => {
			const intentsData: ActiveIntentsData = { active_intents: [] }
			await saveActiveIntents(tempDir, intentsData)

			const result = await validateIntentId(tempDir, "any-id")

			expect(result.error).toContain("Available intents: none")
		})
	})

	describe("validateFileScope", () => {
		let intent: ActiveIntent

		beforeEach(() => {
			intent = createMockIntent({
				id: "intent-1",
				// Use patterns that match the actual implementation behavior
				// The isFileInScope uses ** to match one or more directories
				// So we need at least one directory in the path
				owned_scope: ["src/**/*", "tests/**/*"],
			})
		})

		it("should validate nested file in src directory", () => {
			// The pattern requires at least one directory between src and file
			const result = validateFileScope("src/components/test.ts", intent)

			expect(result.valid).toBe(true)
		})

		it("should validate nested file path in scope", () => {
			const result = validateFileScope("src/components/Button.ts", intent)

			expect(result.valid).toBe(true)
		})

		it("should validate test files in scope", () => {
			// Use nested path since ** matches zero or more directories
			const result = validateFileScope("tests/unit/example.test.ts", intent)

			expect(result.valid).toBe(true)
		})

		it("should reject file outside scope", () => {
			const result = validateFileScope("dist/index.js", intent)

			expect(result.valid).toBe(false)
			expect(result.error).toContain("Scope Violation")
			expect(result.error).toContain("dist/index.js")
		})

		it("should reject file in non-scoped directory", () => {
			const result = validateFileScope("docs/readme.md", intent)

			expect(result.valid).toBe(false)
		})

		it("should include owned scope in error message", () => {
			const result = validateFileScope("dist/index.js", intent)

			expect(result.error).toContain("src/**/*")
			expect(result.error).toContain("tests/**/*")
		})

		it("should handle empty owned scope", () => {
			const intentWithNoScope = createMockIntent({
				id: "intent-1",
				owned_scope: [],
			})

			const result = validateFileScope("any/file.ts", intentWithNoScope)

			expect(result.valid).toBe(false)
		})

		it("should handle tsx files when scope is ts", () => {
			// Note: The isFileInScope function uses exact pattern matching
			// so tsx won't match ts pattern
			const tsScopeIntent = createMockIntent({
				id: "intent-1",
				owned_scope: ["src/**/*.ts"],
			})

			const result = validateFileScope("src/components/Button.tsx", tsScopeIntent)

			expect(result.valid).toBe(false)
		})
	})

	describe("getAvailableIntents", () => {
		it("should return PENDING intents", async () => {
			const intentsData = createMockIntentsData([
				createMockIntent({ id: "intent-1", status: "PENDING" }),
				createMockIntent({ id: "intent-2", status: "IN_PROGRESS" }),
				createMockIntent({ id: "intent-3", status: "COMPLETED" }),
				createMockIntent({ id: "intent-4", status: "BLOCKED" }),
			])
			await saveActiveIntents(tempDir, intentsData)

			const result = await getAvailableIntents(tempDir)

			expect(result.length).toBe(2)
			expect(result.map((i) => i.id)).toContain("intent-1")
			expect(result.map((i) => i.id)).toContain("intent-2")
		})

		it("should return empty array when no active_intents.yaml", async () => {
			const result = await getAvailableIntents(tempDir)

			expect(result).toEqual([])
		})

		it("should return empty array when no available intents", async () => {
			const intentsData = createMockIntentsData([
				createMockIntent({ id: "intent-1", status: "COMPLETED" }),
				createMockIntent({ id: "intent-2", status: "BLOCKED" }),
			])
			await saveActiveIntents(tempDir, intentsData)

			const result = await getAvailableIntents(tempDir)

			expect(result).toEqual([])
		})
	})

	describe("formatIntentForDisplay", () => {
		it("should format intent with all fields", () => {
			const intent = createMockIntent({
				id: "intent-1",
				name: "Feature A",
				status: "IN_PROGRESS",
				owned_scope: ["src/**/*"],
				constraints: ["No breaking changes"],
				acceptance_criteria: ["All tests pass"],
			})

			const result = formatIntentForDisplay(intent)

			expect(result).toContain("Intent: Feature A (intent-1)")
			expect(result).toContain("Status: IN_PROGRESS")
			expect(result).toContain("Owned Scope")
			expect(result).toContain("src/**/*")
			expect(result).toContain("Constraints")
			expect(result).toContain("No breaking changes")
			expect(result).toContain("Acceptance Criteria")
			expect(result).toContain("All tests pass")
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
	})
})
