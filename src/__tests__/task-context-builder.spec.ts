import { describe, it, expect, vi } from "vitest"

import { buildTaskContext, buildChildTaskContext } from "../core/task/TaskContextBuilder"
import { defaultModeSlug } from "../shared/modes"
import type { TaskContext } from "@roo-code/types"

describe("buildTaskContext", () => {
	it("snapshots mode and API config from provider state", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				mode: "architect",
				currentApiConfigName: "gpt-4-profile",
			}),
		} as any

		const ctx = await buildTaskContext(provider)
		expect(ctx.mode).toBe("architect")
		expect(ctx.apiConfigName).toBe("gpt-4-profile")
		expect(ctx.inheritSkills).toBe(true)
	})

	it("applies overrides over provider state", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				currentApiConfigName: "default",
			}),
		} as any

		const ctx = await buildTaskContext(provider, {
			mode: "ask",
			apiConfigName: "local-model",
			permissions: { readOnly: true },
			parentTaskId: "parent-1",
		})

		expect(ctx.mode).toBe("ask")
		expect(ctx.apiConfigName).toBe("local-model")
		expect(ctx.permissions?.readOnly).toBe(true)
		expect(ctx.parentTaskId).toBe("parent-1")
	})

	it("falls back to defaults when provider state is empty", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue(null),
		} as any

		const ctx = await buildTaskContext(provider)
		expect(ctx.mode).toBe(defaultModeSlug)
		expect(ctx.apiConfigName).toBe("default")
	})
})

describe("buildChildTaskContext", () => {
	it("inherits parent context when no overrides", () => {
		const parent: TaskContext = {
			mode: "orchestrator",
			apiConfigName: "gpt-4",
			permissions: { fileWritePatterns: ["docs/**"] },
			inheritSkills: true,
			workspacePath: "/workspace",
			rootTaskId: "root-1",
		}

		const child = buildChildTaskContext(parent, { parentTaskId: "parent-1" })

		expect(child.mode).toBe("orchestrator")
		expect(child.apiConfigName).toBe("gpt-4")
		expect(child.permissions?.fileWritePatterns).toEqual(["docs/**"])
		expect(child.workspacePath).toBe("/workspace")
		expect(child.rootTaskId).toBe("root-1")
		expect(child.parentTaskId).toBe("parent-1")
	})

	it("overrides mode and API config for child", () => {
		const parent: TaskContext = {
			mode: "orchestrator",
			apiConfigName: "gpt-4",
			rootTaskId: "root-1",
		}

		const child = buildChildTaskContext(parent, {
			mode: "code",
			apiConfigName: "local-llama",
			parentTaskId: "parent-1",
		})

		expect(child.mode).toBe("code")
		expect(child.apiConfigName).toBe("local-llama")
		expect(child.rootTaskId).toBe("root-1")
	})

	it("merges permissions using most-restrictive rule", () => {
		const parent: TaskContext = {
			mode: "orchestrator",
			permissions: {
				fileWritePatterns: ["docs/**", "src/**"],
				allowedTools: ["read_file", "write_to_file", "list_files"],
			},
		}

		const child = buildChildTaskContext(parent, {
			mode: "code",
			permissions: {
				fileWritePatterns: ["docs/**"],
				allowedTools: ["read_file", "list_files"],
			},
			parentTaskId: "parent-1",
		})

		// Intersection of file write patterns
		expect(child.permissions?.fileWritePatterns).toEqual(["docs/**"])
		// Intersection of allowed tools
		expect(child.permissions?.allowedTools).toEqual(["read_file", "list_files"])
	})

	it("inherits parent permissions when child specifies none", () => {
		const parent: TaskContext = {
			mode: "orchestrator",
			permissions: { readOnly: true },
		}

		const child = buildChildTaskContext(parent, {
			mode: "ask",
			parentTaskId: "parent-1",
		})

		expect(child.permissions?.readOnly).toBe(true)
	})
})
