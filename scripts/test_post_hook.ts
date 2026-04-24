import path from "path"
import { appendAgentTrace } from "./post-hook" // adjust path if needed
import fs from "fs/promises"

async function runTest() {
	const cwd = process.cwd()
	const testFile = "src/test_file.txt"

	// Ensure the src folder exists
	await fs.mkdir(path.join(cwd, "src"), { recursive: true })

	// Call your Post-Hook
	await appendAgentTrace(cwd, {
		relativePath: testFile,
		content: "console.log('hello world')",
		intentId: "INT-001",
		mutationClass: "CREATE",
		reqId: "REQ-123",
		sessionLogId: "SESSION-456",
	})

	console.log("✅ Test completed. Check .orchestration/agent_trace.jsonl and intent_map.md")
}

runTest()
