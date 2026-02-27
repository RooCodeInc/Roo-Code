#!/usr/bin/env npx tsx
/**
 * Scenario test for the AI-Native Git Layer (agent_trace.jsonl).
 *
 * Run from repo root:
 *   pnpm tsx scripts/test-trace-scenario.ts
 * or
 *   npx tsx scripts/test-trace-scenario.ts
 *
 * This script simulates: select_active_intent → write_to_file → post-hook appends to agent_trace.jsonl.
 * It then prints the last trace entry so you can verify intent_id, mutation_class, content_hash, and REQ-ID.
 */
import fs from "fs/promises"
import path from "path"

import { PreHook } from "../src/hooks/pre-hook"
import { HookMiddleware } from "../src/hooks/middleware"
import { contentHash } from "../src/hooks/content-hash"

const cwd = process.cwd()
const tracePath = path.join(cwd, ".orchestration", "agent_trace.jsonl")

async function main() {
	console.log("=== Traceability scenario (terminal test) ===\n")

	let activeIntentId: string | null = null
	const preHook = new PreHook({
		cwd,
		getActiveIntentId: () => activeIntentId,
		setActiveIntentId: (id) => {
			activeIntentId = id
		},
		requireIntentForDestructiveOnly: true,
	})

	const middleware = new HookMiddleware({
		preHook,
		getActiveIntentId: () => activeIntentId,
		getCwd: () => cwd,
		getReqId: () => "REQ-scenario-" + Date.now(),
		getSessionLogId: () => "session-scenario",
		getModelId: () => "scenario-runner",
		getVcsRevisionId: () => undefined,
	})

	// Step 1: Select intent (like the agent would)
	console.log("1. select_active_intent(INT-001) ...")
	const selectResult = await middleware.preToolUse("select_active_intent", { intent_id: "INT-001" })
	if (selectResult.blocked) {
		console.error("   FAIL: select_active_intent blocked:", selectResult.error)
		process.exit(1)
	}
	console.log("   OK – intent context loaded\n")

	// Step 2: Simulate write_to_file with intent_id and mutation_class
	const writeParams = {
		path: "src/api/weather.ts",
		content: "// Weather API\nconst getWeather = () => ({ temp: 72 })\nexport { getWeather }\n",
		intent_id: "INT-001",
		mutation_class: "INTENT_EVOLUTION" as const,
	}
	console.log("2. write_to_file (pre-hook check) ...")
	const preWrite = await middleware.preToolUse("write_to_file", writeParams)
	if (preWrite.blocked) {
		console.error("   FAIL: write_to_file blocked:", preWrite.error)
		process.exit(1)
	}
	console.log("   OK – within scope\n")

	// Step 3: Post-hook appends to agent_trace.jsonl (like after real write)
	console.log("3. postToolUse (append to agent_trace.jsonl) ...")
	await middleware.postToolUse("write_to_file", writeParams, {})
	console.log("   OK – trace entry appended\n")

	// Step 4: Read and display the last trace entry
	const raw = await fs.readFile(tracePath, "utf-8")
	const lines = raw.trim().split("\n").filter(Boolean)
	const lastLine = lines[lines.length - 1]
	if (!lastLine) {
		console.error("   FAIL: no lines in agent_trace.jsonl")
		process.exit(1)
	}

	const entry = JSON.parse(lastLine)
	const expectedHash = contentHash(writeParams.content)

	console.log("4. Last trace entry (from .orchestration/agent_trace.jsonl):\n")
	console.log(JSON.stringify(entry, null, 2))
	console.log("\n--- Checks ---")
	console.log(
		"  intent (specification):",
		entry.files[0].conversations[0].related?.find((r: { type: string }) => r.type === "specification")?.value ??
			"missing",
	)
	console.log(
		"  REQ-ID (request):       ",
		entry.files[0].conversations[0].related?.find((r: { type: string }) => r.type === "request")?.value ??
			"missing",
	)
	console.log(
		"  content_hash in ranges: ",
		entry.files[0].conversations[0].ranges[0]?.content_hash?.startsWith("sha256:") ? "yes" : "no",
	)
	console.log(
		"  expected hash match:    ",
		entry.files[0].conversations[0].ranges[0]?.content_hash === expectedHash ? "yes" : "no",
	)
	console.log("\n=== Scenario done. ===\n")
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
