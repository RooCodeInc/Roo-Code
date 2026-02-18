/**
 * Design Invariant Audit Tests
 *
 * Each test group maps 1:1 to a numbered design invariant.
 * Every test uses REAL execution simulation — zero structural proofs.
 *
 * Design note: consecutiveMistakeCount is only INCREMENTED on rejection
 * in BaseTool.handle() — it is never reset on success. That reset
 * responsibility belongs to a higher-level loop, not the tool layer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as path from "path"
import { BaseTool, ToolCallbacks, SAFE_TOOLS } from "../../tools/BaseTool"
import { Task } from "../../task/Task"
import {
	isGovernedWorkspace,
	buildIntentContextXml,
	buildTraceXml,
	ACTIVE_INTENTS_PATH,
	MAX_TRACE_ENTRIES,
	type ActiveIntent,
	type IntentTraceEvent,
} from "../../context/activeIntents"
import type { ToolUse } from "../../../shared/tools"
import type { ToolName } from "@roo-code/types"

// ── Mock fs ───────────────────────────────────────────────────────────
vi.mock("fs", async () => {
	const actual = await vi.importActual("fs")
	return {
		...actual,
		existsSync: vi.fn(),
		promises: { readFile: vi.fn() },
	}
})
import * as fs from "fs"
const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>
const mockReadFile = fs.promises.readFile as ReturnType<typeof vi.fn>

// ── Concrete tool subclasses ──────────────────────────────────────────
class TestDestructiveTool extends BaseTool<"write_to_file"> {
	readonly name = "write_to_file" as const
	executeSpy = vi.fn()
	async execute(params: any, task: Task, callbacks: ToolCallbacks): Promise<void> {
		this.executeSpy(params, task, callbacks)
	}
}

class TestFailingTool extends BaseTool<"write_to_file"> {
	readonly name = "write_to_file" as const
	async execute(_params: any, _task: Task, _callbacks: ToolCallbacks): Promise<void> {
		throw new Error("disk full: cannot write file")
	}
}

class TestSafeTool extends BaseTool<"read_file"> {
	readonly name = "read_file" as const
	executeSpy = vi.fn()
	async execute(params: any, task: Task, callbacks: ToolCallbacks): Promise<void> {
		this.executeSpy(params, task, callbacks)
	}
}

// ── Fixtures ──────────────────────────────────────────────────────────
const GOVERNED_YAML = `intents:
  - id: "refactor-auth"
    goal: "Refactor authentication"
    status: "IN_PROGRESS"
    constraints:
      - "No breaking changes"
    scope:
      - "src/auth/**"
  - id: "done-task"
    goal: "Completed task"
    status: "COMPLETED"
    constraints: []
    scope: []
`

function createMockTask(overrides: Partial<any> = {}): any {
	return {
		cwd: "/test/workspace",
		consecutiveMistakeCount: 0,
		activeIntentId: undefined,
		activeIntentContext: undefined,
		intentTraceLog: [],
		toolUsage: {},
		recordToolUsage: vi.fn(),
		recordToolError: vi.fn(),
		sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
		...overrides,
	}
}

function createCallbacks() {
	return {
		pushToolResult: vi.fn(),
		handleError: vi.fn(),
		askApproval: vi.fn(),
	}
}

function makeBlock<T extends ToolName>(name: T, nativeArgs: any, partial = false): ToolUse<T> {
	return { type: "tool_use", name, params: {}, nativeArgs, partial } as ToolUse<T>
}

// ────────────────────────────────────────────────────────────────
// Invariant 1: Governed Mode Isolation
// ────────────────────────────────────────────────────────────────
describe("1. Governed Mode Isolation", () => {
	let tool: TestDestructiveTool

	beforeEach(() => {
		vi.clearAllMocks()
		tool = new TestDestructiveTool()
	})

	it("ungoverned workspace: destructive tool executes freely without intent", async () => {
		mockExistsSync.mockReturnValue(false)
		const task = createMockTask()
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }), cb)

		expect(tool.executeSpy).toHaveBeenCalledTimes(1)
		expect(cb.pushToolResult).not.toHaveBeenCalled()
		expect(task.recordToolError).not.toHaveBeenCalled()
	})

	it("governed workspace: destructive tool blocked without intent", async () => {
		mockExistsSync.mockReturnValue(true)
		const task = createMockTask()
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }), cb)

		expect(tool.executeSpy).not.toHaveBeenCalled()
		// #1: recordToolError called exactly once
		expect(task.recordToolError).toHaveBeenCalledTimes(1)
		expect(task.recordToolError).toHaveBeenCalledWith("write_to_file", expect.stringContaining("No active Intent"))
		// #2: recordToolUsage NOT called on rejection
		expect(task.recordToolUsage).not.toHaveBeenCalled()
		// #4: isGovernedWorkspace called with correct workspace-scoped path
		expect(mockExistsSync).toHaveBeenCalledWith(path.join(task.cwd, ACTIVE_INTENTS_PATH))
		// Structured error
		const parsed = JSON.parse(cb.pushToolResult.mock.calls[0][0])
		expect(parsed.status).toBe("error")
		expect(parsed.error).toContain("No active Intent selected")
	})
})

// ────────────────────────────────────────────────────────────────
// Invariant 2: SAFE Tool Boundary Integrity
// (Imports the REAL SAFE_TOOLS from BaseTool — not a copy)
// ────────────────────────────────────────────────────────────────
describe("2. SAFE Tool Boundary Integrity", () => {
	let safeTool: TestSafeTool

	beforeEach(() => {
		vi.clearAllMocks()
		safeTool = new TestSafeTool()
	})

	it("production SAFE_TOOLS includes all read-only tools", () => {
		for (const t of ["read_file", "search_files", "list_files", "codebase_search", "read_command_output"]) {
			expect(SAFE_TOOLS.has(t)).toBe(true)
		}
	})

	it("production SAFE_TOOLS includes all meta tools", () => {
		for (const t of [
			"ask_followup_question",
			"attempt_completion",
			"switch_mode",
			"new_task",
			"select_active_intent",
		]) {
			expect(SAFE_TOOLS.has(t)).toBe(true)
		}
	})

	it("destructive tools are NOT in production SAFE_TOOLS", () => {
		for (const t of ["write_to_file", "apply_diff", "execute_command", "browser_action"]) {
			expect(SAFE_TOOLS.has(t)).toBe(false)
		}
	})

	it("SAFE tool executes in governed workspace WITHOUT intent", async () => {
		mockExistsSync.mockReturnValue(true)
		const task = createMockTask()
		const cb = createCallbacks()

		await safeTool.handle(task, makeBlock("read_file", { path: "t.ts" }), cb)

		expect(safeTool.executeSpy).toHaveBeenCalledTimes(1)
		expect(cb.pushToolResult).not.toHaveBeenCalled()
		expect(task.recordToolError).not.toHaveBeenCalled()
	})
})

// ────────────────────────────────────────────────────────────────
// Invariant 3: Stale Intent Defense
// ────────────────────────────────────────────────────────────────
describe("3. Stale Intent Defense", () => {
	let tool: TestDestructiveTool

	beforeEach(() => {
		vi.clearAllMocks()
		tool = new TestDestructiveTool()
	})

	it("COMPLETED intent: full state clearing and governance reporting", async () => {
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const task = createMockTask({
			activeIntentId: "done-task",
			activeIntentContext: "<intent_context>old</intent_context>",
		})
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }), cb)

		// State cleared
		expect(task.activeIntentId).toBeUndefined()
		expect(task.activeIntentContext).toBeUndefined()
		// Trace NOT mutated
		expect(task.intentTraceLog).toHaveLength(0)
		// consecutiveMistakeCount incremented
		expect(task.consecutiveMistakeCount).toBe(1)
		// Tool NOT executed
		expect(tool.executeSpy).not.toHaveBeenCalled()
		// #1: recordToolError called exactly once
		expect(task.recordToolError).toHaveBeenCalledTimes(1)
		expect(task.recordToolError).toHaveBeenCalledWith("write_to_file", expect.stringContaining("COMPLETED"))
		// #2: recordToolUsage NOT called
		expect(task.recordToolUsage).not.toHaveBeenCalled()
		// Structured error with valid IDs
		const parsed = JSON.parse(cb.pushToolResult.mock.calls[0][0])
		expect(parsed.status).toBe("error")
		expect(parsed.error).toContain("COMPLETED")
		expect(parsed.error).toContain("refactor-auth")
	})

	it("removed intent: full state clearing and governance reporting", async () => {
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const task = createMockTask({
			activeIntentId: "deleted-intent",
			activeIntentContext: "<intent_context>stale</intent_context>",
		})
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }), cb)

		expect(task.activeIntentId).toBeUndefined()
		expect(task.activeIntentContext).toBeUndefined()
		expect(task.intentTraceLog).toHaveLength(0)
		expect(task.consecutiveMistakeCount).toBe(1)
		expect(tool.executeSpy).not.toHaveBeenCalled()
		// #1: recordToolError called exactly once
		expect(task.recordToolError).toHaveBeenCalledTimes(1)
		expect(task.recordToolError).toHaveBeenCalledWith("write_to_file", expect.stringContaining("no longer exists"))
		// #2: recordToolUsage NOT called
		expect(task.recordToolUsage).not.toHaveBeenCalled()
		// Structured error
		const parsed = JSON.parse(cb.pushToolResult.mock.calls[0][0])
		expect(parsed.status).toBe("error")
		expect(parsed.error).toContain("no longer exists")
		expect(parsed.error).toContain("refactor-auth")
	})

	it("valid IN_PROGRESS intent allows execution", async () => {
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const task = createMockTask({
			activeIntentId: "refactor-auth",
			activeIntentContext: "<intent_context>valid</intent_context>",
		})
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }), cb)

		expect(tool.executeSpy).toHaveBeenCalledTimes(1)
		expect(cb.pushToolResult).not.toHaveBeenCalled()
		expect(task.recordToolError).not.toHaveBeenCalled()
	})
})

// ────────────────────────────────────────────────────────────────
// Invariant 4: Trace Recording Discipline
// ────────────────────────────────────────────────────────────────
describe("4. Trace Recording Discipline", () => {
	beforeEach(() => vi.clearAllMocks())

	it("destructive tool records trace with all required fields and semantic summary", async () => {
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const tool = new TestDestructiveTool()
		const task = createMockTask({
			activeIntentId: "refactor-auth",
			activeIntentContext: "<intent_context>x</intent_context>",
		})

		await tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }), createCallbacks())

		expect(task.intentTraceLog).toHaveLength(1)
		const event = task.intentTraceLog[0]
		expect(event.toolName).toBe("write_to_file")
		expect(event.outcome).toBe("success")
		expect(event.intentId).toBe("refactor-auth")
		// #4: timestamp exists and is valid ISO
		expect(event.timestamp).toBeTruthy()
		expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp)
		// #9: summary contains the tool name (semantic, not just non-empty)
		expect(event.summary).toContain("write_to_file")
		expect(event.summary.length).toBeGreaterThan(0)
	})

	it("SAFE tool does NOT record trace even with active intent", async () => {
		mockExistsSync.mockReturnValue(true)
		const safeTool = new TestSafeTool()
		const task = createMockTask({
			activeIntentId: "refactor-auth",
			activeIntentContext: "<intent_context>x</intent_context>",
		})

		await safeTool.handle(task, makeBlock("read_file", { path: "t.ts" }), createCallbacks())

		expect(task.intentTraceLog).toHaveLength(0)
	})

	it("gatekeeper rejection does NOT record trace", async () => {
		mockExistsSync.mockReturnValue(true)
		const tool = new TestDestructiveTool()
		const task = createMockTask()

		await tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }), createCallbacks())

		expect(task.intentTraceLog).toHaveLength(0)
	})

	// #7: Trace guard includes isGovernedWorkspace()
	it("ungoverned mode: no trace recorded even if activeIntentId is set manually", async () => {
		mockExistsSync.mockReturnValue(false) // ungoverned
		const tool = new TestDestructiveTool()
		const task = createMockTask({
			activeIntentId: "refactor-auth", // manually set
		})

		await tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }), createCallbacks())

		expect(tool.executeSpy).toHaveBeenCalledTimes(1) // tool runs (ungoverned)
		expect(task.intentTraceLog).toHaveLength(0) // but NO trace
	})

	// #8: Intent exists on task but not in YAML → blocked, no trace
	it("intent set on task but absent from YAML: blocked, no trace", async () => {
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const tool = new TestDestructiveTool()
		const task = createMockTask({
			activeIntentId: "nonexistent-intent",
			activeIntentContext: "<intent_context>x</intent_context>",
		})
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }), cb)

		// Blocked by stale defense
		expect(tool.executeSpy).not.toHaveBeenCalled()
		// Intent cleared → trace guard fails (activeIntentId is undefined)
		expect(task.intentTraceLog).toHaveLength(0)
		expect(task.activeIntentId).toBeUndefined()
	})
})

// ────────────────────────────────────────────────────────────────
// Invariant 5: Intent-Scoped Trace Isolation
// ────────────────────────────────────────────────────────────────
describe("5. Intent-Scoped Trace Isolation", () => {
	it("trace events are tagged with active intentId at execution time", async () => {
		vi.clearAllMocks()
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const tool = new TestDestructiveTool()
		const task = createMockTask({
			activeIntentId: "refactor-auth",
			activeIntentContext: "<intent_context>x</intent_context>",
		})

		await tool.handle(task, makeBlock("write_to_file", { path: "a.ts", content: "x" }), createCallbacks())

		expect(task.intentTraceLog[0].intentId).toBe("refactor-auth")
	})

	it("filtered trace excludes cross-intent events in XML", () => {
		const traces: IntentTraceEvent[] = [
			{ toolName: "write_to_file", summary: "wrote", outcome: "success", timestamp: "T1", intentId: "intent-A" },
			{ toolName: "apply_diff", summary: "diffed", outcome: "success", timestamp: "T2", intentId: "intent-B" },
			{ toolName: "execute_command", summary: "ran", outcome: "error", timestamp: "T3", intentId: "intent-A" },
		]

		const filtered = traces.filter((e) => e.intentId === "intent-A")
		expect(filtered).toHaveLength(2)
		expect(filtered.every((e) => e.intentId === "intent-A")).toBe(true)

		const xml = buildIntentContextXml(
			{ id: "intent-A", goal: "g", status: "IN_PROGRESS", constraints: [], scope: [] },
			filtered,
		)
		expect(xml).toContain('tool="write_to_file"')
		expect(xml).toContain('tool="execute_command"')
		expect(xml).not.toContain('tool="apply_diff"')
	})
})

// ────────────────────────────────────────────────────────────────
// Invariant 6: Context Budget Control
// ────────────────────────────────────────────────────────────────
describe("6. Context Budget Control", () => {
	it("MAX_TRACE_ENTRIES equals 10", () => {
		expect(MAX_TRACE_ENTRIES).toBe(10)
	})

	it("buildTraceXml caps at MAX_TRACE_ENTRIES, keeps most recent", () => {
		const entries: IntentTraceEvent[] = Array.from({ length: 20 }, (_, i) => ({
			toolName: `tool_${i}`,
			summary: `action ${i}`,
			outcome: "success" as const,
			timestamp: `T${i}`,
			intentId: "x",
		}))

		const xml = buildTraceXml(entries)!
		const count = (xml.match(/<event /g) || []).length
		expect(count).toBe(10)
		expect(xml).toContain('tool="tool_19"')
		expect(xml).toContain('tool="tool_10"')
		expect(xml).not.toContain('tool="tool_9"')
		expect(xml).not.toContain('tool="tool_0"')
	})

	it("buildTraceXml returns null for empty/undefined", () => {
		expect(buildTraceXml(undefined)).toBeNull()
		expect(buildTraceXml([])).toBeNull()
	})
})

// ────────────────────────────────────────────────────────────────
// Invariant 7: Deterministic Pre-Hook Rebuild
// ────────────────────────────────────────────────────────────────
describe("7. Deterministic Pre-Hook Rebuild", () => {
	it("rebuilding with updated trace produces different XML", () => {
		const intent: ActiveIntent = {
			id: "test",
			goal: "g",
			status: "IN_PROGRESS",
			constraints: [],
			scope: [],
		}

		const xml1 = buildIntentContextXml(intent, [])
		expect(xml1).not.toContain("<trace>")

		const xml2 = buildIntentContextXml(intent, [
			{ toolName: "write_to_file", summary: "wrote", outcome: "success", timestamp: "T1", intentId: "test" },
		])
		expect(xml2).toContain("<trace>")
		expect(xml2).toContain('tool="write_to_file"')

		expect(xml1).not.toBe(xml2)
	})
})

// ────────────────────────────────────────────────────────────────
// Invariant 8: Structured Failure Semantics
// ────────────────────────────────────────────────────────────────
describe("8. Structured Failure Semantics", () => {
	let tool: TestDestructiveTool

	beforeEach(() => {
		vi.clearAllMocks()
		tool = new TestDestructiveTool()
	})

	it("missing intent → structured JSON with status, message, error, and recordToolError", async () => {
		mockExistsSync.mockReturnValue(true)
		const task = createMockTask()
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "x", content: "y" }), cb)

		const parsed = JSON.parse(cb.pushToolResult.mock.calls[0][0])
		expect(parsed.status).toBe("error")
		expect(parsed.message).toBe("The tool execution failed")
		expect(parsed.error).toContain("No active Intent selected")
		expect(parsed.error).toContain("select_active_intent")
		// #1: recordToolError called
		expect(task.recordToolError).toHaveBeenCalledTimes(1)
	})

	it("stale intent → structured JSON with valid IDs and recordToolError", async () => {
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const task = createMockTask({ activeIntentId: "done-task" })
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "x", content: "y" }), cb)

		const parsed = JSON.parse(cb.pushToolResult.mock.calls[0][0])
		expect(parsed.status).toBe("error")
		expect(parsed.message).toBe("The tool execution failed")
		expect(parsed.error).toContain("COMPLETED")
		expect(parsed.error).toContain("refactor-auth")
		expect(parsed.error).toContain("select_active_intent")
		expect(task.recordToolError).toHaveBeenCalledTimes(1)
	})

	it("removed intent → structured JSON with valid IDs and recordToolError", async () => {
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const task = createMockTask({ activeIntentId: "ghost-intent" })
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "x", content: "y" }), cb)

		const parsed = JSON.parse(cb.pushToolResult.mock.calls[0][0])
		expect(parsed.status).toBe("error")
		expect(parsed.error).toContain("no longer exists")
		expect(parsed.error).toContain("refactor-auth")
		expect(task.recordToolError).toHaveBeenCalledTimes(1)
	})
})

// ────────────────────────────────────────────────────────────────
// Invariant 9: Single Tool Result Guarantee
// ────────────────────────────────────────────────────────────────
describe("9. Single Tool Result Guarantee", () => {
	let tool: TestDestructiveTool

	beforeEach(() => {
		vi.clearAllMocks()
		tool = new TestDestructiveTool()
	})

	it("no-intent rejection: exactly one pushToolResult, no handleError", async () => {
		mockExistsSync.mockReturnValue(true)
		const task = createMockTask()
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "x", content: "y" }), cb)

		expect(cb.pushToolResult).toHaveBeenCalledTimes(1)
		expect(cb.handleError).not.toHaveBeenCalled()
	})

	it("stale-intent rejection: exactly one pushToolResult, no handleError", async () => {
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const task = createMockTask({ activeIntentId: "done-task" })
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "x", content: "y" }), cb)

		expect(cb.pushToolResult).toHaveBeenCalledTimes(1)
		expect(cb.handleError).not.toHaveBeenCalled()
	})

	it("successful execution: gatekeeper emits zero pushToolResult", async () => {
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const task = createMockTask({
			activeIntentId: "refactor-auth",
			activeIntentContext: "<intent_context>x</intent_context>",
		})
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "x", content: "y" }), cb)

		expect(cb.pushToolResult).toHaveBeenCalledTimes(0)
		expect(cb.handleError).not.toHaveBeenCalled()
		expect(tool.executeSpy).toHaveBeenCalledTimes(1)
	})
})

// ────────────────────────────────────────────────────────────────
// Invariant 10: Scope Containment
// ────────────────────────────────────────────────────────────────
describe("10. Scope Containment", () => {
	it("module source contains no references to out-of-scope concepts", async () => {
		const actualFs = await vi.importActual<typeof import("fs")>("fs")
		const sourcePath = path.resolve(__dirname, "../../context/activeIntents.ts")
		const source = actualFs.readFileSync(sourcePath, "utf-8")

		// #6: Expanded forbidden terms
		const forbidden = [
			"git",
			"ast",
			"dependency",
			"multiIntent",
			"graph",
			"repository",
			"commit",
			"branch",
			"diffGraph",
			"intentGraph",
		]
		for (const term of forbidden) {
			const regex = new RegExp(`\\b\\w*${term}\\w*\\s*[=(:]`, "i")
			expect(source).not.toMatch(regex)
		}
	})
})

// ────────────────────────────────────────────────────────────────
// #3 + #6: Failed Execution Trace — confirms handle() re-throws
// ────────────────────────────────────────────────────────────────
describe("Failed Execution Trace", () => {
	it("execute() throws → handle() re-throws, trace records outcome:'error' with semantic summary", async () => {
		vi.clearAllMocks()
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const tool = new TestFailingTool()
		const task = createMockTask({
			activeIntentId: "refactor-auth",
			activeIntentContext: "<intent_context>x</intent_context>",
		})
		const cb = createCallbacks()

		// #3: Confirms handle() is designed to re-throw after execute() failure.
		// The try/catch in handle() stores the error, re-throws, and the finally
		// block records the trace before propagation (BaseTool.ts lines 253-276).
		await expect(tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }), cb)).rejects.toThrow(
			"disk full",
		)

		// Trace still appended despite error
		expect(task.intentTraceLog).toHaveLength(1)
		const event = task.intentTraceLog[0]
		expect(event.outcome).toBe("error")
		expect(event.toolName).toBe("write_to_file")
		// #9: Summary contains error message fragment (semantic check)
		expect(event.summary).toContain("write_to_file")
		expect(event.summary).toContain("disk full")
		// #1: Summary is structured (tool + message), NOT raw error pass-through
		expect(event.summary).not.toBe("disk full: cannot write file")
		expect(event.intentId).toBe("refactor-auth")
		expect(event.timestamp).toBeTruthy()
	})
})

// ────────────────────────────────────────────────────────────────
// #4 + #9b: Governance Flip Test — also asserts trace suppression
// ────────────────────────────────────────────────────────────────
describe("Governance Flip Test", () => {
	it("enforcement and trace suppression change dynamically with governance", async () => {
		vi.clearAllMocks()
		const tool = new TestDestructiveTool()
		const task = createMockTask()
		const cb1 = createCallbacks()
		const cb2 = createCallbacks()

		// Step 1: Ungoverned — tool executes, no trace
		mockExistsSync.mockReturnValue(false)
		await tool.handle(task, makeBlock("write_to_file", { path: "a.ts", content: "x" }), cb1)
		expect(tool.executeSpy).toHaveBeenCalledTimes(1)
		expect(cb1.pushToolResult).not.toHaveBeenCalled()
		expect(task.intentTraceLog).toHaveLength(0)

		// Step 2: Flip to governed — same tool now blocked, no trace
		mockExistsSync.mockReturnValue(true)
		tool.executeSpy.mockClear()
		await tool.handle(task, makeBlock("write_to_file", { path: "b.ts", content: "y" }), cb2)
		expect(tool.executeSpy).not.toHaveBeenCalled()
		expect(cb2.pushToolResult).toHaveBeenCalledTimes(1)
		const parsed = JSON.parse(cb2.pushToolResult.mock.calls[0][0])
		expect(parsed.status).toBe("error")
		// #4: No trace recorded when blocked by gatekeeper
		expect(task.intentTraceLog).toHaveLength(0)
	})
})

// ────────────────────────────────────────────────────────────────
// #5: Partial Block Test
// ────────────────────────────────────────────────────────────────
describe("Partial Block Handling", () => {
	it("partial block: execute() NOT called, no trace, no pushToolResult", async () => {
		vi.clearAllMocks()
		mockExistsSync.mockReturnValue(true)

		const tool = new TestDestructiveTool()
		const task = createMockTask({
			activeIntentId: "refactor-auth",
			activeIntentContext: "<intent_context>x</intent_context>",
		})
		const cb = createCallbacks()

		// block.partial = true
		await tool.handle(task, makeBlock("write_to_file", { path: "t.ts", content: "x" }, true), cb)

		// execute() NOT called during partial
		expect(tool.executeSpy).not.toHaveBeenCalled()
		// No trace recorded
		expect(task.intentTraceLog).toHaveLength(0)
		// No tool result emitted
		expect(cb.pushToolResult).not.toHaveBeenCalled()
		// No error handling
		expect(cb.handleError).not.toHaveBeenCalled()
	})
})

// ────────────────────────────────────────────────────────────────
// #10: SAFE Tool Cannot Record Trace Even With Active Intent
// ────────────────────────────────────────────────────────────────
describe("SAFE Tool Trace Exclusion With Active Intent", () => {
	it("SAFE tool never appends to intentTraceLog even when intent active and governed", async () => {
		vi.clearAllMocks()
		mockExistsSync.mockReturnValue(true)

		const safeTool = new TestSafeTool()
		const task = createMockTask({
			activeIntentId: "refactor-auth",
			activeIntentContext: "<intent_context>x</intent_context>",
		})
		const cb = createCallbacks()

		// Execute 3 times
		await safeTool.handle(task, makeBlock("read_file", { path: "a.ts" }), cb)
		await safeTool.handle(task, makeBlock("read_file", { path: "b.ts" }), cb)
		await safeTool.handle(task, makeBlock("read_file", { path: "c.ts" }), cb)

		expect(safeTool.executeSpy).toHaveBeenCalledTimes(3)
		expect(task.intentTraceLog).toHaveLength(0) // zero trace events
	})
})

// ────────────────────────────────────────────────────────────────
// #2: Trace Length Stability — appends, does not overwrite
// ────────────────────────────────────────────────────────────────
describe("Trace Accumulation Stability", () => {
	it("destructive tool accumulates trace entries across multiple executions", async () => {
		vi.clearAllMocks()
		mockExistsSync.mockReturnValue(true)
		mockReadFile.mockResolvedValue(GOVERNED_YAML)

		const tool = new TestDestructiveTool()
		const task = createMockTask({
			activeIntentId: "refactor-auth",
			activeIntentContext: "<intent_context>x</intent_context>",
		})
		const cb = createCallbacks()

		await tool.handle(task, makeBlock("write_to_file", { path: "a.ts", content: "1" }), cb)
		await tool.handle(task, makeBlock("write_to_file", { path: "b.ts", content: "2" }), cb)
		await tool.handle(task, makeBlock("write_to_file", { path: "c.ts", content: "3" }), cb)

		// Trace appends — 3 executions → 3 entries
		expect(task.intentTraceLog).toHaveLength(3)
		expect(task.intentTraceLog[0].toolName).toBe("write_to_file")
		expect(task.intentTraceLog[1].toolName).toBe("write_to_file")
		expect(task.intentTraceLog[2].toolName).toBe("write_to_file")
		// Each has unique timestamp (or at least exists)
		for (const e of task.intentTraceLog) {
			expect(e.timestamp).toBeTruthy()
			expect(e.outcome).toBe("success")
		}
	})
})

// ────────────────────────────────────────────────────────────────
// #5: YAML Disappearance Mid-Session Edge Case
// ────────────────────────────────────────────────────────────────
describe("YAML Disappearance Mid-Session", () => {
	it("YAML disappears mid-session: tool executes ungoverned, no trace", async () => {
		vi.clearAllMocks()

		const tool = new TestDestructiveTool()
		const task = createMockTask({
			activeIntentId: "refactor-auth", // set earlier when governed
			activeIntentContext: "<intent_context>old</intent_context>",
		})
		const cb = createCallbacks()

		// YAML file is gone now → isGovernedWorkspace returns false
		mockExistsSync.mockReturnValue(false)

		await tool.handle(task, makeBlock("write_to_file", { path: "f.ts", content: "x" }), cb)

		// Executes freely (ungoverned)
		expect(tool.executeSpy).toHaveBeenCalledTimes(1)
		expect(cb.pushToolResult).not.toHaveBeenCalled()
		// No trace recorded (ungoverned, even though activeIntentId is set)
		expect(task.intentTraceLog).toHaveLength(0)
	})
})
