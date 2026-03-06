// npx vitest core/prompts/__tests__/responses-xml-tool-call-error.spec.ts

import { formatResponse } from "../responses"

describe("formatResponse.xmlToolCallError", () => {
	it("should return a string containing the XML error explanation", () => {
		const result = formatResponse.xmlToolCallError()
		expect(result).toContain("XML tool calls are no longer supported")
	})

	it("should include instruction to not embed XML tags in text", () => {
		const result = formatResponse.xmlToolCallError()
		expect(result).toContain("Do NOT embed tool invocations as XML tags")
	})

	it("should include tool use instructions reminder", () => {
		const result = formatResponse.xmlToolCallError()
		expect(result).toContain("Reminder: Instructions for Tool Use")
		expect(result).toContain("native tool calling mechanism")
	})

	it("should include next steps guidance", () => {
		const result = formatResponse.xmlToolCallError()
		expect(result).toContain("Next Steps")
		expect(result).toContain("attempt_completion")
		expect(result).toContain("ask_followup_question")
	})

	it("should include the [ERROR] prefix", () => {
		const result = formatResponse.xmlToolCallError()
		expect(result).toMatch(/^\[ERROR\]/)
	})

	it("should include automated message notice", () => {
		const result = formatResponse.xmlToolCallError()
		expect(result).toContain("This is an automated message")
	})
})
