import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, expect, it, vi } from "vitest"

import { HookEngine } from "../HookEngine"
import { Task } from "../../core/task/Task"
import type { ToolUse } from "../../shared/tools"

function createMutatingToolBlock(): ToolUse {
	return {
		type: "tool_use",
		name: "write_to_file",
		params: { path: "src/a.ts", content: "x" },
		partial: false,
		nativeArgs: { path: "src/a.ts", content: "x" },
	}
}

describe("HookEngine two-stage + HITL gating", () => {
	it("denies mutating tools when intent checkout is not authorized for the turn", async () => {
		const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "roo-hook-stage-"))
		const orchestrationDir = path.join(workspacePath, ".orchestration")
		await fs.mkdir(orchestrationDir, { recursive: true })
		await fs.writeFile(
			path.join(orchestrationDir, "active_intents.yaml"),
			[
				"active_intents:",
				"  - id: INT-1",
				"    status: IN_PROGRESS",
				'    owned_scope: ["src/**"]',
				"    constraints: []",
				"    acceptance_criteria: []",
				"    recent_history: []",
				"    related_files: []",
				"",
			].join("\n"),
			"utf8",
		)

		const task = {
			cwd: workspacePath,
			workspacePath,
			taskId: "task-1",
			activeIntentId: "INT-1",
			didToolFailInCurrentTurn: false,
			api: { getModel: () => ({ id: "gpt-test" }) },
			getIntentCheckoutStage: () => "checkout_required",
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
		} as unknown as Task

		const engine = new HookEngine()
		const result = await engine.preToolUse(task, createMutatingToolBlock())

		expect(result.allowExecution).toBe(false)
		expect(result.errorMessage).toContain("intent checkout required")
	})

	it("allows mutating tools after checkout when HITL approves", async () => {
		const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "roo-hook-hitl-"))
		const orchestrationDir = path.join(workspacePath, ".orchestration")
		await fs.mkdir(orchestrationDir, { recursive: true })
		await fs.writeFile(
			path.join(orchestrationDir, "active_intents.yaml"),
			[
				"active_intents:",
				"  - id: INT-2",
				"    status: IN_PROGRESS",
				'    owned_scope: ["src/**"]',
				"    constraints: []",
				"    acceptance_criteria: []",
				"    recent_history: []",
				"    related_files: []",
				"",
			].join("\n"),
			"utf8",
		)

		const ask = vi.fn().mockResolvedValue({ response: "yesButtonClicked" })
		const task = {
			cwd: workspacePath,
			workspacePath,
			taskId: "task-2",
			activeIntentId: "INT-2",
			didToolFailInCurrentTurn: false,
			api: { getModel: () => ({ id: "gpt-test" }) },
			getIntentCheckoutStage: () => "execution_authorized",
			ask,
		} as unknown as Task

		const engine = new HookEngine()
		const result = await engine.preToolUse(task, createMutatingToolBlock())

		expect(result.allowExecution).toBe(true)
		expect(ask).toHaveBeenCalled()
	})
})
