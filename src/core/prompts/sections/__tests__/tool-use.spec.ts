import { getSharedToolUseSection } from "../tool-use"
import { getToolUseGuidelinesSection } from "../tool-use-guidelines"

describe("getSharedToolUseSection", () => {
	describe("default (native) mode", () => {
		it("should include native tool-calling instructions", () => {
			const section = getSharedToolUseSection()

			expect(section).toContain("provider-native tool-calling mechanism")
			expect(section).toContain("Do not include XML markup or examples")
		})

		it("should include multiple tools per message guidance", () => {
			const section = getSharedToolUseSection()

			expect(section).toContain("You must call at least one tool per assistant response")
			expect(section).toContain("Prefer calling as many tools as are reasonably needed")
		})

		it("should NOT include XML formatting instructions", () => {
			const section = getSharedToolUseSection()

			expect(section).not.toContain("XML-style tags")
		})

		it("should return native instructions when useXmlToolCalling is false", () => {
			const section = getSharedToolUseSection(false)

			expect(section).toContain("provider-native tool-calling mechanism")
		})
	})

	describe("XML tool calling mode", () => {
		it("should include XML formatting instructions when useXmlToolCalling is true", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("XML-style tags")
			expect(section).toContain("tool name becomes the XML tag")
		})

		it("should NOT include provider-native tool-calling text when useXmlToolCalling is true", () => {
			const section = getSharedToolUseSection(true)

			expect(section).not.toContain("provider-native tool-calling mechanism")
			expect(section).not.toContain("Do not include XML markup or examples")
		})

		it("should include TOOL USE header", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("TOOL USE")
			expect(section).toContain("You have access to a set of tools")
		})

		it("should require exactly one tool per message", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("exactly one tool per message")
			expect(section).toContain("every assistant message must include a tool call")
		})
	})
})

describe("getToolUseGuidelinesSection", () => {
	describe("default (non-XML) mode", () => {
		it("should include base guidelines without XML reinforcement", () => {
			const section = getToolUseGuidelinesSection()

			expect(section).toContain("# Tool Use Guidelines")
			expect(section).toContain("Assess what information you already have")
			expect(section).toContain("Choose the most appropriate tool")
			expect(section).toContain("If multiple actions are needed")
		})

		it("should NOT include XML-specific content when called without arguments", () => {
			const section = getToolUseGuidelinesSection()

			expect(section).not.toContain("Formulate tool calls as XML")
			expect(section).not.toContain("attempt_completion")
		})
	})

	describe("XML tool calling mode", () => {
		it("should include compact XML guidelines when useXmlToolCalling is true", () => {
			const section = getToolUseGuidelinesSection(true)

			expect(section).toContain("# Tool Use Guidelines")
			expect(section).toContain("Formulate tool calls as XML")
			expect(section).toContain("attempt_completion")
			expect(section).toContain("ask_followup_question")
		})

		it("should include XML structure reminder", () => {
			const section = getToolUseGuidelinesSection(true)

			expect(section).toContain("<tool_name><param>value</param></tool_name>")
		})

		it("should be more compact than native guidelines", () => {
			const xmlSection = getToolUseGuidelinesSection(true)
			const nativeSection = getToolUseGuidelinesSection(false)

			// XML guidelines should be shorter to save context window space
			expect(xmlSection.length).toBeLessThan(nativeSection.length)
		})
	})
})
