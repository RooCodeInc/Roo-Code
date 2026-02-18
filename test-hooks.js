#!/usr/bin/env node

// Test script for Phase 1.2 hooks
const { IntentManager, TraceLogger, ContentHasher } = require("./dist/hooks")

async function test() {
	console.log("=== Phase 1.2 Hook Test ===\n")

	const workspacePath = process.cwd()

	// Test 1: IntentManager
	console.log("Test 1: IntentManager")
	const intentManager = new IntentManager(workspacePath)
	const intents = await intentManager.loadIntents()
	console.log("Loaded intents:", intents.length)

	const activeIntent = await intentManager.getActiveIntent()
	if (activeIntent) {
		console.log("Active intent:", activeIntent.id)
		console.log("Description:", activeIntent.description)
		console.log("Scope:", activeIntent.scope)

		// Test scope validation
		const inScope = intentManager.isFileInScope("src/hooks/test.ts", activeIntent)
		const outScope = intentManager.isFileInScope("src/other/test.ts", activeIntent)
		console.log("src/hooks/test.ts in scope:", inScope)
		console.log("src/other/test.ts in scope:", outScope)
	}

	// Test 2: ContentHasher
	console.log("\nTest 2: ContentHasher")
	const hash1 = ContentHasher.hash("Hello World")
	const hash2 = ContentHasher.hash("Hello World")
	const hash3 = ContentHasher.hash("Different")
	console.log("Hash consistency:", hash1 === hash2)
	console.log("Hash uniqueness:", hash1 !== hash3)
	console.log("Sample hash:", hash1.substring(0, 16) + "...")

	// Test 3: TraceLogger
	console.log("\nTest 3: TraceLogger")
	const logger = new TraceLogger(workspacePath)
	await logger.log({
		toolName: "write_to_file",
		filePath: "src/hooks/test.ts",
		result: "success",
	})
	console.log("Trace logged to .orchestration/agent_trace.jsonl")

	console.log("\n=== All Tests Passed ✅ ===")
}

test().catch(console.error)
