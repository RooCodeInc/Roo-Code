import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "fs"
import * as path from "path"
import {
	loadActiveIntents,
	findIntentById,
	buildIntentContextXml,
	buildTraceXml,
	isGovernedWorkspace,
	ACTIVE_INTENTS_PATH,
	MAX_TRACE_ENTRIES,
	type ActiveIntent,
	type IntentTraceEvent,
} from "../../context/activeIntents"

// Mock fs module
vi.mock("fs", async () => {
	const actual = await vi.importActual("fs")
	return {
		...actual,
		existsSync: vi.fn(),
		promises: {
			readFile: vi.fn(),
		},
	}
})

const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>
const mockReadFile = fs.promises.readFile as ReturnType<typeof vi.fn>

const VALID_YAML = `intents:
  - id: "refactor-auth"
    goal: "Refactor the authentication module"
    status: "IN_PROGRESS"
    constraints:
      - "Must maintain backward compatibility"
      - "No new dependencies"
    scope:
      - "src/auth/**"
      - "src/middleware/auth.ts"
  - id: "add-logging"
    goal: "Add structured logging across services"
    status: "COMPLETED"
    constraints: []
    scope:
      - "src/**"
  - id: "fix-payment-bug"
    goal: "Fix payment race condition"
    status: "IN_PROGRESS"
    constraints:
      - "Must not change API contract"
    scope:
      - "src/payments/**"
`

const CWD = "/test/workspace"

