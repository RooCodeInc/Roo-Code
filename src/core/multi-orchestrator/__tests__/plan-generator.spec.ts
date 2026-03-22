import { vi, describe, it, expect, beforeEach } from "vitest"
import type { ModeConfig, ProviderSettings } from "@roo-code/types"

// Mock the api module so we can control buildApiHandler
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(),
}))

// Mock generateAgentId for deterministic IDs in tests
let agentIdCounter = 0
vi.mock("../types", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../types")>()
	return {
		...actual,
		generateAgentId: () => {
			agentIdCounter++
			return `testid-${String(agentIdCounter).padStart(2, "0")}`
		},
	}
})

import { generatePlan } from "../plan-generator"
import { buildApiHandler } from "../../../api"

const mockBuildApiHandler = vi.mocked(buildApiHandler)

const sampleModes: ModeConfig[] = [
	{
		slug: "code",
		name: "Code",
		roleDefinition: "Write code",
		description: "Implementation mode",
		groups: ["read", "edit"] as any,
	},
	{
		slug: "architect",
		name: "Architect",
		roleDefinition: "Design architecture",
		description: "Design mode",
		groups: ["read"] as any,
	},
	{
		slug: "multi-orchestrator",
		name: "Multi-Orchestrator",
		roleDefinition: "Orchestrate",
		description: "Parallel orchestration",
		groups: [] as any,
	},
	{
		slug: "orchestrator",
		name: "Orchestrator",
		roleDefinition: "Orchestrate",
		description: "Single orchestration",
		groups: [] as any,
	},
]

const sampleProviderSettings: ProviderSettings = {
	apiProvider: "anthropic",
	apiModelId: "claude-sonnet-4-20250514",
}

