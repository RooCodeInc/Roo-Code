import { getSharedToolUseSection } from "../tool-use"

describe("getSharedToolUseSection", () => {
	describe("native tool calling", () => {
		it("should include one tool per message requirement when experiment is disabled", () => {
			// No experiment flags passed (default: disabled)
			const section = getSharedToolUseSection()

			expect(section).toContain("You must use exactly one tool call per assistant response")
			expect(section).toContain("Do not call zero tools or more than one tool")
		})

		it("should include one tool per message requirement when experiment is explicitly disabled", () => {
			const section = getSharedToolUseSection({ multipleNativeToolCalls: false })

			expect(section).toContain("You must use exactly one tool call per assistant response")
			expect(section).toContain("Do not call zero tools or more than one tool")
		})

		it("should NOT include one tool per message requirement when experiment is enabled", () => {
			const section = getSharedToolUseSection({ multipleNativeToolCalls: true })

			expect(section).not.toContain("You must use exactly one tool per message")
			expect(section).not.toContain("every assistant message must include a tool call")
			expect(section).toContain("You must call at least one tool per assistant response")
			expect(section).toContain("Prefer calling as many tools as are reasonably needed")
		})

		it("should include native tool-calling instructions", () => {
			const section = getSharedToolUseSection()

			expect(section).toContain("provider-native tool-calling mechanism")
			expect(section).toContain("Do not include XML markup or examples")
		})

		it("should NOT include XML formatting instructions", () => {
			const section = getSharedToolUseSection()

			expect(section).not.toContain("<actual_tool_name>")
			expect(section).not.toContain("</actual_tool_name>")
		})
	})

	describe("default (native-only)", () => {
		it("should default to native tool calling when no arguments are provided", () => {
			const section = getSharedToolUseSection()
			expect(section).toContain("provider-native tool-calling mechanism")
			// No legacy XML-tag tool-calling remnants
			expect(section).not.toContain("<actual_tool_name>")
		})
	})
})
