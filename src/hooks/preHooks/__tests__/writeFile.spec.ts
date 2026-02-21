import { describe, it, expect, vi, beforeEach } from "vitest"
import { writeFilePreHook } from "../writeFile"

vi.mock("../../utils/pathMatcher", () => ({
	matchesAnyGlobPattern: vi.fn(),
}))

vi.mock("../../utils/yamlLoader", () => ({
	findIntentById: vi.fn(),
	getCachedIntent: vi.fn(),
}))

const pathMatcher = await import("../../utils/pathMatcher")
const yamlLoader = await import("../../utils/yamlLoader")

const mockMatchesAnyGlobPattern = vi.mocked(pathMatcher.matchesAnyGlobPattern)
const mockFindIntentById = vi.mocked(yamlLoader.findIntentById)
const mockGetCachedIntent = vi.mocked(yamlLoader.getCachedIntent)

const MOCK_INTENT = {
	id: "INT-001",
	name: "Add dark mode",
	status: "IN_PROGRESS" as const,
	owned_scope: ["src/**"],
	constraints: [],
	acceptance_criteria: [],
}

describe("writeFilePreHook", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("blocks when intentId is null", async () => {
		const result = await writeFilePreHook(
			{ path: "src/foo.ts", content: "x" },
			{ intentId: null, workspaceRoot: "/ws" },
		)
		expect(result.blocked).toBe(true)
		expect(result.error).toContain("select_active_intent")
		expect(mockFindIntentById).not.toHaveBeenCalled()
	})

	it("blocks when intent is not found in YAML", async () => {
		mockFindIntentById.mockResolvedValue(null)
		const result = await writeFilePreHook(
			{ path: "src/foo.ts", content: "x" },
			{ intentId: "INT-999", workspaceRoot: "/ws" },
		)
		expect(result.blocked).toBe(true)
		expect(result.error).toContain("INT-999")
		expect(result.error).toContain("active_intents.yaml")
	})

	it("blocks when intent has no owned_scope", async () => {
		mockFindIntentById.mockResolvedValue({
			...MOCK_INTENT,
			owned_scope: [],
		})
		const result = await writeFilePreHook(
			{ path: "src/foo.ts", content: "x" },
			{ intentId: "INT-001", workspaceRoot: "/ws" },
		)
		expect(result.blocked).toBe(true)
		expect(result.error).toContain("no owned_scope")
		expect(mockMatchesAnyGlobPattern).not.toHaveBeenCalled()
	})

	it("blocks when file path is out of scope", async () => {
		mockFindIntentById.mockResolvedValue(MOCK_INTENT)
		mockMatchesAnyGlobPattern.mockReturnValue(false)
		const result = await writeFilePreHook(
			{ path: "other/foo.ts", content: "x" },
			{ intentId: "INT-001", workspaceRoot: "/ws" },
		)
		expect(result.blocked).toBe(true)
		expect(result.error).toContain("Scope Violation")
		expect(result.error).toContain("Add dark mode")
		expect(result.error).toContain("other/foo.ts")
	})

	it("allows write when file is in scope", async () => {
		mockFindIntentById.mockResolvedValue(MOCK_INTENT)
		mockMatchesAnyGlobPattern.mockReturnValue(true)
		const result = await writeFilePreHook(
			{ path: "src/foo.ts", content: "x" },
			{ intentId: "INT-001", workspaceRoot: "/ws" },
		)
		expect(result.blocked).toBe(false)
		expect(result.error).toBeUndefined()
		expect(mockMatchesAnyGlobPattern).toHaveBeenCalledWith("src/foo.ts", ["src/**"], "/ws")
	})

	it("uses ownedScope from context when provided", async () => {
		mockGetCachedIntent.mockReturnValue(MOCK_INTENT)
		mockMatchesAnyGlobPattern.mockReturnValue(true)
		const result = await writeFilePreHook(
			{ path: "app/bar.ts", content: "y" },
			{ intentId: "INT-001", workspaceRoot: "/ws", ownedScope: ["app/**"] },
		)
		expect(result.blocked).toBe(false)
		expect(mockMatchesAnyGlobPattern).toHaveBeenCalledWith("app/bar.ts", ["app/**"], "/ws")
	})
})
