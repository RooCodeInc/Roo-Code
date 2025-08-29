import { getToolDescriptionsForMode } from "../index"

describe("attempt_completion conditional inclusion", () => {
	const mockCwd = "/test/path"
	const mockSupportsComputerUse = false

	describe("for orchestrated tasks", () => {
		it("should always include attempt_completion tool when isOrchestrated is true", () => {
			const result = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				undefined, // codeIndexManager
				undefined, // diffStrategy
				undefined, // browserViewportSize
				undefined, // mcpHub
				undefined, // customModes
				undefined, // experiments
				undefined, // partialReadsEnabled
				{ allowAttemptCompletion: false }, // settings with allowAttemptCompletion disabled
				undefined, // enableMcpServerCreation
				undefined, // modelId
				true, // isOrchestrated = true
			)

			expect(result).toContain("## attempt_completion")
			expect(result).toContain("After each tool use, the user will respond with the result")
		})

		it("should include attempt_completion even when allowAttemptCompletion is false", () => {
			const result = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				{ allowAttemptCompletion: false },
				undefined,
				undefined,
				true, // isOrchestrated = true
			)

			expect(result).toContain("## attempt_completion")
		})

		it("should include attempt_completion even when allowAttemptCompletion is undefined", () => {
			const result = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				{}, // settings without allowAttemptCompletion
				undefined,
				undefined,
				true, // isOrchestrated = true
			)

			expect(result).toContain("## attempt_completion")
		})
	})

	describe("for standard (non-orchestrated) tasks", () => {
		it("should exclude attempt_completion when isOrchestrated is false and allowAttemptCompletion is false", () => {
			const result = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				{ allowAttemptCompletion: false },
				undefined,
				undefined,
				false, // isOrchestrated = false
			)

			expect(result).not.toContain("## attempt_completion")
			expect(result).not.toContain("After each tool use, the user will respond with the result")
		})

		it("should exclude attempt_completion when isOrchestrated is undefined and allowAttemptCompletion is false", () => {
			const result = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				{ allowAttemptCompletion: false },
				undefined,
				undefined,
				undefined, // isOrchestrated = undefined (defaults to false)
			)

			expect(result).not.toContain("## attempt_completion")
		})

		it("should exclude attempt_completion by default when allowAttemptCompletion is undefined", () => {
			const result = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				{}, // settings without allowAttemptCompletion
				undefined,
				undefined,
				false, // isOrchestrated = false
			)

			expect(result).not.toContain("## attempt_completion")
		})

		it("should include attempt_completion when allowAttemptCompletion is explicitly true", () => {
			const result = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				{ allowAttemptCompletion: true }, // explicitly enabled
				undefined,
				undefined,
				false, // isOrchestrated = false
			)

			expect(result).toContain("## attempt_completion")
			expect(result).toContain("After each tool use, the user will respond with the result")
		})

		it("should include attempt_completion when isOrchestrated is undefined but allowAttemptCompletion is true", () => {
			const result = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				{ allowAttemptCompletion: true },
				undefined,
				undefined,
				undefined, // isOrchestrated = undefined
			)

			expect(result).toContain("## attempt_completion")
		})
	})

	describe("edge cases", () => {
		it("should handle null settings gracefully", () => {
			const result = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				null as any, // null settings
				undefined,
				undefined,
				false,
			)

			// Should exclude attempt_completion by default
			expect(result).not.toContain("## attempt_completion")
		})

		it("should handle undefined settings gracefully", () => {
			const result = getToolDescriptionsForMode(
				"code",
				mockCwd,
				mockSupportsComputerUse,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined, // undefined settings
				undefined,
				undefined,
				false,
			)

			// Should exclude attempt_completion by default
			expect(result).not.toContain("## attempt_completion")
		})
	})

	describe("interaction with different modes", () => {
		const testModes = ["code", "architect", "ask", "debug"]

		testModes.forEach((mode) => {
			it(`should respect orchestration flag in ${mode} mode`, () => {
				// Orchestrated task should include attempt_completion
				const orchestratedResult = getToolDescriptionsForMode(
					mode,
					mockCwd,
					mockSupportsComputerUse,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					{ allowAttemptCompletion: false },
					undefined,
					undefined,
					true,
				)

				expect(orchestratedResult).toContain("## attempt_completion")

				// Non-orchestrated task with setting disabled should exclude it
				const standardResult = getToolDescriptionsForMode(
					mode,
					mockCwd,
					mockSupportsComputerUse,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					{ allowAttemptCompletion: false },
					undefined,
					undefined,
					false,
				)

				expect(standardResult).not.toContain("## attempt_completion")
			})
		})
	})
})
