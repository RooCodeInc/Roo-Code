import type { ClineMessage } from "@roo-code/types"

import { detectAgentState } from "../agent-state.js"
import { taskCompleted } from "../events.js"

function createMessage(overrides: Partial<ClineMessage>): ClineMessage {
	return { ts: Date.now() + Math.random() * 1000, type: "say", ...overrides }
}

describe("taskCompleted", () => {
	it("returns true for completion_result", () => {
		const previous = detectAgentState([createMessage({ type: "say", say: "text", text: "working" })])
		const current = detectAgentState([createMessage({ type: "ask", ask: "completion_result", partial: false })])

		expect(taskCompleted(previous, current)).toBe(true)
	})

	it("returns true for resume_completed_task", () => {
		const previous = detectAgentState([createMessage({ type: "say", say: "text", text: "working" })])
		const current = detectAgentState([createMessage({ type: "ask", ask: "resume_completed_task", partial: false })])

		expect(taskCompleted(previous, current)).toBe(true)
	})

	it("returns false for recoverable idle asks", () => {
		const previous = detectAgentState([createMessage({ type: "say", say: "text", text: "working" })])
		const mistakeLimit = detectAgentState([
			createMessage({ type: "ask", ask: "mistake_limit_reached", partial: false }),
		])
		const apiFailed = detectAgentState([createMessage({ type: "ask", ask: "api_req_failed", partial: false })])

		expect(taskCompleted(previous, mistakeLimit)).toBe(false)
		expect(taskCompleted(previous, apiFailed)).toBe(false)
	})
})
