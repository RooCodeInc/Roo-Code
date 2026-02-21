import { appendAgentTrace } from "../src/hooks/post-hook"

async function testTrace() {
	const cwd = process.cwd()

	console.log("🧪 Testing Trace Generation in Demo Workspace\n")

	await appendAgentTrace(cwd, {
		relativePath: "src/api/weather.ts",
		content: "// weather API\nexport function getWeather() {\n  return { temp: 72, condition: 'sunny' };\n}",
		intentId: "INT-001",
		mutationClass: "NEW_FILE",
		reqId: "REQ-123",
		sessionLogId: "SESSION-456",
		modelIdentifier: "test-model",
		vcsRevisionId: "abc123",
	})

	console.log("✅ Trace entry created!")
	console.log("📁 Check .orchestration/agent_trace.jsonl")
}

testTrace().catch(console.error)
