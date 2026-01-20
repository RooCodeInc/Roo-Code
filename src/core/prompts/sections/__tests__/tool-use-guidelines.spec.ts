import { getToolUseGuidelinesSection } from "../tool-use-guidelines"
import { EXPERIMENT_IDS } from "../../../../shared/experiments"

describe("getToolUseGuidelinesSection", () => {
	describe("native-only", () => {
		describe("with MULTIPLE_NATIVE_TOOL_CALLS disabled (default)", () => {
			it("should include proper numbered guidelines", () => {
				const guidelines = getToolUseGuidelinesSection()

				// Check that all numbered items are present with correct numbering
				expect(guidelines).toContain("1. Assess what information")
				expect(guidelines).toContain("2. Choose the most appropriate tool")
				expect(guidelines).toContain("3. If multiple actions are needed")
				expect(guidelines).toContain("4. After each tool use")
			})

			it("should include single-tool-per-message guidance when experiment disabled", () => {
				const guidelines = getToolUseGuidelinesSection({})

				expect(guidelines).toContain("use one tool at a time per message")
				expect(guidelines).not.toContain("you may use multiple tools in a single message")
				expect(guidelines).not.toContain("Formulate your tool use using")
				expect(guidelines).toContain("ALWAYS wait for user confirmation")
			})

			it("should include simplified iterative process guidelines", () => {
				const guidelines = getToolUseGuidelinesSection()

				expect(guidelines).toContain("carefully considering the user's response after each tool use")
				expect(guidelines).toContain("It is crucial to proceed step-by-step")
			})
		})

		describe("with MULTIPLE_NATIVE_TOOL_CALLS enabled", () => {
			it("should include multiple-tools-per-message guidance when experiment enabled", () => {
				const guidelines = getToolUseGuidelinesSection({
					[EXPERIMENT_IDS.MULTIPLE_NATIVE_TOOL_CALLS]: true,
				})

				expect(guidelines).toContain("you may use multiple tools in a single message")
				expect(guidelines).not.toContain("use one tool at a time per message")
				expect(guidelines).not.toContain("After each tool use, the user will respond")
			})

			it("should use simplified footer without step-by-step language", () => {
				const guidelines = getToolUseGuidelinesSection({
					[EXPERIMENT_IDS.MULTIPLE_NATIVE_TOOL_CALLS]: true,
				})

				// When multiple tools per message is enabled, we don't want the
				// "step-by-step" or "after each tool use" language that would
				// contradict the ability to batch tool calls.
				expect(guidelines).toContain("carefully considering the user's response after tool executions")
				expect(guidelines).not.toContain("It is crucial to proceed step-by-step")
				expect(guidelines).not.toContain("ALWAYS wait for user confirmation after each tool use")
			})
		})
	})

	it("should include common guidance", () => {
		const guidelines = getToolUseGuidelinesSection()
		expect(guidelines).toContain("Assess what information you already have")
		expect(guidelines).toContain("Choose the most appropriate tool")
		expect(guidelines).toContain("After each tool use, the user will respond")
		// No legacy XML-tag tool-calling remnants
		expect(guidelines).not.toContain("<actual_tool_name>")
	})
})
