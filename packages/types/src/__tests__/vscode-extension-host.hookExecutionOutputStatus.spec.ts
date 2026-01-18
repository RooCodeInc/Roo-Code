import { hookExecutionOutputStatusSchema } from "../vscode-extension-host"

describe("hookExecutionOutputStatusSchema", () => {
	it("accepts a valid started payload", () => {
		const result = hookExecutionOutputStatusSchema.safeParse({
			executionId: "exec_1",
			hookId: "hook_1",
			event: "PreToolUse",
			status: "started",
			command: "echo hi",
			cwd: "/project",
		})

		expect(result.success).toBe(true)
	})

	it("requires output for status=output", () => {
		const result = hookExecutionOutputStatusSchema.safeParse({
			executionId: "exec_1",
			hookId: "hook_1",
			event: "PreToolUse",
			status: "output",
			command: "echo hi",
			cwd: "/project",
			// output missing
		})

		expect(result.success).toBe(false)
	})

	it("accepts a valid exited payload", () => {
		const result = hookExecutionOutputStatusSchema.safeParse({
			executionId: "exec_1",
			hookId: "hook_1",
			event: "PreToolUse",
			status: "exited",
			command: "echo hi",
			cwd: "/project",
			exitCode: 0,
			durationMs: 123,
		})

		expect(result.success).toBe(true)
	})

	it("rejects unknown status", () => {
		const result = hookExecutionOutputStatusSchema.safeParse({
			executionId: "exec_1",
			hookId: "hook_1",
			event: "PreToolUse",
			status: "unknown",
			command: "echo hi",
			cwd: "/project",
		})

		expect(result.success).toBe(false)
	})
})
