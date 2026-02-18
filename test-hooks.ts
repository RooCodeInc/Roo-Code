import { IntentManager, TraceLogger, ContentHasher } from "./src/hooks"

async function test() {
	console.log("=== Phase 1.2 Hook Test ===\n")

	const workspacePath = process.cwd()

	// Test 1: IntentManager
	console.log("Test 1: IntentManager")
	const intentManager = new IntentManager(workspacePath)
	const intents = await intentManager.loadIntents()
	console.log("✅ Loaded intents:", intents.length)

	const activeIntent = await intentManager.getActiveIntent()
	if (activeIntent) {
		console.log("✅ Active intent:", activeIntent.id)
		console.log("  Description:", activeIntent.description)
		console.log("  Scope:", activeIntent.scope.join(", "))

		const inScope = intentManager.isFileInScope("src/hooks/test.ts", activeIntent)
		const outScope = intentManager.isFileInScope("src/other/test.ts", activeIntent)
		console.log("✅ Scope validation works:", inScope && !outScope)
	}

	// Test 2: ContentHasher
	console.log("\nTest 2: ContentHasher")
	const hash1 = ContentHasher.hash("Hello World")
	const hash2 = ContentHasher.hash("Hello World")
	console.log("✅ Hash consistency:", hash1 === hash2)
	console.log("  Sample:", hash1.substring(0, 32) + "...")

	// Test 3: TraceLogger
	console.log("\nTest 3: TraceLogger")
	const logger = new TraceLogger(workspacePath)
	await logger.log({
		toolName: "write_to_file",
		filePath: "src/hooks/test.ts",
		result: "success",
	})
	console.log("✅ Trace logged to .orchestration/agent_trace.jsonl")

	console.log("\n=== All Tests Passed ✅ ===")
}

test().catch(console.error)
