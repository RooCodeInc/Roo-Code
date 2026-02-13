import { describe, expect, it } from "vitest"

import { RpiCorrectionEngine } from "../RpiCorrectionEngine"
import type { RpiToolObservation } from "../../RpiAutopilot"

const makeObservation = (overrides: Partial<RpiToolObservation> = {}): RpiToolObservation => ({
	toolName: "apply_diff",
	timestamp: new Date().toISOString(),
	success: false,
	error: "content mismatch",
	summary: "Failed: content mismatch",
	...overrides,
})

describe("RpiCorrectionEngine", () => {
	const engine = new RpiCorrectionEngine()

	it("suggests retry with read_file hint for apply_diff content mismatch (level 1)", () => {
		const result = engine.analyze({
			failedToolName: "apply_diff",
			errorMessage: "content mismatch in file",
			observation: makeObservation(),
			recentObservations: [makeObservation()],
			attemptCount: 1,
		})

		expect(result.escalationLevel).toBe(1)
		expect(result.action).toBe("retry_with_modification")
		expect(result.suggestedToolHint).toBe("read_file")
	})

	it("suggests alternative approach for apply_diff after 2 attempts (level 2)", () => {
		const result = engine.analyze({
			failedToolName: "apply_diff",
			errorMessage: "content mismatch",
			observation: makeObservation(),
			recentObservations: [makeObservation(), makeObservation()],
			attemptCount: 2,
		})

		expect(result.escalationLevel).toBe(2)
		expect(result.action).toBe("alternative_approach")
		expect(result.suggestedToolHint).toBe("write_to_file")
	})

	it("escalates to user after 3+ attempts (level 3)", () => {
		const result = engine.analyze({
			failedToolName: "execute_command",
			errorMessage: "exit code 1",
			observation: makeObservation({ toolName: "execute_command" }),
			recentObservations: [],
			attemptCount: 3,
		})

		expect(result.escalationLevel).toBe(3)
		expect(result.action).toBe("ask_user")
	})

	it("suggests list_files for file not found errors", () => {
		const result = engine.analyze({
			failedToolName: "read_file",
			errorMessage: "ENOENT: no such file or directory",
			observation: makeObservation({ toolName: "read_file", error: "ENOENT" }),
			recentObservations: [],
			attemptCount: 1,
		})

		expect(result.escalationLevel).toBe(1)
		expect(result.suggestedToolHint).toBe("list_files")
	})

	it("suggests broadening search for no results", () => {
		const result = engine.analyze({
			failedToolName: "search_files",
			errorMessage: "no results found",
			observation: makeObservation({ toolName: "search_files", error: "no results" }),
			recentObservations: [],
			attemptCount: 1,
		})

		expect(result.escalationLevel).toBe(1)
		expect(result.action).toBe("retry_with_modification")
	})

	it("suggests phase regression when same file fails 3+ times at level 2", () => {
		const failObs = makeObservation({
			toolName: "write_to_file",
			filesAffected: ["src/auth.ts"],
		})

		const result = engine.analyze({
			failedToolName: "write_to_file",
			errorMessage: "permission denied",
			observation: failObs,
			recentObservations: [failObs, failObs, failObs],
			attemptCount: 2,
		})

		expect(result.escalationLevel).toBe(2)
		expect(result.action).toBe("phase_regression")
	})
})
