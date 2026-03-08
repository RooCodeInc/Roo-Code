/**
 * Manual Trace File Creation Script
 *
 * Run this script to manually create an agent_trace.jsonl file
 * Usage: npx ts-node src/__tests__/scripts/manual-trace-test.ts
 */

import * as fs from "fs"
import * as path from "path"
import { logTrace } from "../../hooks/TraceLogger"
import { ensureOrchestrationDir, saveActiveIntents, type ActiveIntentsData } from "../../hooks/types"

// Configuration
const WORKSPACE_PATH = process.argv[2] || process.cwd()
const TEST_INTENT_ID = "test-intent-1"
const TEST_TASK_ID = "test-task-123"

async function main() {
	console.log(`Creating trace file in: ${WORKSPACE_PATH}`)

	// Ensure .orchestration directory exists
	await ensureOrchestrationDir(WORKSPACE_PATH)

	// Create a test active_intents.yaml file
	const intentsData: ActiveIntentsData = {
		active_intents: [
			{
				id: TEST_INTENT_ID,
				name: "Test Feature",
				status: "IN_PROGRESS",
				owned_scope: ["src/**/*"],
				constraints: ["Test constraint"],
				acceptance_criteria: ["Tests pass"],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
		],
	}
	await saveActiveIntents(WORKSPACE_PATH, intentsData)
	console.log("Created active_intents.yaml")

	// Create trace entries
	console.log("Creating trace entries...")

	// Trace entry 1
	await logTrace({
		workspacePath: WORKSPACE_PATH,
		taskId: TEST_TASK_ID,
		instanceId: "instance-001",
		intentId: TEST_INTENT_ID,
		filePath: "src/components/Test.tsx",
		content: "export const Test = () => <div>Hello</div>",
		startLine: 1,
		endLine: 1,
		modelIdentifier: "claude-4-sonnet",
		mutationClass: "INTENT_EVOLUTION",
	})

	// Trace entry 2
	await logTrace({
		workspacePath: WORKSPACE_PATH,
		taskId: TEST_TASK_ID,
		instanceId: "instance-001",
		intentId: TEST_INTENT_ID,
		filePath: "src/utils/helper.ts",
		content: "export function helper() { return true; }",
		startLine: 1,
		endLine: 1,
		mutationClass: "AST_REFACTOR",
	})

	// Trace entry 3
	await logTrace({
		workspacePath: WORKSPACE_PATH,
		taskId: TEST_TASK_ID,
		instanceId: "instance-001",
		intentId: TEST_INTENT_ID,
		filePath: "README.md",
		content: "# Test Project",
		startLine: 1,
		endLine: 1,
		mutationClass: "DOCUMENTATION",
	})

	// Verify file was created
	const tracePath = path.join(WORKSPACE_PATH, ".orchestration", "agent_trace.jsonl")
	if (fs.existsSync(tracePath)) {
		console.log(`\n✓ Trace file created: ${tracePath}`)
		console.log("\nFile contents:")
		const content = fs.readFileSync(tracePath, "utf-8")
		content
			.split("\n")
			.filter(Boolean)
			.forEach((line, i) => {
				const entry = JSON.parse(line)
				console.log(`\n--- Entry ${i + 1} ---`)
				console.log(`File: ${entry.files[0].relative_path}`)
				console.log(`Intent: ${entry.files[0].conversations[0].related[0].value}`)
				console.log(`Mutation: ${entry.files[0].conversations[0].ranges[0].content_hash}`)
			})
	} else {
		console.error("Failed to create trace file")
	}
}

main().catch(console.error)
