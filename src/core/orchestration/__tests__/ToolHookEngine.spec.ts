import fs from "fs/promises"
import os from "os"
import path from "path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	markOrchestrationTurnStart,
	runOrchestrationPostToolHook,
	runOrchestrationPreToolHook,
	selectActiveIntentForTask,
} from "../ToolHookEngine"
import { collectAstAttributionForRange } from "../AstAttribution"

vi.mock("../AstAttribution", () => ({
	collectAstAttributionForRange: vi.fn(),
}))

describe("ToolHookEngine orchestration", () => {
	let workspaceRoot: string
	let task: any

	beforeEach(async () => {
		workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "roo-orchestration-"))
		await fs.mkdir(path.join(workspaceRoot, ".orchestration"), { recursive: true })
		await fs.mkdir(path.join(workspaceRoot, "src"), { recursive: true })

		await fs.writeFile(
			path.join(workspaceRoot, ".orchestration", "active_intents.yaml"),
			`active_intents:
  - id: INT-001
    name: Test intent
    status: active
    owned_scope:
      - src/**
    constraints: []
    acceptance_criteria: []
`,
			"utf-8",
		)

		task = { cwd: workspaceRoot }
		markOrchestrationTurnStart(task)
		vi.mocked(collectAstAttributionForRange).mockResolvedValue({ status: "fallback", nodes: [] })
	})

	afterEach(async () => {
		await fs.rm(workspaceRoot, { recursive: true, force: true })
	})

	it("blocks mcp_tool_use mutation without active intent", async () => {
		const askApproval = vi.fn().mockResolvedValue(true)
		const result = await runOrchestrationPreToolHook({
			task,
			toolName: "use_mcp_tool",
			toolOrigin: "mcp_dynamic",
			mcpServerName: "figma",
			mcpToolName: "get_node",
			toolArgs: {
				server_name: "figma",
				tool_name: "get_node",
				arguments: {},
			},
			askApproval,
		})

		expect(result.blocked).toBe(true)
		expect(result.errorResult).toContain(`"type":"intent_required"`)
		expect(askApproval).not.toHaveBeenCalled()
	})

	it("enforces approval for mcp_tool_use after intent selection", async () => {
		const selected = await selectActiveIntentForTask(task, "INT-001")
		expect(selected.ok).toBe(true)

		const askApproval = vi.fn().mockResolvedValue(true)
		const result = await runOrchestrationPreToolHook({
			task,
			toolName: "use_mcp_tool",
			toolOrigin: "mcp_dynamic",
			mcpServerName: "figma",
			mcpToolName: "get_node",
			toolArgs: {
				server_name: "figma",
				tool_name: "get_node",
				arguments: {},
			},
			askApproval,
		})

		expect(result.blocked).toBe(false)
		expect(result.preApproved).toBe(true)
		expect(askApproval).toHaveBeenCalledTimes(1)
	})

	it("treats execute_command as SAFE only when every command segment is allowlisted", async () => {
		await fs.writeFile(
			path.join(workspaceRoot, ".orchestration", "hook_policy.yaml"),
			`command:
  readonly_allowlist:
    - "^echo(\\\\s+.*)?$"
mcp:
  default_classification: DESTRUCTIVE
  readonly_tools: []
`,
			"utf-8",
		)

		const safeApproval = vi.fn().mockResolvedValue(true)
		const safeResult = await runOrchestrationPreToolHook({
			task,
			toolName: "execute_command",
			toolArgs: { command: "echo hello" },
			askApproval: safeApproval,
		})

		expect(safeResult.blocked).toBe(false)
		expect(safeResult.preApproved).toBe(false)
		expect(safeResult.context?.commandClass).toBe("SAFE")
		expect(safeApproval).not.toHaveBeenCalled()

		const selected = await selectActiveIntentForTask(task, "INT-001")
		expect(selected.ok).toBe(true)

		const destructiveApproval = vi.fn().mockResolvedValue(true)
		const destructiveResult = await runOrchestrationPreToolHook({
			task,
			toolName: "execute_command",
			toolArgs: { command: "echo hello && npm test" },
			askApproval: destructiveApproval,
		})

		expect(destructiveResult.blocked).toBe(false)
		expect(destructiveResult.preApproved).toBe(true)
		expect(destructiveResult.context?.commandClass).toBe("DESTRUCTIVE")
		expect(destructiveApproval).toHaveBeenCalledTimes(1)
	})

	it("appends enriched trace records with tool origin and AST attribution metadata", async () => {
		const selected = await selectActiveIntentForTask(task, "INT-001")
		expect(selected.ok).toBe(true)

		const askApproval = vi.fn().mockResolvedValue(true)
		const preResult = await runOrchestrationPreToolHook({
			task,
			toolName: "write_to_file",
			toolOrigin: "native",
			toolArgs: {
				path: "src/example.txt",
				content: "new content",
				intent_id: "INT-001",
				mutation_class: "AST_REFACTOR",
			},
			askApproval,
		})

		expect(preResult.blocked).toBe(false)
		expect(preResult.context).toBeDefined()
		await fs.writeFile(path.join(workspaceRoot, "src", "example.txt"), "new content\n", "utf-8")

		await runOrchestrationPostToolHook({
			task,
			context: preResult.context!,
			toolResult: "ok",
		})

		const traceRaw = await fs.readFile(path.join(workspaceRoot, ".orchestration", "agent_trace.jsonl"), "utf-8")
		const lines = traceRaw
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
		expect(lines.length).toBe(1)

		const entry = JSON.parse(lines[0])
		expect(entry.intent_id).toBe("INT-001")
		expect(entry.tool_name).toBe("write_to_file")
		expect(entry.tool_origin).toBe("native")
		expect(entry.agent_action).toBe("write_to_file")
		expect(entry.modified_ranges[0].content_hash).toBeTypeOf("string")
		expect(entry.modified_ranges[0].ast_status).toBe("fallback")
		expect(entry.modified_ranges[0].ast_nodes).toEqual([])
	})
})
