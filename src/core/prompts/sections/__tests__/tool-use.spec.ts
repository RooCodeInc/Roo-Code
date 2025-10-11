import { describe, it, expect } from "vitest"
import { getSharedToolUseSection } from "../tool-use"

describe("getSharedToolUseSection", () => {
	describe("base functionality", () => {
		it("should return base tool use section when no apiProvider is provided", () => {
			const result = getSharedToolUseSection()

			expect(result).toContain("TOOL USE")
			expect(result).toContain("Tool uses are formatted using XML-style tags")
			expect(result).toContain("<actual_tool_name>")
			expect(result).not.toContain("CRITICAL: Tool Use Requirements")
			expect(result).not.toContain("MANDATORY")
		})

		it("should return base tool use section for non-local providers", () => {
			const providers = ["anthropic", "openai", "openrouter", "bedrock"]

			providers.forEach((provider) => {
				const result = getSharedToolUseSection(provider)

				expect(result).toContain("TOOL USE")
				expect(result).toContain("Tool uses are formatted using XML-style tags")
				expect(result).not.toContain("CRITICAL: Tool Use Requirements")
				expect(result).not.toContain("MANDATORY")
			})
		})
	})

	describe("local model enhancements", () => {
		it("should include enhanced instructions for ollama provider", () => {
			const result = getSharedToolUseSection("ollama")

			// Check base content is still there
			expect(result).toContain("TOOL USE")
			expect(result).toContain("Tool uses are formatted using XML-style tags")

			// Check enhanced instructions
			expect(result).toContain("CRITICAL: Tool Use Requirements for Your Response")
			expect(result).toContain("MANDATORY")
			expect(result).toContain("Every response MUST contain EXACTLY ONE tool use")
			expect(result).toContain("DO NOT")
			expect(result).toContain("Write explanations or text outside of the tool XML tags")
			expect(result).toContain("Guess file locations or code content")
			expect(result).toContain("ALWAYS")
			expect(result).toContain("Start with codebase_search tool when exploring code")

			// Check examples
			expect(result).toContain("Example of a CORRECT response")
			expect(result).toContain("<codebase_search>")
			expect(result).toContain("<query>main function entry point</query>")
			expect(result).toContain("</codebase_search>")

			expect(result).toContain("Example of an INCORRECT response")
			expect(result).toContain("I'll search for the main function")

			// Check final reminder
			expect(result).toContain("Remember: Your ENTIRE response should be the tool XML, nothing else")
		})

		it("should include enhanced instructions for lmstudio provider", () => {
			const result = getSharedToolUseSection("lmstudio")

			// Check base content is still there
			expect(result).toContain("TOOL USE")
			expect(result).toContain("Tool uses are formatted using XML-style tags")

			// Check enhanced instructions (same as ollama)
			expect(result).toContain("CRITICAL: Tool Use Requirements for Your Response")
			expect(result).toContain("MANDATORY")
			expect(result).toContain("Every response MUST contain EXACTLY ONE tool use")
			expect(result).toContain("DO NOT")
			expect(result).toContain("ALWAYS")
			expect(result).toContain("Example of a CORRECT response")
			expect(result).toContain("Example of an INCORRECT response")
			expect(result).toContain("Remember: Your ENTIRE response should be the tool XML, nothing else")
		})
	})

	describe("formatting and structure", () => {
		it("should maintain proper formatting with line breaks", () => {
			const result = getSharedToolUseSection("ollama")

			// Check that there are proper line breaks between sections
			expect(result).toMatch(/TOOL USE\n\n/)
			expect(result).toMatch(/# Tool Use Formatting\n\n/)
			expect(result).toMatch(/# CRITICAL: Tool Use Requirements/)
		})

		it("should have consistent XML examples", () => {
			const result = getSharedToolUseSection("ollama")

			// Check XML structure is properly formatted
			expect(result).toMatch(/<actual_tool_name>\n<parameter1_name>value1<\/parameter1_name>/)
			expect(result).toMatch(/<codebase_search>\n<query>/)
		})
	})
})
