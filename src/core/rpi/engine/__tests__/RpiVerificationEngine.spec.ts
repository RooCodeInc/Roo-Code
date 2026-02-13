import { describe, expect, it } from "vitest"

import { RpiVerificationEngine } from "../RpiVerificationEngine"
import type { RpiToolObservation } from "../../RpiAutopilot"

const makeObservation = (overrides: Partial<RpiToolObservation> = {}): RpiToolObservation => ({
	toolName: "write_to_file",
	timestamp: new Date().toISOString(),
	success: true,
	summary: "Wrote src/index.ts",
	...overrides,
})

describe("RpiVerificationEngine", () => {
	const engine = new RpiVerificationEngine()

	it("passes with lenient strictness when implementation evidence exists", () => {
		const result = engine.evaluate({
			observations: [makeObservation()],
			taskText: "fix the bug",
			mode: "code",
			strictness: "lenient",
			writeOps: 1,
			commandOps: 0,
		})

		expect(result.passed).toBe(true)
		expect(result.checks.every((c) => c.status !== "failed")).toBe(true)
	})

	it("fails with lenient strictness when no implementation evidence", () => {
		const result = engine.evaluate({
			observations: [],
			taskText: "fix the bug",
			mode: "code",
			strictness: "lenient",
			writeOps: 0,
			commandOps: 0,
		})

		expect(result.passed).toBe(false)
		expect(result.checks.find((c) => c.name === "Implementation evidence")?.status).toBe("failed")
	})

	it("passes standard strictness with successful writes and commands", () => {
		const result = engine.evaluate({
			observations: [
				makeObservation({ toolName: "write_to_file", success: true }),
				makeObservation({ toolName: "execute_command", success: true }),
			],
			taskText: "fix the bug",
			mode: "code",
			strictness: "standard",
			writeOps: 1,
			commandOps: 1,
		})

		expect(result.passed).toBe(true)
	})

	it("treats MCP write tools as implementation evidence (standard)", () => {
		const result = engine.evaluate({
			observations: [
				makeObservation({
					toolName: "use_mcp_tool",
					success: true,
					summary: "MCP filesystem.edit_file",
					mcpServerName: "filesystem",
					mcpToolName: "edit_file",
					filesAffected: ["src/index.ts"],
				}),
			],
			taskText: "fix the bug",
			mode: "code",
			strictness: "standard",
			writeOps: 0,
			commandOps: 0,
		})

		expect(result.passed).toBe(true)
	})

	it("does not treat MCP reads as implementation evidence (lenient)", () => {
		const result = engine.evaluate({
			observations: [
				makeObservation({
					toolName: "use_mcp_tool",
					success: true,
					summary: "MCP filesystem.read_file",
					mcpServerName: "filesystem",
					mcpToolName: "read_file",
				}),
			],
			taskText: "fix the bug",
			mode: "code",
			strictness: "lenient",
			writeOps: 0,
			commandOps: 0,
		})

		expect(result.passed).toBe(false)
		expect(result.checks.find((c) => c.name === "Implementation evidence")?.status).toBe("failed")
	})

	it("ignores writes to RPI state.json as implementation evidence", () => {
		const result = engine.evaluate({
			observations: [
				makeObservation({
					toolName: "use_mcp_tool",
					success: true,
					summary: "MCP filesystem.edit_file",
					mcpServerName: "filesystem",
					mcpToolName: "edit_file",
					filesAffected: ["c:/repo/.roo/rpi/child/state.json"],
				}),
			],
			taskText: "fix the bug",
			mode: "code",
			strictness: "standard",
			writeOps: 1,
			commandOps: 0,
		})

		expect(result.passed).toBe(false)
		expect(result.checks.find((c) => c.name === "Implementation evidence")?.status).toBe("failed")
	})

	it("fails standard strictness when last command failed", () => {
		const result = engine.evaluate({
			observations: [
				makeObservation({ toolName: "execute_command", success: true }),
				makeObservation({ toolName: "execute_command", success: false, error: "exit code 1" }),
			],
			taskText: "fix the bug",
			mode: "code",
			strictness: "standard",
			writeOps: 1,
			commandOps: 2,
		})

		expect(result.passed).toBe(false)
		expect(result.checks.find((c) => c.name === "Last command success")?.status).toBe("failed")
	})

	it("fails standard strictness when last write failed", () => {
		const result = engine.evaluate({
			observations: [makeObservation({ toolName: "apply_diff", success: false, error: "content mismatch" })],
			taskText: "fix the bug",
			mode: "code",
			strictness: "standard",
			writeOps: 1,
			commandOps: 0,
		})

		expect(result.passed).toBe(false)
		expect(result.checks.find((c) => c.name === "No unresolved write errors")?.status).toBe("failed")
	})

	it("fails strict when task mentions tests but no command executed", () => {
		const result = engine.evaluate({
			observations: [makeObservation({ toolName: "write_to_file", success: true })],
			taskText: "fix the test failures in the auth module",
			mode: "code",
			strictness: "strict",
			writeOps: 1,
			commandOps: 0,
		})

		expect(result.passed).toBe(false)
		expect(result.checks.find((c) => c.name === "Task keyword matching")?.status).toBe("failed")
	})

	it("passes strict when task mentions tests and command was executed", () => {
		const result = engine.evaluate({
			observations: [
				makeObservation({ toolName: "write_to_file", success: true }),
				makeObservation({ toolName: "execute_command", success: true }),
			],
			taskText: "fix the test failures",
			mode: "code",
			strictness: "strict",
			writeOps: 1,
			commandOps: 1,
		})

		expect(result.passed).toBe(true)
	})

	it("skips command check when no commands were executed", () => {
		const result = engine.evaluate({
			observations: [makeObservation({ toolName: "write_to_file", success: true })],
			taskText: "update the readme",
			mode: "code",
			strictness: "standard",
			writeOps: 1,
			commandOps: 0,
		})

		const cmdCheck = result.checks.find((c) => c.name === "Last command success")
		expect(cmdCheck?.status).toBe("skipped")
	})
})
