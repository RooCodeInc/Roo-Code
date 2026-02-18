import { describe, it, expect } from "vitest"
import { select_active_intent, get_intent_trace } from "./select_active_intent.js"

describe("Intent utilities", () => {
	it("select_active_intent returns XML for REQ-001", () => {
		const xml = select_active_intent("REQ-001")
		expect(xml).toContain("<description>Initialize MCP server</description>")
		expect(xml).toContain("<constraints>do not write code immediately</constraints>")
	})

	it("get_intent_trace returns trace for REQ-001", () => {
		const trace = get_intent_trace("REQ-001")
		expect(trace).toEqual({
			files: ["server.ts"],
			functions: ["initializeServer"],
		})
	})

	it("get_intent_trace returns undefined for REQ-002", () => {
		const trace = get_intent_trace("REQ-002")
		expect(trace).toBe(undefined)
	})

	it("throws on invalid intent_id", () => {
		expect(() => select_active_intent("INVALID")).toThrowError("Invalid intent_id")
		expect(() => get_intent_trace("INVALID")).toThrowError("Invalid intent_id")
	})
})