describe("generatePlan", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		agentIdCounter = 0
	})

	it("should return null when handler does not support completePrompt", async () => {
		mockBuildApiHandler.mockReturnValue({} as any)

		const result = await generatePlan("Build a feature", sampleModes, 3, sampleProviderSettings)
		expect(result).toBeNull()
	})

	it("should call completePrompt with a prompt containing the user request", async () => {
		const mockCompletePrompt = vi.fn().mockResolvedValue(
			JSON.stringify({
				tasks: [
					{
						mode: "code",
						title: "Write feature",
						description: "Implement the feature",
						assignedFiles: ["src/feature.ts"],
						priority: 1,
					},
				],
				requiresMerge: true,
				estimatedComplexity: "low",
			}),
		)

		mockBuildApiHandler.mockReturnValue({ completePrompt: mockCompletePrompt } as any)

		await generatePlan("Build a feature", sampleModes, 3, sampleProviderSettings)

		expect(mockCompletePrompt).toHaveBeenCalledTimes(1)
		const promptArg = mockCompletePrompt.mock.calls[0][0] as string
		expect(promptArg).toContain("Build a feature")
		expect(promptArg).toContain("Max agents available: 3")
	})

	it("should filter out multi-orchestrator, orchestrator, and architect from available modes in prompt", async () => {
		const mockCompletePrompt = vi.fn().mockResolvedValue(
			JSON.stringify({
				tasks: [{ mode: "code", title: "T", description: "D", assignedFiles: [], priority: 1 }],
				requiresMerge: false,
				estimatedComplexity: "low",
			}),
		)

		mockBuildApiHandler.mockReturnValue({ completePrompt: mockCompletePrompt } as any)

		await generatePlan("Do something", sampleModes, 4, sampleProviderSettings)

		const promptArg = mockCompletePrompt.mock.calls[0][0] as string
		expect(promptArg).toContain("- code:")
		// architect is now also filtered out per CRITICAL RULES
		expect(promptArg).not.toContain("- architect:")
		expect(promptArg).not.toContain("- multi-orchestrator:")
		expect(promptArg).not.toContain("- orchestrator:")
	})

	it("should parse a valid JSON response into an OrchestratorPlan", async () => {
		const validResponse = JSON.stringify({
			tasks: [
				{
					mode: "code",
					title: "Build API",
					description: "Create REST endpoints",
					assignedFiles: ["src/api.ts"],
					priority: 1,
				},
				{
					mode: "architect",
					title: "Design DB",
					description: "Plan the database schema",
					assignedFiles: ["docs/schema.md"],
					priority: 2,
				},
			],
			requiresMerge: true,
			estimatedComplexity: "medium",
		})

		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockResolvedValue(validResponse),
		} as any)

		const plan = await generatePlan("Build app", sampleModes, 4, sampleProviderSettings)

		expect(plan).not.toBeNull()
		expect(plan!.tasks).toHaveLength(2)
		expect(plan!.tasks[0].title).toBe("Build API")
		expect(plan!.tasks[0].mode).toBe("code")
		expect(plan!.tasks[0].description).toBe("Create REST endpoints")
		expect(plan!.tasks[0].assignedFiles).toEqual(["src/api.ts"])
		expect(plan!.tasks[0].priority).toBe(1)
		expect(plan!.tasks[1].title).toBe("Design DB")
		expect(plan!.requiresMerge).toBe(true)
		expect(plan!.estimatedComplexity).toBe("medium")
	})

	it("should assign generated IDs to tasks", async () => {
		const validResponse = JSON.stringify({
			tasks: [
				{ mode: "code", title: "T1", description: "D1", assignedFiles: [], priority: 1 },
				{ mode: "code", title: "T2", description: "D2", assignedFiles: [], priority: 2 },
			],
			requiresMerge: true,
			estimatedComplexity: "low",
		})

		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockResolvedValue(validResponse),
		} as any)

		const plan = await generatePlan("Do tasks", sampleModes, 4, sampleProviderSettings)

		expect(plan!.tasks[0].id).toBe("testid-01")
		expect(plan!.tasks[1].id).toBe("testid-02")
	})

	it("should handle JSON wrapped in markdown code fences", async () => {
		const wrappedResponse =
			"```json\n" +
			JSON.stringify({
				tasks: [{ mode: "code", title: "Fenced", description: "D", assignedFiles: [], priority: 1 }],
				requiresMerge: false,
				estimatedComplexity: "low",
			}) +
			"\n```"

		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockResolvedValue(wrappedResponse),
		} as any)

		const plan = await generatePlan("Fenced task", sampleModes, 2, sampleProviderSettings)

		expect(plan).not.toBeNull()
		expect(plan!.tasks[0].title).toBe("Fenced")
	})

	it("should return null for completely invalid JSON", async () => {
		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockResolvedValue("this is not json at all {{{"),
		} as any)

		const result = await generatePlan("Bad response", sampleModes, 2, sampleProviderSettings)
		expect(result).toBeNull()
	})

	it("should return null when response has no tasks array", async () => {
		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockResolvedValue(JSON.stringify({ noTasks: true })),
		} as any)

		const result = await generatePlan("Missing tasks", sampleModes, 2, sampleProviderSettings)
		expect(result).toBeNull()
	})

	it("should return null when tasks is not an array", async () => {
		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockResolvedValue(JSON.stringify({ tasks: "not-an-array" })),
		} as any)

		const result = await generatePlan("Bad tasks", sampleModes, 2, sampleProviderSettings)
		expect(result).toBeNull()
	})

	it("should default requiresMerge based on code mode presence when not provided", async () => {
		const responseWithoutMerge = JSON.stringify({
			tasks: [
				{ mode: "code", title: "Code task", description: "D", assignedFiles: [], priority: 1 },
			],
			estimatedComplexity: "low",
		})

		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockResolvedValue(responseWithoutMerge),
		} as any)

		const plan = await generatePlan("Inferred merge", sampleModes, 2, sampleProviderSettings)

		expect(plan).not.toBeNull()
		// requiresMerge should be true since a task has mode "code"
		expect(plan!.requiresMerge).toBe(true)
	})

	it("should default requiresMerge to false when no code mode tasks and not provided", async () => {
		const responseWithoutMerge = JSON.stringify({
			tasks: [
				{ mode: "architect", title: "Design", description: "D", assignedFiles: [], priority: 1 },
			],
			estimatedComplexity: "low",
		})

		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockResolvedValue(responseWithoutMerge),
		} as any)

		const plan = await generatePlan("No merge needed", sampleModes, 2, sampleProviderSettings)

		expect(plan).not.toBeNull()
		expect(plan!.requiresMerge).toBe(false)
	})

	it("should default estimatedComplexity to 'medium' when not provided", async () => {
		const responseWithoutComplexity = JSON.stringify({
			tasks: [{ mode: "code", title: "T", description: "D", assignedFiles: [], priority: 1 }],
			requiresMerge: false,
		})

		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockResolvedValue(responseWithoutComplexity),
		} as any)

		const plan = await generatePlan("Default complexity", sampleModes, 2, sampleProviderSettings)

		expect(plan!.estimatedComplexity).toBe("medium")
	})

	it("should default task fields when missing from response", async () => {
		const responseWithMissing = JSON.stringify({
			tasks: [
				{}, // totally empty task object
			],
			requiresMerge: false,
			estimatedComplexity: "low",
		})

		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockResolvedValue(responseWithMissing),
		} as any)

		const plan = await generatePlan("Sparse task", sampleModes, 2, sampleProviderSettings)

		expect(plan).not.toBeNull()
		expect(plan!.tasks[0].mode).toBe("code")
		expect(plan!.tasks[0].title).toBe("Task 1")
		expect(plan!.tasks[0].description).toBe("")
		expect(plan!.tasks[0].assignedFiles).toEqual([])
		expect(plan!.tasks[0].priority).toBe(1)
	})

	it("should return null when completePrompt throws", async () => {
		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockRejectedValue(new Error("API failure")),
		} as any)

		const result = await generatePlan("Crash test", sampleModes, 2, sampleProviderSettings)
		expect(result).toBeNull()
	})
})
