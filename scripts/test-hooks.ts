/**
 * Run each hook component and assert expected behavior.
 * Run from repo root: pnpm tsx scripts/test-hooks.ts
 */
import fs from "fs/promises"
import path from "path"

import { contentHash, contentHashForRange } from "../src/hooks/content-hash"
import { loadIntentContext, buildIntentContextXml } from "../src/hooks/context-loader"
import { pathInScope } from "../src/hooks/scope"
import { PreHook } from "../src/hooks/pre-hook"
import { HookMiddleware } from "../src/hooks/middleware"
import { appendAgentTrace } from "../src/hooks/post-hook"

const cwd = process.cwd()

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`FAIL: ${message}`)
}

async function run(name: string, fn: () => Promise<void> | void): Promise<void> {
	try {
		await fn()
		console.log(`  OK  ${name}`)
	} catch (e) {
		console.error(`  FAIL ${name}`)
		throw e
	}
}

async function main() {
	console.log("=== 1. content-hash ===\n")

	await run("contentHash returns sha256: prefix", async () => {
		const h = contentHash("hello")
		assert(h.startsWith("sha256:"), "prefix")
		assert(h.length === 71, "length 7 prefix + 64 hex")
	})

	await run("contentHash is deterministic", async () => {
		const a = contentHash("same")
		const b = contentHash("same")
		assert(a === b, "same input => same hash")
	})

	await run("contentHashForRange hashes line range", async () => {
		const text = "line1\nline2\nline3\nline4"
		const h = contentHashForRange(text, 2, 3)
		assert(h.startsWith("sha256:"), "prefix")
		// line2\nline3
		const expected = contentHash("line2\nline3")
		assert(h === expected, "range hash matches manual slice")
	})

	console.log("\n=== 2. context-loader ===\n")

	await run("loadIntentContext returns null when file missing", async () => {
		const ctx = await loadIntentContext("/nonexistent", "INT-001")
		assert(ctx === null, "missing dir => null")
	})

	await run("loadIntentContext loads INT-001 from .orchestration/active_intents.yaml", async () => {
		const ctx = await loadIntentContext(cwd, "INT-001")
		assert(ctx !== null, "context exists")
		assert(ctx!.id === "INT-001", "id")
		assert(ctx!.name === "Build Weather API", "name")
		assert(Array.isArray(ctx!.owned_scope) && ctx!.owned_scope!.includes("src/api/**"), "owned_scope")
		assert(Array.isArray(ctx!.constraints) && ctx!.constraints!.length > 0, "constraints")
	})

	await run("loadIntentContext returns null for unknown intent", async () => {
		const ctx = await loadIntentContext(cwd, "INT-999")
		assert(ctx === null, "unknown id => null")
	})

	await run("buildIntentContextXml produces valid XML block", async () => {
		const ctx = await loadIntentContext(cwd, "INT-001")
		assert(ctx !== null, "context exists")
		const xml = buildIntentContextXml(ctx!)
		assert(xml.includes("<intent_context>"), "root tag")
		assert(xml.includes("<id>INT-001</id>"), "id")
		assert(xml.includes("<constraint>"), "constraints")
		assert(xml.includes("<scope>"), "scope")
	})

	console.log("\n=== 3. scope ===\n")

	await run("pathInScope: empty scope => allowed", async () => {
		assert(pathInScope("any/file.ts", [], cwd) === true, "empty scope allows all")
	})

	await run("pathInScope: src/api/** matches src/api/weather.ts", async () => {
		assert(pathInScope("src/api/weather.ts", ["src/api/**"], cwd) === true, "in scope")
	})

	await run("pathInScope: src/api/** does not match src/other/file.ts", async () => {
		assert(pathInScope("src/other/unauthorized.ts", ["src/api/**"], cwd) === false, "out of scope")
	})

	await run("pathInScope: exact file matches", async () => {
		assert(pathInScope("src/middleware/jwt.ts", ["src/middleware/jwt.ts"], cwd) === true, "exact match")
	})

	console.log("\n=== 4. pre-hook (PreHook) ===\n")

	let activeIntentId: string | null = null
	const preHook = new PreHook({
		cwd,
		getActiveIntentId: () => activeIntentId,
		setActiveIntentId: (id) => {
			activeIntentId = id
		},
		requireIntentForDestructiveOnly: true,
	})

	await run("PreHook: write_to_file with no intent => blocked", async () => {
		activeIntentId = null
		const r = await preHook.intercept("write_to_file", { path: "src/api/x.ts", content: "x" })
		assert(r.blocked === true, "blocked")
		assert(r.error != null && r.error.includes("select an active intent"), "error message")
	})

	await run("PreHook: select_active_intent with valid ID => injectResult XML", async () => {
		const r = await preHook.intercept("select_active_intent", { intent_id: "INT-001" })
		assert(r.blocked === false, "not blocked")
		assert(r.injectResult != null && r.injectResult.includes("<intent_context>"), "XML injected")
		assert(activeIntentId === "INT-001", "active intent set")
	})

	await run("PreHook: select_active_intent with invalid ID => blocked", async () => {
		const r = await preHook.intercept("select_active_intent", { intent_id: "INT-999" })
		assert(r.blocked === true, "blocked")
		assert(r.error != null && r.error.includes("INT-999"), "error mentions id")
	})

	await run("PreHook: write_to_file in owned_scope => allowed", async () => {
		activeIntentId = "INT-001"
		const r = await preHook.intercept("write_to_file", {
			path: "src/api/weather.ts",
			content: "// code",
		})
		assert(r.blocked === false, "not blocked")
	})

	await run("PreHook: write_to_file outside owned_scope => blocked", async () => {
		activeIntentId = "INT-001"
		const r = await preHook.intercept("write_to_file", {
			path: "src/other/unauthorized.ts",
			content: "// bad",
		})
		assert(r.blocked === true, "blocked")
		assert(r.error != null && r.error.includes("Scope Violation"), "scope violation message")
	})

	await run("PreHook: read_file (safe) without intent => allowed", async () => {
		activeIntentId = null
		const r = await preHook.intercept("read_file", { path: "src/api/x.ts" })
		assert(r.blocked === false, "safe tool allowed without intent")
	})

	// TDD: path traversal must be blocked (test first, then implement)
	await run("PreHook: write_to_file with path traversal (..) => blocked", async () => {
		activeIntentId = "INT-001"
		const r = await preHook.intercept("write_to_file", {
			path: "src/api/../../../etc/escape.ts",
			content: "// path traversal",
		})
		assert(r.blocked === true, "blocked")
		assert(r.error != null && r.error.toLowerCase().includes("path"), "error mentions path/traversal")
	})

	console.log("\n=== 5. post-hook (appendAgentTrace) ===\n")

	const tracePath = path.join(cwd, ".orchestration", "agent_trace.jsonl")
	// Start fresh for this test
	try {
		await fs.unlink(tracePath)
	} catch {
		// ignore if missing
	}

	await run("appendAgentTrace creates .orchestration/agent_trace.jsonl", async () => {
		await appendAgentTrace(cwd, {
			relativePath: "src/api/weather.ts",
			content: "// weather API\nconst x = 1;",
			intentId: "INT-001",
			mutationClass: "INTENT_EVOLUTION",
			sessionLogId: "session-1",
			modelIdentifier: "test-model",
			vcsRevisionId: "abc123",
		})
		const raw = await fs.readFile(tracePath, "utf-8")
		const line = raw.trim().split("\n")[0]
		assert(line != null, "at least one line")
		const entry = JSON.parse(line!)
		assert(entry.id != null, "id")
		assert(entry.timestamp != null, "timestamp")
		assert(entry.vcs?.revision_id === "abc123", "vcs")
		assert(entry.files?.length === 1, "one file")
		assert(entry.files[0].relative_path === "src/api/weather.ts", "path")
		const conv = entry.files[0].conversations[0]
		assert(conv.contributor?.entity_type === "AI", "contributor")
		assert(conv.ranges?.[0]?.content_hash?.startsWith("sha256:"), "content_hash")
		assert(conv.related?.[0]?.value === "INT-001", "related intent")
	})

	await run("appendAgentTrace appends second entry", async () => {
		await appendAgentTrace(cwd, {
			relativePath: "src/api/forecast.ts",
			content: "// forecast",
			intentId: "INT-001",
		})
		const raw = await fs.readFile(tracePath, "utf-8")
		const lines = raw.trim().split("\n").filter(Boolean)
		assert(lines.length >= 2, "two or more lines")
	})

	await run("appendAgentTrace injects REQ-ID into related array", async () => {
		await appendAgentTrace(cwd, {
			relativePath: "src/api/trace.ts",
			content: "// trace",
			intentId: "INT-001",
			reqId: "REQ-12345",
		})
		const raw = await fs.readFile(tracePath, "utf-8")
		const lines = raw.trim().split("\n").filter(Boolean)
		const lastLine = lines[lines.length - 1]
		assert(lastLine != null, "last line exists")
		const entry = JSON.parse(lastLine)
		const conv = entry.files[0].conversations[0]
		const reqRelated = conv.related?.find((r: { type: string }) => r.type === "request")
		assert(reqRelated != null && reqRelated.value === "REQ-12345", "REQ-ID in related array")
	})

	console.log("\n=== 6. middleware (full flow) ===\n")

	activeIntentId = null // reset so we simulate: select_intent then write
	const middleware = new HookMiddleware({
		preHook,
		getActiveIntentId: () => activeIntentId,
		getCwd: () => cwd,
		getSessionLogId: () => "log-1",
		getModelId: () => "model-1",
		getVcsRevisionId: () => "rev-1",
	})

	await run(
		"Middleware: preToolUse(select_active_intent) then preToolUse(write_to_file) then postToolUse",
		async () => {
			const r1 = await middleware.preToolUse("select_active_intent", { intent_id: "INT-001" })
			assert(!r1.blocked && r1.injectResult != null, "select ok")
			const r2 = await middleware.preToolUse("write_to_file", {
				path: "src/api/demo.ts",
				content: "// demo",
			})
			assert(!r2.blocked, "write allowed")
			await middleware.postToolUse("write_to_file", { path: "src/api/demo.ts", content: "// demo" }, {})
			const raw = await fs.readFile(tracePath, "utf-8")
			const lastLine = raw.trim().split("\n").filter(Boolean).pop()
			assert(lastLine != null, "new line")
			const entry = JSON.parse(lastLine!)
			assert(entry.files[0].relative_path === "src/api/demo.ts", "demo.ts traced")
		},
	)

	console.log("\n=== All hook checks passed. ===\n")
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
