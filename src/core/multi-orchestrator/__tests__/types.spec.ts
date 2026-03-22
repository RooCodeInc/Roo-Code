import {
	generateAgentId,
	createInitialAgentState,
	createInitialOrchestratorState,
	MULTI_ORCHESTRATOR_CONSTANTS,
	type PlannedTask,
	type AgentState,
	type OrchestratorState,
} from "../types"

describe("generateAgentId", () => {
	it("should return a string", () => {
		const id = generateAgentId()
		expect(typeof id).toBe("string")
	})

	it("should return an 8-character string", () => {
		const id = generateAgentId()
		expect(id).toHaveLength(8)
	})

	it("should return unique ids on successive calls", () => {
		const ids = new Set(Array.from({ length: 50 }, () => generateAgentId()))
		expect(ids.size).toBe(50)
	})

	it("should contain only hex characters and hyphens from UUID", () => {
		const id = generateAgentId()
		// First 8 chars of a UUID (xxxxxxxx) are hex only
		expect(id).toMatch(/^[0-9a-f]{8}$/)
	})
})

describe("createInitialAgentState", () => {
	const task: PlannedTask = {
		id: "test-id-1",
		mode: "code",
		title: "Implement feature X",
		description: "Write the code for feature X",
		assignedFiles: ["src/feature-x.ts"],
		priority: 1,
	}

	it("should set taskId from task.id", () => {
		const state = createInitialAgentState(task)
		expect(state.taskId).toBe("test-id-1")
	})

	it("should set mode from task.mode", () => {
		const state = createInitialAgentState(task)
		expect(state.mode).toBe("code")
	})

	it("should set title from task.title", () => {
		const state = createInitialAgentState(task)
		expect(state.title).toBe("Implement feature X")
	})

	it("should set status to 'pending'", () => {
		const state = createInitialAgentState(task)
		expect(state.status).toBe("pending")
	})

	it("should set providerId and panelId to empty strings", () => {
		const state = createInitialAgentState(task)
		expect(state.providerId).toBe("")
		expect(state.panelId).toBe("")
	})

	it("should set nullable fields to null", () => {
		const state = createInitialAgentState(task)
		expect(state.worktreePath).toBeNull()
		expect(state.worktreeBranch).toBeNull()
		expect(state.completionReport).toBeNull()
		expect(state.tokenUsage).toBeNull()
		expect(state.startedAt).toBeNull()
		expect(state.completedAt).toBeNull()
	})

	it("should return a fresh object each call", () => {
		const a = createInitialAgentState(task)
		const b = createInitialAgentState(task)
		expect(a).not.toBe(b)
		expect(a).toEqual(b)
	})
})

describe("createInitialOrchestratorState", () => {
	it("should return phase 'idle'", () => {
		const state = createInitialOrchestratorState()
		expect(state.phase).toBe("idle")
	})

	it("should return null plan", () => {
		const state = createInitialOrchestratorState()
		expect(state.plan).toBeNull()
	})

	it("should return empty agents array", () => {
		const state = createInitialOrchestratorState()
		expect(state.agents).toEqual([])
	})

	it("should return empty mergeResults array", () => {
		const state = createInitialOrchestratorState()
		expect(state.mergeResults).toEqual([])
	})

	it("should return null finalReport", () => {
		const state = createInitialOrchestratorState()
		expect(state.finalReport).toBeNull()
	})

	it("should return a fresh object each call", () => {
		const a = createInitialOrchestratorState()
		const b = createInitialOrchestratorState()
		expect(a).not.toBe(b)
		expect(a).toEqual(b)
	})
})

describe("MULTI_ORCHESTRATOR_CONSTANTS", () => {
	it("should have MAX_AGENTS of 6", () => {
		expect(MULTI_ORCHESTRATOR_CONSTANTS.MAX_AGENTS).toBe(6)
	})

	it("should have DEFAULT_MAX_AGENTS of 4", () => {
		expect(MULTI_ORCHESTRATOR_CONSTANTS.DEFAULT_MAX_AGENTS).toBe(4)
	})

	it("should have WORKTREE_PREFIX 'roo-multi-'", () => {
		expect(MULTI_ORCHESTRATOR_CONSTANTS.WORKTREE_PREFIX).toBe("roo-multi-")
	})

	it("should have BRANCH_PREFIX 'multi-orch/'", () => {
		expect(MULTI_ORCHESTRATOR_CONSTANTS.BRANCH_PREFIX).toBe("multi-orch/")
	})
})
