/**
 * E2E integration tests for multi-orchestrator subsystem.
 *
 * Tests full flows across types, plan-generator, report-aggregator,
 * merge-pipeline, agent-coordinator, and worktree-manager without
 * requiring VS Code API mocks.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "events"

// ---------------------------------------------------------------------------
// Mocks — hoisted above all imports
// ---------------------------------------------------------------------------

// Mock the API layer so we can feed fake LLM responses into generatePlan.
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(),
}))

// Deterministic agent IDs — counter reset in beforeEach.
let agentIdCounter = 0
vi.mock("../types", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../types")>()
	return {
		...actual,
		generateAgentId: () => {
			agentIdCounter++
			return `e2e-${String(agentIdCounter).padStart(3, "0")}`
		},
	}
})

// Mock child_process so MergePipeline never touches real git.
vi.mock("child_process", () => ({
	execSync: vi.fn(),
}))

// Mock @roo-code/core so WorktreeManager never touches real worktrees.
vi.mock("@roo-code/core", () => ({
	WorktreeService: vi.fn().mockImplementation(() => ({
		createWorktree: vi.fn().mockResolvedValue({ success: true }),
		deleteWorktree: vi.fn().mockResolvedValue({ success: true }),
	})),
}))

// ---------------------------------------------------------------------------
// Imports — AFTER mocks
// ---------------------------------------------------------------------------

import {
	createInitialAgentState,
	createInitialOrchestratorState,
	MULTI_ORCHESTRATOR_CONSTANTS,
	type PlannedTask,
	type AgentState,
	type MergeResult,
	type OrchestratorState,
	type OrchestratorPlan,
} from "../types"
import { generatePlan } from "../plan-generator"
import { aggregateReports } from "../report-aggregator"
import { MergePipeline } from "../merge-pipeline"
import { AgentCoordinator } from "../agent-coordinator"
import { MultiWorktreeManager } from "../worktree-manager"
import { buildApiHandler } from "../../../api"
import { execSync } from "child_process"
import { RooCodeEventName } from "@roo-code/types"
import type { TokenUsage, ToolUsage } from "@roo-code/types"

const mockBuildApiHandler = vi.mocked(buildApiHandler)
const mockExecSync = vi.mocked(execSync)

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Factory for a fully-populated PlannedTask. */
function makeTask(overrides: Partial<PlannedTask> = {}): PlannedTask {
	return {
		id: "task-1",
		mode: "code",
		title: "Implement widget",
		description: "Build the widget component end-to-end",
		assignedFiles: ["src/widget.ts"],
		priority: 1,
		...overrides,
	}
}

/** Factory for a fully-populated AgentState. */
function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
	return {
		taskId: "agent-1",
		providerId: "prov-1",
		panelId: "panel-1",
		worktreePath: "/tmp/roo-multi-agent-1",
		worktreeBranch: "multi-orch/agent-1",
		mode: "code",
		status: "completed",
		title: "Widget Agent",
		completionReport: "Implemented widget successfully.",
		tokenUsage: { input: 2400, output: 1100 },
		startedAt: 1700000000000,
		completedAt: 1700000045000,
		...overrides,
	}
}

/** Factory for a fully-populated MergeResult. */
function makeMerge(overrides: Partial<MergeResult> = {}): MergeResult {
	return {
		agentTaskId: "agent-1",
		branch: "multi-orch/agent-1",
		success: true,
		conflictsFound: 0,
		conflictsResolved: 0,
		filesChanged: ["src/widget.ts", "src/widget.test.ts"],
		...overrides,
	}
}

/** Minimal mock provider — EventEmitter + getCurrentTask stub. */
function createMockProvider() {
	const emitter = new EventEmitter()
	const mockStart = vi.fn()
	;(emitter as any).getCurrentTask = vi.fn().mockReturnValue({ start: mockStart })
	return { provider: emitter as any, mockStart }
}

/** Build a mock TokenUsage for completion events. */
function makeTokenUsage(input: number, output: number): TokenUsage {
	return { totalTokensIn: input, totalTokensOut: output, totalCost: 0.01 }
}

/** Build a mock ToolUsage for completion events. */
function makeToolUsage(): ToolUsage {
	return {}
}

// Reusable mode configs — excludes orchestrator slugs.
const sampleModes = [
	{ slug: "code", name: "Code", roleDefinition: "Write code", description: "Implementation", groups: ["read", "edit"] as any },
	{ slug: "architect", name: "Architect", roleDefinition: "Design", description: "Planning", groups: ["read"] as any },
	{ slug: "debug", name: "Debug", roleDefinition: "Fix bugs", description: "Debugging", groups: ["read"] as any },
	{ slug: "multi-orchestrator", name: "MO", roleDefinition: "Orch", description: "Multi", groups: [] as any },
	{ slug: "orchestrator", name: "Orch", roleDefinition: "Orch", description: "Single", groups: [] as any },
]

const sampleProvider = { apiProvider: "anthropic" as const, apiModelId: "claude-sonnet-4-20250514" }

