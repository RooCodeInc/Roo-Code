const { PreHook } = require("../src/hooks/pre-hook")

async function testGuardrails() {
	const cwd = process.cwd()
	let activeIntentId = null

	const preHook = new PreHook({
		cwd,
		getActiveIntentId: () => activeIntentId,
		setActiveIntentId: (id) => {
			activeIntentId = id
		},
		requireIntentForDestructiveOnly: true,
	})

	console.log("🧪 Testing Guardrails in Demo Workspace\n")

	// Test 1: No intent ID
	console.log("1. Testing write_to_file WITHOUT intent ID:")
	const result1 = await preHook.intercept("write_to_file", {
		path: "src/config/app.ts",
		content: "// config",
	})
	console.log("   Blocked:", result1.blocked)
	console.log("   Error:", result1.error?.substring(0, 100) + "...")

	// Test 2: Select valid intent
	console.log("\n2. Testing select_active_intent with INT-001:")
	const result2 = await preHook.intercept("select_active_intent", {
		intent_id: "INT-001",
	})
	console.log("   Blocked:", result2.blocked)
	console.log("   InjectResult:", result2.injectResult ? "XML injected" : "None")
	activeIntentId = "INT-001"

	// Test 3: Scope violation
	console.log("\n3. Testing write_to_file with scope violation:")
	const result3 = await preHook.intercept("write_to_file", {
		path: "src/db/database.ts",
		content: "// database",
	})
	console.log("   Blocked:", result3.blocked)
	console.log("   Error:", result3.error?.substring(0, 100) + "...")

	// Test 4: Valid scope
	console.log("\n4. Testing write_to_file in valid scope:")
	const result4 = await preHook.intercept("write_to_file", {
		path: "src/api/weather.ts",
		content: "// weather API",
	})
	console.log("   Blocked:", result4.blocked)
	console.log("   Error:", result4.error || "None")

	console.log("\n✅ Guardrail tests completed!")
}

testGuardrails().catch(console.error)
