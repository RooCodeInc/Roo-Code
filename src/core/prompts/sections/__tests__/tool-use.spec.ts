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

		it("should NOT include single tool per message restriction", () => {
			const section = getSharedToolUseSection()

			expect(section).not.toContain("You must use exactly one tool call per assistant response")
			expect(section).not.toContain("Do not call zero tools or more than one tool")
		})

		it("should NOT include XML formatting instructions", () => {
			const section = getSharedToolUseSection()

			expect(section).not.toContain("<actual_tool_name>")
			expect(section).not.toContain("</actual_tool_name>")
		})

		it("should return native instructions when useXmlToolCalling is false", () => {
			const section = getSharedToolUseSection(false)

			expect(section).toContain("provider-native tool-calling mechanism")
			expect(section).not.toContain("<actual_tool_name>")
		})
	})

	describe("XML tool calling mode", () => {
		it("should include XML formatting instructions when useXmlToolCalling is true", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("<actual_tool_name>")
			expect(section).toContain("</actual_tool_name>")
			expect(section).toContain("Tool uses are formatted using XML-style tags")
		})

		it("should NOT include provider-native tool-calling text when useXmlToolCalling is true", () => {
			const section = getSharedToolUseSection(true)

			expect(section).not.toContain("provider-native tool-calling mechanism")
			expect(section).not.toContain("Do not include XML markup or examples")
		})

		it("should include parameter tag syntax example when useXmlToolCalling is true", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("<parameter1_name>value1</parameter1_name>")
			expect(section).toContain("<parameter2_name>value2</parameter2_name>")
		})

		it("should include TOOL USE header when useXmlToolCalling is true", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("TOOL USE")
			expect(section).toContain("You have access to a set of tools")
		})

		it("should include new_task XML example", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("<new_task>")
			expect(section).toContain("<mode>code</mode>")
			expect(section).toContain("</new_task>")
		})

		it("should include execute_command XML example", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("<execute_command>")
			expect(section).toContain("<command>npm run dev</command>")
			expect(section).toContain("</execute_command>")
		})

		it("should include IMPORTANT XML FORMATTING RULES section", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("IMPORTANT XML FORMATTING RULES")
			expect(section).toContain("Every opening tag MUST have a matching closing tag")
			expect(section).toContain("Do NOT use self-closing tags")
			expect(section).toContain("Do NOT include JSON objects")
			expect(section).toContain("Do NOT wrap tool calls in markdown code blocks")
		})

		it("should include COMMON MISTAKES TO AVOID section", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("COMMON MISTAKES TO AVOID")
			expect(section).toContain("Using JSON format")
			expect(section).toContain("Missing closing tags")
			expect(section).toContain("Using self-closing")
			expect(section).toContain("Correct XML format")
		})

		it("should include read_file correct example in common mistakes", () => {
			const section = getSharedToolUseSection(true)

			expect(section).toContain("<read_file>")
			expect(section).toContain("<path>src/app.ts</path>")
			expect(section).toContain("</read_file>")
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

		it("should NOT include XML reinforcement when called without arguments", () => {
			const section = getToolUseGuidelinesSection()

			expect(section).not.toContain("REMINDER: You MUST format all tool calls as XML")
			expect(section).not.toContain("Formulate your tool use using the XML format")
		})

		it("should NOT include XML reinforcement when useXmlToolCalling is false", () => {
			const section = getToolUseGuidelinesSection(false)

			expect(section).not.toContain("REMINDER: You MUST format all tool calls as XML")
			expect(section).not.toContain("Formulate your tool use using the XML format")
		})
	})

	describe("XML tool calling mode", () => {
		it("should include XML reinforcement guidelines when useXmlToolCalling is true", () => {
			const section = getToolUseGuidelinesSection(true)

			expect(section).toContain("Formulate your tool use using the XML format")
			expect(section).toContain("REMINDER: You MUST format all tool calls as XML")
		})

		it("should include XML-specific numbered steps", () => {
			const section = getToolUseGuidelinesSection(true)

			expect(section).toContain("4. Formulate your tool use using the XML format")
			expect(section).toContain("5. After each tool use, the user will respond")
			expect(section).toContain("6. ALWAYS wait for user confirmation")
		})

		it("should still include base guidelines alongside XML reinforcement", () => {
			const section = getToolUseGuidelinesSection(true)

			expect(section).toContain("# Tool Use Guidelines")
			expect(section).toContain("Assess what information you already have")
			expect(section).toContain("Choose the most appropriate tool")
		})

		it("should include explicit XML structure reminder", () => {
			const section = getToolUseGuidelinesSection(true)

			expect(section).toContain("<tool_name><param>value</param></tool_name>")
		})
	})
})