// ═══════════════════════════════════════════════════════════════════════════
// 1. FULL TYPE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: Full type validation", () => {
	beforeEach(() => {
		agentIdCounter = 0
	})

	it("should create an OrchestratorState with all correct defaults and mutate through lifecycle phases", () => {
		const state: OrchestratorState = createInitialOrchestratorState()

		// Verify defaults
		expect(state.phase).toBe("idle")
		expect(state.plan).toBeNull()
		expect(state.agents).toEqual([])
		expect(state.mergeResults).toEqual([])
		expect(state.finalReport).toBeNull()

		// Simulate lifecycle mutation
		state.phase = "planning"
		const plan: OrchestratorPlan = {
			tasks: [makeTask({ id: "e2e-001" }), makeTask({ id: "e2e-002", mode: "architect", title: "Design DB" })],
			requiresMerge: true,
			estimatedComplexity: "high",
		}
		state.plan = plan

		expect(state.phase).toBe("planning")
		expect(state.plan.tasks).toHaveLength(2)
		expect(state.plan.estimatedComplexity).toBe("high")

		// Transition to spawning
		state.phase = "spawning"
		state.agents = plan.tasks.map(createInitialAgentState)

		expect(state.agents).toHaveLength(2)
		expect(state.agents[0].status).toBe("pending")
		expect(state.agents[0].taskId).toBe("e2e-001")
		expect(state.agents[1].mode).toBe("architect")

		// Transition to running
		state.phase = "running"
		state.agents[0].status = "running"
		state.agents[0].startedAt = Date.now()

		// Transition to merging
		state.phase = "merging"
		state.mergeResults = [makeMerge({ agentTaskId: "e2e-001" })]

		// Transition to reporting
		state.phase = "reporting"
		state.finalReport = "# Report\nAll done."

		// Transition to complete
		state.phase = "complete"

		expect(state.phase).toBe("complete")
		expect(state.finalReport).toContain("# Report")
		expect(state.mergeResults).toHaveLength(1)
	})

	it("should create a PlannedTask with all fields fully populated", () => {
		const task: PlannedTask = {
			id: "abc12345",
			mode: "debug",
			title: "Fix login race condition",
			description: "The login form double-submits under network lag.",
			assignedFiles: ["src/auth/login.ts", "src/auth/session.ts"],
			priority: 3,
		}

		expect(task.id).toBe("abc12345")
		expect(task.mode).toBe("debug")
		expect(task.assignedFiles).toHaveLength(2)
		expect(task.priority).toBe(3)
	})

	it("should create an AgentState from a PlannedTask with proper defaults", () => {
		const task = makeTask({ id: "e2e-001", mode: "architect", title: "Schema design" })
		const agent = createInitialAgentState(task)

		expect(agent.taskId).toBe("e2e-001")
		expect(agent.mode).toBe("architect")
		expect(agent.title).toBe("Schema design")
		expect(agent.status).toBe("pending")
		expect(agent.providerId).toBe("")
		expect(agent.panelId).toBe("")
		expect(agent.worktreePath).toBeNull()
		expect(agent.worktreeBranch).toBeNull()
		expect(agent.completionReport).toBeNull()
		expect(agent.tokenUsage).toBeNull()
		expect(agent.startedAt).toBeNull()
		expect(agent.completedAt).toBeNull()
	})

	it("should construct a MergeResult with conflict details", () => {
		const merge: MergeResult = {
			agentTaskId: "agent-x",
			branch: "multi-orch/agent-x",
			success: false,
			conflictsFound: 4,
			conflictsResolved: 2,
			filesChanged: ["README.md", "src/index.ts", "package.json", "tsconfig.json"],
		}

		expect(merge.success).toBe(false)
		expect(merge.conflictsFound).toBe(4)
		expect(merge.conflictsResolved).toBe(2)
		expect(merge.filesChanged).toHaveLength(4)
	})

	it("should ensure createInitialAgentState returns independent objects per call", () => {
		const task = makeTask()
		const a = createInitialAgentState(task)
		const b = createInitialAgentState(task)

		a.status = "running"
		a.startedAt = 9999

		expect(b.status).toBe("pending")
		expect(b.startedAt).toBeNull()
	})

	it("should verify MULTI_ORCHESTRATOR_CONSTANTS match expected values", () => {
		expect(MULTI_ORCHESTRATOR_CONSTANTS).toEqual({
			MAX_AGENTS: 6,
			DEFAULT_MAX_AGENTS: 4,
			WORKTREE_PREFIX: "roo-multi-",
			BRANCH_PREFIX: "multi-orch/",
		})
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. PLAN GENERATOR PARSING
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: Plan generator parsing", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		agentIdCounter = 0
	})

	it("should parse a valid multi-task plan from completePrompt", async () => {
		const llmResponse = JSON.stringify({
			tasks: [
				{ mode: "code", title: "Build REST API", description: "Create CRUD endpoints for users", assignedFiles: ["src/api/users.ts"], priority: 1 },
				{ mode: "code", title: "Write tests", description: "Unit tests for user API", assignedFiles: ["src/api/__tests__/users.test.ts"], priority: 2 },
				{ mode: "architect", title: "Document API", description: "Write OpenAPI spec", assignedFiles: ["docs/api.yaml"], priority: 3 },
			],
			requiresMerge: true,
			estimatedComplexity: "high",
		})

		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(llmResponse) } as any)

		const plan = await generatePlan("Build a user management API", sampleModes, 4, sampleProvider)

		expect(plan).not.toBeNull()
		expect(plan!.tasks).toHaveLength(3)
		expect(plan!.requiresMerge).toBe(true)
		expect(plan!.estimatedComplexity).toBe("high")

		// Verify generated IDs
		expect(plan!.tasks[0].id).toBe("e2e-001")
		expect(plan!.tasks[1].id).toBe("e2e-002")
		expect(plan!.tasks[2].id).toBe("e2e-003")

		// Verify task fields preserved
		expect(plan!.tasks[0].title).toBe("Build REST API")
		expect(plan!.tasks[0].mode).toBe("code")
		expect(plan!.tasks[0].assignedFiles).toEqual(["src/api/users.ts"])
		expect(plan!.tasks[2].mode).toBe("architect")
	})

	it("should handle empty tasks array gracefully", async () => {
		const llmResponse = JSON.stringify({
			tasks: [],
			requiresMerge: false,
			estimatedComplexity: "low",
		})

		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(llmResponse) } as any)

		const plan = await generatePlan("Do nothing", sampleModes, 2, sampleProvider)

		// Empty array is valid — tasks is an array
		expect(plan).not.toBeNull()
		expect(plan!.tasks).toHaveLength(0)
	})

	it("should return null for malformed JSON with trailing garbage", async () => {
		const garbage = '{"tasks": [{"mode": "code"}]} %%% extra stuff {{{'
		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(garbage) } as any)

		const plan = await generatePlan("Bad json", sampleModes, 2, sampleProvider)
		expect(plan).toBeNull()
	})

	it("should return null for completely empty response", async () => {
		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue("") } as any)

		const plan = await generatePlan("Empty response", sampleModes, 2, sampleProvider)
		expect(plan).toBeNull()
	})

	it("should return null when tasks field is an object instead of array", async () => {
		const bad = JSON.stringify({ tasks: { notAnArray: true }, requiresMerge: false })
		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(bad) } as any)

		const plan = await generatePlan("Bad shape", sampleModes, 2, sampleProvider)
		expect(plan).toBeNull()
	})

	it("should fill defaults for tasks with missing fields", async () => {
		const sparse = JSON.stringify({
			tasks: [
				{}, // no fields at all
				{ mode: "debug" }, // only mode
				{ title: "Custom title", priority: 99 }, // partial fields
			],
			requiresMerge: false,
			estimatedComplexity: "low",
		})

		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(sparse) } as any)

		const plan = await generatePlan("Sparse tasks", sampleModes, 4, sampleProvider)

		expect(plan).not.toBeNull()
		expect(plan!.tasks).toHaveLength(3)

		// Task 0: all defaults
		expect(plan!.tasks[0].mode).toBe("code")
		expect(plan!.tasks[0].title).toBe("Task 1")
		expect(plan!.tasks[0].description).toBe("")
		expect(plan!.tasks[0].assignedFiles).toEqual([])
		expect(plan!.tasks[0].priority).toBe(1)

		// Task 1: mode provided, rest defaulted
		expect(plan!.tasks[1].mode).toBe("debug")
		expect(plan!.tasks[1].title).toBe("Task 2")

		// Task 2: title and priority provided
		expect(plan!.tasks[2].title).toBe("Custom title")
		expect(plan!.tasks[2].priority).toBe(99)
		expect(plan!.tasks[2].mode).toBe("code") // default
	})

	it("should strip markdown fences with language tag and parse correctly", async () => {
		const fenced =
			"```json\n" +
			JSON.stringify({
				tasks: [{ mode: "code", title: "Fenced task", description: "From markdown", assignedFiles: [], priority: 1 }],
				requiresMerge: false,
				estimatedComplexity: "low",
			}) +
			"\n```"

		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(fenced) } as any)

		const plan = await generatePlan("Fenced response", sampleModes, 2, sampleProvider)

		expect(plan).not.toBeNull()
		expect(plan!.tasks[0].title).toBe("Fenced task")
	})

	it("should return null when response is wrapped in plain fences without json tag", async () => {
		// The parser regex `json?` requires at least "jso" — plain ``` fences are not stripped.
		const fenced =
			"```\n" +
			JSON.stringify({
				tasks: [{ mode: "architect", title: "No lang tag", description: "Plain fences", assignedFiles: [], priority: 1 }],
				requiresMerge: false,
				estimatedComplexity: "low",
			}) +
			"\n```"

		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(fenced) } as any)

		const plan = await generatePlan("Plain fences", sampleModes, 2, sampleProvider)

		// Current implementation only strips ```json, not plain ```
		expect(plan).toBeNull()
	})

	it("should infer requiresMerge from task modes when not provided", async () => {
		// Case 1: has code tasks → requiresMerge = true
		const withCode = JSON.stringify({
			tasks: [
				{ mode: "code", title: "Code task" },
				{ mode: "architect", title: "Design task" },
			],
		})
		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(withCode) } as any)
		const plan1 = await generatePlan("With code", sampleModes, 4, sampleProvider)
		expect(plan1!.requiresMerge).toBe(true)

		// Reset counter
		agentIdCounter = 0

		// Case 2: no code tasks → requiresMerge = false
		const noCode = JSON.stringify({
			tasks: [
				{ mode: "architect", title: "Design only" },
				{ mode: "ask", title: "Research" },
			],
		})
		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(noCode) } as any)
		const plan2 = await generatePlan("No code", sampleModes, 4, sampleProvider)
		expect(plan2!.requiresMerge).toBe(false)
	})

	it("should default estimatedComplexity to 'medium' when absent", async () => {
		const noComplexity = JSON.stringify({
			tasks: [{ mode: "code", title: "Simple" }],
			requiresMerge: true,
		})
		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(noComplexity) } as any)

		const plan = await generatePlan("No complexity field", sampleModes, 2, sampleProvider)
		expect(plan!.estimatedComplexity).toBe("medium")
	})

	it("should return null when handler does not support completePrompt", async () => {
		mockBuildApiHandler.mockReturnValue({ someOtherMethod: vi.fn() } as any)

		const plan = await generatePlan("No completePrompt", sampleModes, 2, sampleProvider)
		expect(plan).toBeNull()
	})

	it("should return null when completePrompt throws an error", async () => {
		mockBuildApiHandler.mockReturnValue({
			completePrompt: vi.fn().mockRejectedValue(new Error("Network timeout")),
		} as any)

		const plan = await generatePlan("Network error", sampleModes, 2, sampleProvider)
		expect(plan).toBeNull()
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. REPORT AGGREGATOR
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: Report aggregator with realistic data", () => {
	it("should generate a full report for mixed completed/failed agents with merge results", () => {
		const agents: AgentState[] = [
			makeAgent({
				taskId: "ag-api",
				title: "Build REST API",
				mode: "code",
				status: "completed",
				startedAt: 1700000000000,
				completedAt: 1700000032000,
				tokenUsage: { input: 5200, output: 2800 },
				completionReport: "Created 4 endpoints with validation.",
			}),
			makeAgent({
				taskId: "ag-tests",
				title: "Write Tests",
				mode: "code",
				status: "completed",
				startedAt: 1700000000000,
				completedAt: 1700000058000,
				tokenUsage: { input: 3100, output: 1900 },
				completionReport: "12 tests passing, 95% coverage.",
			}),
			makeAgent({
				taskId: "ag-docs",
				title: "Generate Docs",
				mode: "architect",
				status: "failed",
				startedAt: 1700000000000,
				completedAt: 1700000015000,
				tokenUsage: { input: 800, output: 200 },
				completionReport: null,
			}),
		]

		const mergeResults: MergeResult[] = [
			makeMerge({
				agentTaskId: "ag-api",
				branch: "multi-orch/ag-api",
				success: true,
				filesChanged: ["src/api/users.ts", "src/api/routes.ts"],
			}),
			makeMerge({
				agentTaskId: "ag-tests",
				branch: "multi-orch/ag-tests",
				success: false,
				conflictsFound: 2,
				conflictsResolved: 0,
				filesChanged: ["src/api/__tests__/users.test.ts"],
			}),
		]

		const report = aggregateReports(agents, mergeResults)

		// Header
		expect(report).toContain("# Multi-Orchestration Report")
		expect(report).toContain("**3 agents** executed in parallel.")

		// Agent Results
		expect(report).toContain("### ✅ Build REST API (code mode)")
		expect(report).toContain("**Duration:** 32s")
		expect(report).toContain("**Tokens:** 5200 in / 2800 out")
		expect(report).toContain("**Report:** Created 4 endpoints with validation.")

		expect(report).toContain("### ✅ Write Tests (code mode)")
		expect(report).toContain("**Duration:** 58s")

		expect(report).toContain("### ❌ Generate Docs (architect mode)")
		expect(report).toContain("**Duration:** 15s")

		// Merge Results
		expect(report).toContain("## Merge Results")
		expect(report).toContain("### ✅ Branch: multi-orch/ag-api")
		expect(report).toContain("### ⚠️ Branch: multi-orch/ag-tests")
		expect(report).toContain("**Conflicts found:** 2")

		// Summary
		expect(report).toContain("**Agents:** 2 completed, 1 failed")
		expect(report).toContain("**Merges:** 1 succeeded, 1 had conflicts")
	})

	it("should generate a clean report for all-success scenario without merge", () => {
		const agents: AgentState[] = [
			makeAgent({ taskId: "a1", title: "Research auth patterns", mode: "ask", status: "completed" }),
			makeAgent({ taskId: "a2", title: "Design schema", mode: "architect", status: "completed" }),
		]

		const report = aggregateReports(agents, [])

		expect(report).toContain("**2 agents** executed in parallel.")
		expect(report).not.toContain("## Merge Results")
		expect(report).not.toContain("**Merges:**")
		expect(report).toContain("**Agents:** 2 completed, 0 failed")
	})

	it("should handle agents with no token usage and no completion report", () => {
		const agents = [
			makeAgent({
				taskId: "bare",
				title: "Bare agent",
				tokenUsage: null,
				completionReport: null,
				startedAt: null,
				completedAt: null,
			}),
		]

		const report = aggregateReports(agents, [])

		expect(report).toContain("Bare agent")
		expect(report).toContain("**Duration:** unknown")
		expect(report).not.toContain("**Tokens:**")
		expect(report).not.toContain("**Report:**")
	})

	it("should handle all-failure scenario", () => {
		const agents = [
			makeAgent({ taskId: "f1", title: "Fail A", status: "failed" }),
			makeAgent({ taskId: "f2", title: "Fail B", status: "failed" }),
			makeAgent({ taskId: "f3", title: "Fail C", status: "failed" }),
		]

		const report = aggregateReports(agents, [])

		expect(report).toContain("**Agents:** 0 completed, 3 failed")
		// All should show ❌
		expect(report).toContain("### ❌ Fail A")
		expect(report).toContain("### ❌ Fail B")
		expect(report).toContain("### ❌ Fail C")
	})

	it("should produce valid output for zero agents", () => {
		const report = aggregateReports([], [])

		expect(report).toContain("**0 agents** executed in parallel.")
		expect(report).toContain("## Summary")
		expect(report).toContain("**Agents:** 0 completed, 0 failed")
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. MERGE PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: Merge pipeline", () => {
	let pipeline: MergePipeline

	beforeEach(() => {
		vi.clearAllMocks()
		pipeline = new MergePipeline("/workspace/project")
	})

	it("should merge multiple branches successfully", async () => {
		// Mock git diff for file lists
		mockExecSync.mockImplementation((cmd: string) => {
			const cmdStr = String(cmd)
			if (cmdStr.startsWith("git diff --name-only HEAD...")) {
				if (cmdStr.includes("branch-a")) return "src/a.ts\nsrc/a.test.ts\n"
				if (cmdStr.includes("branch-b")) return "src/b.ts\n"
				return ""
			}
			if (cmdStr.startsWith("git merge")) {
				return "" // success — no output
			}
			return ""
		})

		const agents: AgentState[] = [
			makeAgent({
				taskId: "task-a",
				worktreeBranch: "multi-orch/branch-a",
				status: "completed",
				startedAt: 1000,
			}),
			makeAgent({
				taskId: "task-b",
				worktreeBranch: "multi-orch/branch-b",
				status: "completed",
				startedAt: 2000,
			}),
		]

		const progressCalls: Array<{ id: string; result: MergeResult }> = []
		const results = await pipeline.mergeAll(agents, (id, result) => {
			progressCalls.push({ id, result })
		})

		expect(results).toHaveLength(2)
		expect(results[0].success).toBe(true)
		expect(results[0].agentTaskId).toBe("task-a")
		expect(results[0].filesChanged).toEqual(["src/a.ts", "src/a.test.ts"])
		expect(results[0].conflictsFound).toBe(0)

		expect(results[1].success).toBe(true)
		expect(results[1].agentTaskId).toBe("task-b")
		expect(results[1].filesChanged).toEqual(["src/b.ts"])

		// Progress callback fired for each
		expect(progressCalls).toHaveLength(2)
		expect(progressCalls[0].id).toBe("task-a")
		expect(progressCalls[1].id).toBe("task-b")
	})

	it("should handle merge conflict and abort cleanly", async () => {
		mockExecSync.mockImplementation((cmd: string) => {
			const cmdStr = String(cmd)
			if (cmdStr.startsWith("git diff --name-only HEAD...")) {
				return "src/shared.ts\nsrc/config.ts\n"
			}
			if (cmdStr.startsWith("git merge --no-ff")) {
				throw new Error("CONFLICT: Merge conflict in src/shared.ts")
			}
			if (cmdStr === "git diff --name-only --diff-filter=U") {
				return "src/shared.ts\n"
			}
			if (cmdStr === "git merge --abort") {
				return ""
			}
			return ""
		})

		const agents = [
			makeAgent({
				taskId: "conflict-agent",
				worktreeBranch: "multi-orch/conflict-branch",
				status: "completed",
				startedAt: 1000,
			}),
		]

		const results = await pipeline.mergeAll(agents, () => {})

		expect(results).toHaveLength(1)
		expect(results[0].success).toBe(false)
		expect(results[0].conflictsFound).toBe(1)
		expect(results[0].conflictsResolved).toBe(0)
		expect(results[0].filesChanged).toEqual(["src/shared.ts", "src/config.ts"])
	})

	it("should fall back to git reset --hard when merge --abort fails", async () => {
		let abortCalled = false
		let resetCalled = false

		mockExecSync.mockImplementation((cmd: string) => {
			const cmdStr = String(cmd)
			if (cmdStr.startsWith("git diff --name-only HEAD...")) {
				return "src/x.ts\n"
			}
			if (cmdStr.startsWith("git merge --no-ff")) {
				throw new Error("Merge conflict")
			}
			if (cmdStr === "git diff --name-only --diff-filter=U") {
				return "src/x.ts\n"
			}
			if (cmdStr === "git merge --abort") {
				abortCalled = true
				throw new Error("Cannot abort — no merge in progress")
			}
			if (cmdStr === "git reset --hard HEAD") {
				resetCalled = true
				return ""
			}
			return ""
		})

		const agents = [
			makeAgent({ taskId: "fallback", worktreeBranch: "multi-orch/fallback", status: "completed", startedAt: 1000 }),
		]

		const results = await pipeline.mergeAll(agents, () => {})

		expect(results[0].success).toBe(false)
		expect(abortCalled).toBe(true)
		expect(resetCalled).toBe(true)
	})

	it("should skip agents without worktreeBranch", async () => {
		const agents = [
			makeAgent({ taskId: "no-branch", worktreeBranch: null, status: "completed", startedAt: 1000 }),
			makeAgent({ taskId: "has-branch", worktreeBranch: "multi-orch/has-branch", status: "completed", startedAt: 2000 }),
		]

		mockExecSync.mockImplementation((cmd: string) => {
			const cmdStr = String(cmd)
			if (cmdStr.includes("git diff --name-only HEAD...")) return "src/file.ts\n"
			if (cmdStr.includes("git merge")) return ""
			return ""
		})

		const results = await pipeline.mergeAll(agents, () => {})

		expect(results).toHaveLength(1)
		expect(results[0].agentTaskId).toBe("has-branch")
	})

	it("should skip agents that are not completed", async () => {
		const agents = [
			makeAgent({ taskId: "failed-agent", worktreeBranch: "multi-orch/failed", status: "failed", startedAt: 1000 }),
			makeAgent({ taskId: "running-agent", worktreeBranch: "multi-orch/running", status: "running", startedAt: 500 }),
			makeAgent({ taskId: "good-agent", worktreeBranch: "multi-orch/good", status: "completed", startedAt: 2000 }),
		]

		mockExecSync.mockImplementation(() => "")

		const results = await pipeline.mergeAll(agents, () => {})

		expect(results).toHaveLength(1)
		expect(results[0].agentTaskId).toBe("good-agent")
	})

	it("should merge in startedAt order (earliest first)", async () => {
		const mergeOrder: string[] = []

		mockExecSync.mockImplementation((cmd: string) => {
			const cmdStr = String(cmd)
			if (cmdStr.startsWith("git merge --no-ff")) {
				// Extract branch from command
				const match = cmdStr.match(/"([^"]+)"/)
				if (match) mergeOrder.push(match[1])
			}
			return ""
		})

		const agents = [
			makeAgent({ taskId: "late", worktreeBranch: "multi-orch/late", status: "completed", startedAt: 5000 }),
			makeAgent({ taskId: "early", worktreeBranch: "multi-orch/early", status: "completed", startedAt: 1000 }),
			makeAgent({ taskId: "mid", worktreeBranch: "multi-orch/mid", status: "completed", startedAt: 3000 }),
		]

		await pipeline.mergeAll(agents, () => {})

		expect(mergeOrder).toEqual(["multi-orch/early", "multi-orch/mid", "multi-orch/late"])
	})

	it("should return a safe result when getFilesChanged throws", async () => {
		mockExecSync.mockImplementation((cmd: string) => {
			const cmdStr = String(cmd)
			if (cmdStr.startsWith("git diff --name-only HEAD...")) {
				throw new Error("fatal: bad object HEAD")
			}
			if (cmdStr.startsWith("git merge")) return ""
			return ""
		})

		const agents = [
			makeAgent({ taskId: "bad-diff", worktreeBranch: "multi-orch/bad-diff", status: "completed", startedAt: 1000 }),
		]

		const results = await pipeline.mergeAll(agents, () => {})

		expect(results).toHaveLength(1)
		expect(results[0].success).toBe(true)
		expect(results[0].filesChanged).toEqual([])
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. AGENT COORDINATOR
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: Agent coordinator", () => {
	let coordinator: AgentCoordinator

	beforeEach(() => {
		coordinator = new AgentCoordinator()
	})

	it("should register agents and track initial state", () => {
		const agent1 = createInitialAgentState(makeTask({ id: "t1", title: "Task 1" }))
		const agent2 = createInitialAgentState(makeTask({ id: "t2", title: "Task 2" }))
		const { provider: prov1 } = createMockProvider()
		const { provider: prov2 } = createMockProvider()

		coordinator.registerAgent(agent1, prov1)
		coordinator.registerAgent(agent2, prov2)

		expect(coordinator.totalAgents).toBe(2)
		expect(coordinator.completedAgents).toBe(0)
		expect(coordinator.allComplete()).toBe(false)

		const states = coordinator.getStates()
		expect(states).toHaveLength(2)
		expect(states[0].status).toBe("pending")
		expect(states[1].status).toBe("pending")
	})

	it("should look up individual agent state by taskId", () => {
		const agent = createInitialAgentState(makeTask({ id: "lookup-me" }))
		const { provider } = createMockProvider()

		coordinator.registerAgent(agent, provider)

		expect(coordinator.getState("lookup-me")).toBeDefined()
		expect(coordinator.getState("lookup-me")!.title).toBe("Implement widget")
		expect(coordinator.getState("nonexistent")).toBeUndefined()
	})

	it("should transition agent to completed when TaskCompleted fires", () => {
		const agent = createInitialAgentState(makeTask({ id: "comp-1" }))
		const { provider } = createMockProvider()

		coordinator.registerAgent(agent, provider)

		const completedSpy = vi.fn()
		coordinator.on("agentCompleted", completedSpy)

		// Simulate provider emitting TaskCompleted
		provider.emit(
			RooCodeEventName.TaskCompleted,
			"comp-1",
			makeTokenUsage(3000, 1500),
			makeToolUsage(),
		)

		const state = coordinator.getState("comp-1")!
		expect(state.status).toBe("completed")
		expect(state.completedAt).toBeTypeOf("number")
		expect(state.tokenUsage).toEqual({ input: 3000, output: 1500 })

		expect(completedSpy).toHaveBeenCalledWith("comp-1")
		expect(coordinator.completedAgents).toBe(1)
	})

	it("should transition agent to failed when TaskAborted fires", () => {
		const agent = createInitialAgentState(makeTask({ id: "fail-1" }))
		const { provider } = createMockProvider()

		coordinator.registerAgent(agent, provider)

		const failedSpy = vi.fn()
		coordinator.on("agentFailed", failedSpy)

		// Simulate provider emitting TaskAborted
		provider.emit(RooCodeEventName.TaskAborted, "fail-1")

		const state = coordinator.getState("fail-1")!
		expect(state.status).toBe("failed")
		expect(state.completedAt).toBeTypeOf("number")

		expect(failedSpy).toHaveBeenCalledWith("fail-1")
		expect(coordinator.completedAgents).toBe(1)
	})

	it("should emit allCompleted when last agent finishes", () => {
		const agent1 = createInitialAgentState(makeTask({ id: "ac-1" }))
		const agent2 = createInitialAgentState(makeTask({ id: "ac-2" }))
		const { provider: prov1 } = createMockProvider()
		const { provider: prov2 } = createMockProvider()

		coordinator.registerAgent(agent1, prov1)
		coordinator.registerAgent(agent2, prov2)

		const allCompleteSpy = vi.fn()
		coordinator.on("allCompleted", allCompleteSpy)

		// First agent completes — allCompleted should NOT fire yet
		prov1.emit(RooCodeEventName.TaskCompleted, "ac-1", makeTokenUsage(100, 50), makeToolUsage())
		expect(allCompleteSpy).not.toHaveBeenCalled()
		expect(coordinator.allComplete()).toBe(false)

		// Second agent fails — now allCompleted fires
		prov2.emit(RooCodeEventName.TaskAborted, "ac-2")
		expect(allCompleteSpy).toHaveBeenCalledTimes(1)
		expect(coordinator.allComplete()).toBe(true)
	})

	it("should resolve waitForAll() immediately when already complete", async () => {
		const agent = createInitialAgentState(makeTask({ id: "instant" }))
		const { provider } = createMockProvider()

		coordinator.registerAgent(agent, provider)

		// Complete the agent first
		provider.emit(RooCodeEventName.TaskCompleted, "instant", makeTokenUsage(10, 5), makeToolUsage())

		// waitForAll should resolve immediately
		const start = Date.now()
		await coordinator.waitForAll()
		const elapsed = Date.now() - start
		expect(elapsed).toBeLessThan(50) // near-instant
	})

	it("should resolve waitForAll() when agents complete after the call", async () => {
		const agent1 = createInitialAgentState(makeTask({ id: "w1" }))
		const agent2 = createInitialAgentState(makeTask({ id: "w2" }))
		const { provider: prov1 } = createMockProvider()
		const { provider: prov2 } = createMockProvider()

		coordinator.registerAgent(agent1, prov1)
		coordinator.registerAgent(agent2, prov2)

		// Start waiting
		const waitPromise = coordinator.waitForAll()

		// Complete agents asynchronously
		setTimeout(() => {
			prov1.emit(RooCodeEventName.TaskCompleted, "w1", makeTokenUsage(10, 5), makeToolUsage())
		}, 10)
		setTimeout(() => {
			prov2.emit(RooCodeEventName.TaskCompleted, "w2", makeTokenUsage(20, 10), makeToolUsage())
		}, 20)

		await waitPromise

		expect(coordinator.allComplete()).toBe(true)
		expect(coordinator.completedAgents).toBe(2)
	})

	it("should handle mixed completions and failures correctly", () => {
		const agents = [
			createInitialAgentState(makeTask({ id: "m1" })),
			createInitialAgentState(makeTask({ id: "m2" })),
			createInitialAgentState(makeTask({ id: "m3" })),
		]

		const providers = agents.map(() => createMockProvider())

		agents.forEach((agent, i) => coordinator.registerAgent(agent, providers[i].provider))

		// m1 completes, m2 fails, m3 completes
		providers[0].provider.emit(RooCodeEventName.TaskCompleted, "m1", makeTokenUsage(100, 50), makeToolUsage())
		providers[1].provider.emit(RooCodeEventName.TaskAborted, "m2")
		providers[2].provider.emit(RooCodeEventName.TaskCompleted, "m3", makeTokenUsage(200, 100), makeToolUsage())

		const states = coordinator.getStates()
		const completed = states.filter((s) => s.status === "completed")
		const failed = states.filter((s) => s.status === "failed")

		expect(completed).toHaveLength(2)
		expect(failed).toHaveLength(1)
		expect(coordinator.allComplete()).toBe(true)
		expect(coordinator.totalAgents).toBe(3)
		expect(coordinator.completedAgents).toBe(3)
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. WORKTREE MANAGER
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: WorktreeManager", () => {
	let manager: MultiWorktreeManager

	beforeEach(() => {
		vi.clearAllMocks()
		manager = new MultiWorktreeManager("/home/user/project")
	})

	it("should generate branch names using BRANCH_PREFIX constant", () => {
		const branch = manager.getBranchName("abc123")
		expect(branch).toBe(`${MULTI_ORCHESTRATOR_CONSTANTS.BRANCH_PREFIX}abc123`)
		expect(branch).toBe("multi-orch/abc123")
	})

	it("should create worktrees for multiple agents with correct paths and branches", async () => {
		const agentIds = ["agent-a", "agent-b", "agent-c"]

		const worktrees = await manager.createWorktrees(agentIds)

		expect(worktrees.size).toBe(3)

		// Verify agent-a
		const wtA = worktrees.get("agent-a")!
		expect(wtA.agentId).toBe("agent-a")
		expect(wtA.branch).toBe("multi-orch/agent-a")
		expect(wtA.path).toContain("roo-multi-agent-a")

		// Verify agent-b
		const wtB = worktrees.get("agent-b")!
		expect(wtB.branch).toBe("multi-orch/agent-b")
		expect(wtB.path).toContain("roo-multi-agent-b")

		// Verify agent-c
		const wtC = worktrees.get("agent-c")!
		expect(wtC.branch).toBe("multi-orch/agent-c")
	})

	it("should use WORKTREE_PREFIX in the directory path", async () => {
		await manager.createWorktrees(["test-id"])

		const wt = manager.getWorktree("test-id")!
		expect(wt.path).toContain(MULTI_ORCHESTRATOR_CONSTANTS.WORKTREE_PREFIX)
		expect(wt.path).toMatch(/roo-multi-test-id$/)
	})

	it("should place worktree directories as siblings of the workspace", async () => {
		// workspace = /home/user/project
		// worktree should be /home/user/roo-multi-<id>
		await manager.createWorktrees(["sibling"])

		const wt = manager.getWorktree("sibling")!
		expect(wt.path).toBe("/home/user/roo-multi-sibling")
	})

	it("should retrieve individual worktree info via getWorktree", async () => {
		await manager.createWorktrees(["x", "y"])

		expect(manager.getWorktree("x")).toBeDefined()
		expect(manager.getWorktree("y")).toBeDefined()
		expect(manager.getWorktree("z")).toBeUndefined()
	})

	it("should return all worktrees via getAllWorktrees", async () => {
		await manager.createWorktrees(["p", "q", "r"])

		const all = manager.getAllWorktrees()
		expect(all).toHaveLength(3)

		const ids = all.map((w) => w.agentId).sort()
		expect(ids).toEqual(["p", "q", "r"])
	})

	it("should cleanup all worktrees on cleanupWorktrees", async () => {
		await manager.createWorktrees(["c1", "c2"])
		expect(manager.getAllWorktrees()).toHaveLength(2)

		await manager.cleanupWorktrees()
		expect(manager.getAllWorktrees()).toHaveLength(0)
	})

	it("should throw when WorktreeService.createWorktree fails", async () => {
		// This test must come after cleanup to avoid polluting the shared mock.
		const { WorktreeService } = await import("@roo-code/core")
		const mockCreate = vi.fn().mockResolvedValue({ success: false, message: "Branch already exists" })
		vi.mocked(WorktreeService).mockImplementation(
			() => ({ createWorktree: mockCreate, deleteWorktree: vi.fn() }) as any,
		)

		const failManager = new MultiWorktreeManager("/workspace")

		await expect(failManager.createWorktrees(["bad-branch"])).rejects.toThrow("Failed to create worktree")
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. CROSS-MODULE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: Cross-module integration", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		agentIdCounter = 0
	})

	it("should flow from plan generation through agent state creation to report aggregation", async () => {
		// Step 1: Generate a plan
		const llmResponse = JSON.stringify({
			tasks: [
				{ mode: "code", title: "Implement auth", description: "Build JWT auth", assignedFiles: ["src/auth.ts"], priority: 1 },
				{ mode: "code", title: "Implement API", description: "Build REST layer", assignedFiles: ["src/api.ts"], priority: 2 },
			],
			requiresMerge: true,
			estimatedComplexity: "medium",
		})
		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(llmResponse) } as any)

		const plan = await generatePlan("Build auth + API", sampleModes, 4, sampleProvider)
		expect(plan).not.toBeNull()
		expect(plan!.tasks).toHaveLength(2)

		// Step 2: Create agent states from the plan
		const agentStates = plan!.tasks.map((task) => {
			const state = createInitialAgentState(task)
			// Simulate the orchestrator assigning worktree info
			state.worktreeBranch = `multi-orch/${task.id}`
			state.worktreePath = `/tmp/roo-multi-${task.id}`
			return state
		})

		expect(agentStates[0].taskId).toBe("e2e-001")
		expect(agentStates[0].worktreeBranch).toBe("multi-orch/e2e-001")
		expect(agentStates[1].taskId).toBe("e2e-002")

		// Step 3: Simulate agents completing
		agentStates[0].status = "completed"
		agentStates[0].startedAt = 1700000000000
		agentStates[0].completedAt = 1700000025000
		agentStates[0].tokenUsage = { input: 4000, output: 2000 }
		agentStates[0].completionReport = "Auth system implemented with JWT."

		agentStates[1].status = "failed"
		agentStates[1].startedAt = 1700000000000
		agentStates[1].completedAt = 1700000010000
		agentStates[1].tokenUsage = { input: 1200, output: 300 }

		// Step 4: Simulate merge results
		const mergeResults: MergeResult[] = [
			{
				agentTaskId: "e2e-001",
				branch: "multi-orch/e2e-001",
				success: true,
				conflictsFound: 0,
				conflictsResolved: 0,
				filesChanged: ["src/auth.ts", "src/auth.test.ts"],
			},
		]

		// Step 5: Generate the report
		const report = aggregateReports(agentStates, mergeResults)

		expect(report).toContain("**2 agents** executed in parallel.")
		expect(report).toContain("### ✅ Implement auth (code mode)")
		expect(report).toContain("### ❌ Implement API (code mode)")
		expect(report).toContain("**Duration:** 25s")
		expect(report).toContain("**Report:** Auth system implemented with JWT.")
		expect(report).toContain("**Agents:** 1 completed, 1 failed")
		expect(report).toContain("**Merges:** 1 succeeded, 0 had conflicts")
	})

	it("should wire coordinator events through to completion tracking", async () => {
		// Create two tasks from a plan
		const tasks = [
			makeTask({ id: "wire-1", title: "Wire Task A" }),
			makeTask({ id: "wire-2", title: "Wire Task B" }),
		]

		const agents = tasks.map(createInitialAgentState)
		const coordinator = new AgentCoordinator()
		const providers = tasks.map(() => createMockProvider())

		// Register agents
		agents.forEach((agent, i) => coordinator.registerAgent(agent, providers[i].provider))

		// Start waiting for all
		const waitPromise = coordinator.waitForAll()

		// Simulate completions
		providers[0].provider.emit(
			RooCodeEventName.TaskCompleted,
			"wire-1",
			makeTokenUsage(500, 250),
			makeToolUsage(),
		)
		providers[1].provider.emit(
			RooCodeEventName.TaskCompleted,
			"wire-2",
			makeTokenUsage(800, 400),
			makeToolUsage(),
		)

		await waitPromise

		// Now aggregate from coordinator's states
		const finalStates = coordinator.getStates()
		const report = aggregateReports(finalStates, [])

		expect(report).toContain("**2 agents** executed in parallel.")
		expect(report).toContain("### ✅ Wire Task A")
		expect(report).toContain("### ✅ Wire Task B")
		expect(report).toContain("**Tokens:** 500 in / 250 out")
		expect(report).toContain("**Tokens:** 800 in / 400 out")
		expect(report).toContain("**Agents:** 2 completed, 0 failed")
	})

	it("should validate OrchestratorState through a complete lifecycle", async () => {
		// 1. Start idle
		const state = createInitialOrchestratorState()
		expect(state.phase).toBe("idle")

		// 2. Generate plan
		state.phase = "planning"
		const llmResponse = JSON.stringify({
			tasks: [
				{ mode: "code", title: "Feature A", description: "Build feature A" },
				{ mode: "debug", title: "Fix Bug B", description: "Debug and fix B" },
				{ mode: "architect", title: "Design C", description: "Architecture for C" },
			],
			requiresMerge: true,
			estimatedComplexity: "high",
		})
		mockBuildApiHandler.mockReturnValue({ completePrompt: vi.fn().mockResolvedValue(llmResponse) } as any)
		const plan = await generatePlan("Complex project", sampleModes, 4, sampleProvider)
		state.plan = plan

		expect(state.plan).not.toBeNull()
		expect(state.plan!.tasks).toHaveLength(3)

		// 3. Spawn agents
		state.phase = "spawning"
		state.agents = state.plan!.tasks.map(createInitialAgentState)
		expect(state.agents).toHaveLength(3)
		expect(state.agents.every((a) => a.status === "pending")).toBe(true)

		// 4. Run agents
		state.phase = "running"
		const now = Date.now()
		state.agents.forEach((a) => {
			a.status = "running"
			a.startedAt = now
		})

		// Simulate completion
		state.agents[0].status = "completed"
		state.agents[0].completedAt = now + 20000
		state.agents[0].completionReport = "Feature A done."
		state.agents[0].tokenUsage = { input: 3000, output: 1500 }

		state.agents[1].status = "completed"
		state.agents[1].completedAt = now + 35000
		state.agents[1].completionReport = "Bug B fixed."
		state.agents[1].tokenUsage = { input: 2000, output: 1000 }

		state.agents[2].status = "failed"
		state.agents[2].completedAt = now + 8000

		// 5. Merge
		state.phase = "merging"
		state.mergeResults = [
			makeMerge({ agentTaskId: state.agents[0].taskId, success: true, filesChanged: ["src/a.ts"] }),
			makeMerge({ agentTaskId: state.agents[1].taskId, success: true, filesChanged: ["src/b.ts"] }),
		]

		// 6. Report
		state.phase = "reporting"
		state.finalReport = aggregateReports(state.agents, state.mergeResults)

		expect(state.finalReport).toContain("**3 agents** executed in parallel.")
		expect(state.finalReport).toContain("**Agents:** 2 completed, 1 failed")
		expect(state.finalReport).toContain("**Merges:** 2 succeeded, 0 had conflicts")

		// 7. Complete
		state.phase = "complete"
		expect(state.phase).toBe("complete")
		expect(state.finalReport).toBeTruthy()
	})
})
