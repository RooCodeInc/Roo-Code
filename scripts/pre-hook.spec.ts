import { describe, it, expect, beforeEach } from "vitest"
import { PreHook } from "../pre-hook"

describe("PreHook", () => {
	let activeIntentId: string | null
	let preHook: PreHook

	beforeEach(() => {
		activeIntentId = null
		preHook = new PreHook({
			cwd: process.cwd(),
			getActiveIntentId: () => activeIntentId,
			setActiveIntentId: (id) => {
				activeIntentId = id
			},
			requireIntentForDestructiveOnly: true,
		})
	})

	it("blocks destructive write without active intent", async () => {
		activeIntentId = null
		const res = await preHook.intercept("write_to_file", {
			path: "src/api/weather.ts",
			content: "// test",
		})
		expect(res.blocked).toBe(true)
		expect(res.error).toEqual(expect.stringMatching(/select an active intent/i))
	})

	it("blocks write outside owned scope (scope violation)", async () => {
		activeIntentId = "INT-001"
		const res = await preHook.intercept("write_to_file", {
			path: "src/db/db.ts",
			content: "// should be blocked",
		})
		expect(res.blocked).toBe(true)
		expect(res.error).toEqual(expect.stringMatching(/scope violation/i))
	})

	it("recovery loop: retry after select_active_intent succeeds", async () => {
		// initial attempt without intent
		activeIntentId = null
		const attempt1 = await preHook.intercept("write_to_file", {
			path: "src/api/weather.ts",
			content: "// first",
		})
		expect(attempt1.blocked).toBe(true)

		// select active intent (handshake)
		const handshake = await preHook.intercept("select_active_intent", { intent_id: "INT-001" })
		expect(handshake.blocked).toBe(false)
		expect(handshake.injectResult).toEqual(expect.stringContaining("<intent_context>"))
		expect(activeIntentId).toBe("INT-001")

		// retry write (in-owned-scope path)
		const attempt2 = await preHook.intercept("write_to_file", {
			path: "src/api/weather.ts",
			content: "// second",
		})
		expect(attempt2.blocked).toBe(false)
	})
})
