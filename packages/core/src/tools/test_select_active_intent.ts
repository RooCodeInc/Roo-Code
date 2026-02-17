import { select_active_intent } from "./select_active_intent.js"
// Mock data
const mockActiveIntents: Record<string, { description: string; constraints: string[]; scope: string[] }> = {
	"REQ-001": {
		description: "Initialize MCP server",
		constraints: ["do not write code immediately"],
		scope: ["packages/core/src/tools/"],
	},
	"REQ-002": {
		description: "Add new logging utility",
		constraints: ["log format must match JSONL"],
		scope: ["packages/core/src/utils/"],
	},
}

// Mock function
function readActiveIntent(intentId: string) {
	return mockActiveIntents[intentId]
}

// Test function
function testSelectActiveIntent(intentId: string) {
	const context = select_active_intent(intentId, readActiveIntent)
	console.log("=== Test Result ===")
	console.log(context)
}

// Run test
testSelectActiveIntent("REQ-001")
