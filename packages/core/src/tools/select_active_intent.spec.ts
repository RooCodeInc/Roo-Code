import { describe, it, expect } from "vitest"
import { select_active_intent, get_intent_trace } from "./index.js"

describe("Intent utilities", () => {
	it("select_active_intent returns valid XML", () => {
		const xml = select_active_intent("REQ-001")
		expect(xml).toContain("<intent_context>")
		expect(xml).toContain("</intent_context>")
		expect(xml).toContain("Initialize MCP server")
	})

	it("get_intent_trace returns correct trace info", () => {
		const trace = get_intent_trace("REQ-001")
		expect(trace).toEqual({
			files: ["server.ts"],
			functions: ["initializeServer"],
		})
	})

	it("throws on invalid intent", () => {
		expect(() => select_active_intent("INVALID")).toThrow()
		expect(() => get_intent_trace("INVALID")).toThrow()
	})
})
