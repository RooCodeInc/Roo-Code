/**
 * Manual Test Script for Hook System Trace File Creation
 *
 * This script tests the HookEngine and TraceLogger directly to verify
 * that trace files are created correctly.
 *
 * Run with: npx ts-node src/__tests__/scripts/manual-trace-full-test.ts
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { HookEngine } from "../../hooks/HookEngine"
import { classifyMutation, logTrace } from "../../hooks/TraceLogger"
import { initializeHookEngine, resetHookEngine } from "../../hooks/index"

async function main() {
	console.log("=== Manual Hook System Test ===\n")

	// Reset any previous state
	resetHookEngine()

	// Create a temporary workspace directory
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-trace-test-"))
	console.log(`Test workspace: ${tempDir}`)

	// Create .orchestration directory
	const orchestrationDir = path.join(tempDir, ".orchestration")
	fs.mkdirSync(orchestrationDir, { recursive: true })
	console.log(`Orchestration dir: ${orchestrationDir}`)

	// Create some test files
	const testFile1 = path.join(tempDir, "src", "test.ts")
	const testFile2 = path.join(tempDir, "src", "utils", "helper.ts")
	fs.mkdirSync(path.dirname(testFile1), { recursive: true })
	fs.mkdirSync(path.dirname(testFile2), { recursive: true })
	fs.writeFileSync(testFile1, "console.log('hello');\n")
	fs.writeFileSync(testFile2, "export const helper = 42;\n")
	console.log(`Created test files: ${testFile1}, ${testFile2}\n`)

	// Initialize the HookEngine
	const taskId = "test-task-123"
	const instanceId = "test-instance-456"
	initializeHookEngine(tempDir, taskId, instanceId)

	const hookEngine = HookEngine.getInstance()

	// Get the active intent ID (should be set after initializeHookEngine with setActiveIntent)
	// The context should be available via the session state
	const context = {
		taskId,
		instanceId,
		cwd: tempDir,
		toolName: "write_to_file",
		toolParams: { file_path: "src/test.ts", content: "new content" },
		activeIntentId: null as string | null,
	}

	// Test 1: Set active intent
	console.log("=== Test 1: Set Active Intent ===")
	const intentResult = await hookEngine.setActiveIntent("intent-1")
	console.log("Set intent result:", intentResult)
	console.log("Active intent ID:", hookEngine.getActiveIntentId())

	// Update context with active intent
	context.activeIntentId = hookEngine.getActiveIntentId()
	console.log("")

	// Test 2: Pre-Hook (should allow write to file in scope)
	console.log("=== Test 2: Pre-Hook (write in scope) ===")
	const preResult1 = await hookEngine.preHook({
		...context,
		toolName: "write_to_file",
		toolParams: { file_path: "src/test.ts", content: "new content" },
	})
	console.log("Pre-hook result:", preResult1)
	console.log("")

	// Test 3: Pre-Hook (should block write to file outside scope)
	console.log("=== Test 3: Pre-Hook (write outside scope - should block) ===")
	const preResult2 = await hookEngine.preHook({
		...context,
		toolName: "write_to_file",
		toolParams: { file_path: "src/outside/scope.ts", content: "blocked" },
	})
	console.log("Pre-hook result:", preResult2)
	console.log("")

	// Test 4: Post-Hook (trace creation)
	console.log("=== Test 4: Post-Hook (trace creation) ===")

	// Read original content for mutation classification
	const originalContent = fs.readFileSync(testFile1, "utf-8")
	const newContent = "console.log('updated');\n"

	// Classify the mutation
	const mutationClass = classifyMutation(originalContent, newContent)
	console.log("Mutation class:", mutationClass)

	const postResult = await hookEngine.postHook(
		{
			...context,
			toolName: "write_to_file",
			toolParams: { file_path: "src/test.ts", content: newContent },
		},
		"File written successfully",
		mutationClass,
	)
	console.log("Post-hook result:", postResult)
	console.log("")

	// Test 5: Verify trace file was created
	console.log("=== Test 5: Verify Trace File ===")
	const traceFile = path.join(orchestrationDir, "agent_trace.jsonl")
	if (fs.existsSync(traceFile)) {
		const traceContent = fs.readFileSync(traceFile, "utf-8")
		const traceLines = traceContent
			.trim()
			.split("\n")
			.filter((line) => line.trim())
		console.log(`Trace file exists at: ${traceFile}`)
		console.log(`Number of trace entries: ${traceLines.length}`)

		if (traceLines.length > 0) {
			console.log("\nTrace entries:")
			traceLines.forEach((line, i) => {
				try {
					const entry = JSON.parse(line)
					console.log(`  ${i + 1}.`, JSON.stringify(entry, null, 2))
				} catch {
					console.log(`  ${i + 1}. (parse error)`, line)
				}
			})
		}
	} else {
		console.log(`Trace file NOT found at: ${traceFile}`)
	}
	console.log("")

	// Test 6: Complete the intent
	console.log("=== Test 6: Complete Intent ===")
	await hookEngine.updateIntentStatus("intent-1", "COMPLETED")
	console.log("Intent completed, active intent cleared:", hookEngine.getActiveIntentId())
	console.log("")

	// Cleanup
	console.log("=== Test Complete ===")
	console.log(`\nTest files left at: ${tempDir}`)
	console.log(`To view trace file: cat "${traceFile}"`)
	console.log(`To clean up: rm -rf "${tempDir}"`)
}

main().catch(console.error)
