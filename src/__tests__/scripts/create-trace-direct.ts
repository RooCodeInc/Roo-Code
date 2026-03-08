/**
 * Simple script to create agent_trace.jsonl directly
 *
 * This creates the trace file without needing the full hook system integration.
 * Run with: npx ts-node src/__tests__/scripts/create-trace-direct.ts
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"

// Get workspace path from command line or use temp directory
const workspacePath = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "trace-test-"))
const orchestrationDir = path.join(workspacePath, ".orchestration")

// Ensure directory exists
if (!fs.existsSync(orchestrationDir)) {
	fs.mkdirSync(orchestrationDir, { recursive: true })
}

// Create trace entries
const traceEntries = [
	{
		id: "trace-" + Date.now() + "-1",
		timestamp: new Date().toISOString(),
		vcs: {
			revision_id: "abc1234",
		},
		files: [
			{
				relative_path: "src/components/Feature.tsx",
				conversations: [
					{
						url: "task-123",
						contributor: {
							entity_type: "AI",
							model_identifier: "claude-4-sonnet",
						},
						ranges: [
							{
								start_line: 1,
								end_line: 50,
								content_hash: "sha256:abc123...",
							},
						],
						related: [
							{
								type: "intent",
								value: "feature-auth",
							},
						],
					},
				],
			},
		],
	},
	{
		id: "trace-" + Date.now() + "-2",
		timestamp: new Date().toISOString(),
		vcs: {
			revision_id: "def5678",
		},
		files: [
			{
				relative_path: "src/utils/auth.ts",
				conversations: [
					{
						url: "task-123",
						contributor: {
							entity_type: "AI",
							model_identifier: "claude-4-sonnet",
						},
						ranges: [
							{
								start_line: 1,
								end_line: 25,
								content_hash: "sha256:def456...",
							},
						],
						related: [
							{
								type: "intent",
								value: "feature-auth",
							},
						],
					},
				],
			},
		],
	},
]

// Write to file (JSONL format - one JSON object per line)
const tracePath = path.join(orchestrationDir, "agent_trace.jsonl")
const content = traceEntries.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
fs.writeFileSync(tracePath, content, "utf-8")

console.log(`Created: ${tracePath}`)
console.log(`\nFile contents:\n`)
console.log(fs.readFileSync(tracePath, "utf-8"))

console.log(`\nWorkspace: ${workspacePath}`)