describe("activeIntents", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("isGovernedWorkspace", () => {
		it("should return true when active_intents.yaml exists", () => {
			mockExistsSync.mockReturnValue(true)
			expect(isGovernedWorkspace(CWD)).toBe(true)
			expect(mockExistsSync).toHaveBeenCalledWith(path.join(CWD, ACTIVE_INTENTS_PATH))
		})

		it("should return false when active_intents.yaml does not exist", () => {
			mockExistsSync.mockReturnValue(false)
			expect(isGovernedWorkspace(CWD)).toBe(false)
		})
	})

	describe("loadActiveIntents", () => {
		it("should parse valid YAML and return all intents", async () => {
			mockReadFile.mockResolvedValue(VALID_YAML)
			const intents = await loadActiveIntents(CWD)

			expect(intents).toHaveLength(3)
			expect(intents[0]).toEqual({
				id: "refactor-auth",
				goal: "Refactor the authentication module",
				status: "IN_PROGRESS",
				constraints: ["Must maintain backward compatibility", "No new dependencies"],
				scope: ["src/auth/**", "src/middleware/auth.ts"],
			})
			expect(intents[1]).toEqual({
				id: "add-logging",
				goal: "Add structured logging across services",
				status: "COMPLETED",
				constraints: [],
				scope: ["src/**"],
			})
			expect(intents[2]).toEqual({
				id: "fix-payment-bug",
				goal: "Fix payment race condition",
				status: "IN_PROGRESS",
				constraints: ["Must not change API contract"],
				scope: ["src/payments/**"],
			})
		})

		it("should return empty array when file does not exist", async () => {
			mockReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
			const intents = await loadActiveIntents(CWD)
			expect(intents).toEqual([])
		})

		it("should return empty array on malformed YAML", async () => {
			// Content that doesn't match expected structure
			mockReadFile.mockResolvedValue("random: content\nnothing: here")
			const intents = await loadActiveIntents(CWD)
			expect(intents).toEqual([])
		})

		it("should handle YAML with no constraints or scope", async () => {
			const minimal = `intents:
  - id: "minimal-intent"
    goal: "Do something"
    status: "IN_PROGRESS"
    constraints: []
    scope: []
`
			mockReadFile.mockResolvedValue(minimal)
			const intents = await loadActiveIntents(CWD)
			expect(intents).toHaveLength(1)
			expect(intents[0].constraints).toEqual([])
			expect(intents[0].scope).toEqual([])
		})
	})

	describe("findIntentById", () => {
		const intents: ActiveIntent[] = [
			{ id: "intent-1", goal: "Goal 1", status: "IN_PROGRESS", constraints: [], scope: [] },
			{ id: "intent-2", goal: "Goal 2", status: "COMPLETED", constraints: [], scope: [] },
		]

		it("should find an intent by ID", () => {
			const result = findIntentById(intents, "intent-1")
			expect(result).toBeDefined()
			expect(result?.id).toBe("intent-1")
		})

		it("should return undefined for non-existent ID", () => {
			const result = findIntentById(intents, "nonexistent")
			expect(result).toBeUndefined()
		})

		it("should return undefined for empty intents array", () => {
			const result = findIntentById([], "intent-1")
			expect(result).toBeUndefined()
		})
	})

	describe("buildIntentContextXml", () => {
		it("should build correct XML with constraints and scope", () => {
			const intent: ActiveIntent = {
				id: "test-intent",
				goal: "Test goal",
				status: "IN_PROGRESS",
				constraints: ["Constraint 1", "Constraint 2"],
				scope: ["src/**", "tests/**"],
			}

			const xml = buildIntentContextXml(intent)

			expect(xml).toContain("<intent_context>")
			expect(xml).toContain("</intent_context>")
			expect(xml).toContain("<intent_id>test-intent</intent_id>")
			expect(xml).toContain("<goal>Test goal</goal>")
			expect(xml).toContain("<status>IN_PROGRESS</status>")
			expect(xml).toContain("<constraint>Constraint 1</constraint>")
			expect(xml).toContain("<constraint>Constraint 2</constraint>")
			expect(xml).toContain("<path>src/**</path>")
			expect(xml).toContain("<path>tests/**</path>")
		})

		it("should handle empty constraints and scope", () => {
			const intent: ActiveIntent = {
				id: "empty-intent",
				goal: "Empty goal",
				status: "IN_PROGRESS",
				constraints: [],
				scope: [],
			}

			const xml = buildIntentContextXml(intent)
			expect(xml).toContain("<!-- no constraints -->")
			expect(xml).toContain("<!-- no scope restrictions -->")
		})

		it("should omit trace section when no trace entries provided", () => {
			const intent: ActiveIntent = {
				id: "no-trace",
				goal: "Goal",
				status: "IN_PROGRESS",
				constraints: [],
				scope: [],
			}

			const xml = buildIntentContextXml(intent)
			expect(xml).not.toContain("<trace>")
			expect(xml).not.toContain("</trace>")
		})

		it("should omit trace section when trace entries array is empty", () => {
			const intent: ActiveIntent = {
				id: "empty-trace",
				goal: "Goal",
				status: "IN_PROGRESS",
				constraints: [],
				scope: [],
			}

			const xml = buildIntentContextXml(intent, [])
			expect(xml).not.toContain("<trace>")
		})

		it("should include trace section with events when provided", () => {
			const intent: ActiveIntent = {
				id: "with-trace",
				goal: "Goal",
				status: "IN_PROGRESS",
				constraints: [],
				scope: [],
			}

			const traces: IntentTraceEvent[] = [
				{
					toolName: "write_to_file",
					summary: "write_to_file executed successfully",
					outcome: "success",
					timestamp: "2026-02-18T14:00:00Z",
					intentId: "with-trace",
				},
				{
					toolName: "apply_diff",
					summary: "apply_diff failed: merge conflict",
					outcome: "error",
					timestamp: "2026-02-18T14:01:00Z",
					intentId: "with-trace",
				},
			]

			const xml = buildIntentContextXml(intent, traces)
			expect(xml).toContain("<trace>")
			expect(xml).toContain("</trace>")
			expect(xml).toContain('tool="write_to_file"')
			expect(xml).toContain('outcome="success"')
			expect(xml).toContain('tool="apply_diff"')
			expect(xml).toContain('outcome="error"')
			expect(xml).toContain("merge conflict")
		})

		it("should limit trace to MAX_TRACE_ENTRIES most recent", () => {
			const intent: ActiveIntent = {
				id: "capped-trace",
				goal: "Goal",
				status: "IN_PROGRESS",
				constraints: [],
				scope: [],
			}

			// Create 15 trace entries (more than max 10)
			const traces: IntentTraceEvent[] = Array.from({ length: 15 }, (_, i) => ({
				toolName: `tool_${i}`,
				summary: `action ${i}`,
				outcome: "success" as const,
				timestamp: `2026-02-18T14:${String(i).padStart(2, "0")}:00Z`,
				intentId: "capped-trace",
			}))

			const xml = buildIntentContextXml(intent, traces)
			// Should only contain the last 10 entries (5-14)
			expect(xml).not.toContain('tool="tool_0"')
			expect(xml).not.toContain('tool="tool_4"')
			expect(xml).toContain('tool="tool_5"')
			expect(xml).toContain('tool="tool_14"')
		})
	})

	describe("buildTraceXml", () => {
		it("should return null for undefined entries", () => {
			expect(buildTraceXml(undefined)).toBeNull()
		})

		it("should return null for empty entries", () => {
			expect(buildTraceXml([])).toBeNull()
		})

		it("should build trace XML for valid entries", () => {
			const entries: IntentTraceEvent[] = [
				{
					toolName: "execute_command",
					summary: "execute_command executed successfully",
					outcome: "success",
					timestamp: "2026-02-18T14:00:00Z",
					intentId: "test",
				},
			]

			const xml = buildTraceXml(entries)
			expect(xml).not.toBeNull()
			expect(xml).toContain("<trace>")
			expect(xml).toContain("</trace>")
			expect(xml).toContain('tool="execute_command"')
		})

		it("should cap at MAX_TRACE_ENTRIES", () => {
			const entries: IntentTraceEvent[] = Array.from({ length: MAX_TRACE_ENTRIES + 5 }, (_, i) => ({
				toolName: `tool_${i}`,
				summary: `action ${i}`,
				outcome: "success" as const,
				timestamp: new Date().toISOString(),
				intentId: "test",
			}))

			const xml = buildTraceXml(entries)!
			const eventCount = (xml.match(/<event /g) || []).length
			expect(eventCount).toBe(MAX_TRACE_ENTRIES)
		})
	})
})
