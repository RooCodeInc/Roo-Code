import { select_active_intent } from "./select_active_intent.js"

// Test function
function testSelectActiveIntent(intentId: string) {
	const context = select_active_intent(intentId) // only 1 argument
	console.log("=== Test Result ===")
	console.log(context)
}

// Run test
testSelectActiveIntent("REQ-001")
