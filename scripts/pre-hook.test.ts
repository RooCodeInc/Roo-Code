import test from "node:test"
import assert from "node:assert/strict"
import { PreHook } from "../src/hooks/pre-hook"

const cwd = process.cwd()

test("blocks destructive write without active intent", async () => {
	let activeIntentId: string | null = null
	const preHook = new PreHook({
		cwd,
		getActiveIntentId: () => activeIntentId,
		setActiveIntentId: (id) => {
			activeIntentId = id
		},
		requireIntentForDestructiveOnly: true,
	})

	const res = await preHook.intercept("write_to_file", {
		path: "src/api/weather.ts",
		content: "// test",
	})
	assert.equal(res.blocked, true)
	assert.match(String(res.error), /select an active intent/i)
})

test("blocks write outside owned scope (scope violation)", async () => {
	let activeIntentId: string | null = "INT-001"
	const preHook = new PreHook({
		cwd,
		getActiveIntentId: () => activeIntentId,
		setActiveIntentId: (id) => {
			activeIntentId = id
		},
		requireIntentForDestructiveOnly: true,
	})

	const res = await preHook.intercept("write_to_file", {
		path: "src/db/db.ts",
		content: "// should be blocked",
	})
	assert.equal(res.blocked, true)
	assert.match(String(res.error), /scope violation/i)
})

test("recovery loop: retry after select_active_intent succeeds", async () => {
	let activeIntentId: string | null = null
	const preHook = new PreHook({
		cwd,
		getActiveIntentId: () => activeIntentId,
		setActiveIntentId: (id) => {
			activeIntentId = id
		},
		requireIntentForDestructiveOnly: true,
	})

	const attempt1 = await preHook.intercept("write_to_file", {
		path: "src/api/weather.ts",
		content: "// first",
	})
	assert.equal(attempt1.blocked, true)

	const handshake = await preHook.intercept("select_active_intent", { intent_id: "INT-001" })
	assert.equal(handshake.blocked, false)
	assert.ok(typeof handshake.injectResult === "string" && handshake.injectResult.includes("<intent_context>"))
	assert.equal(activeIntentId, "INT-001")

	const attempt2 = await preHook.intercept("write_to_file", {
		path: "src/api/weather.ts",
		content: "// second",
	})
	assert.equal(attempt2.blocked, false)
})
