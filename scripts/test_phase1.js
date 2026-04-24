const fs = require("fs")
const path = require("path")

// Load active intents
const intentsPath = path.join(__dirname, "..", ".orchestration", "active_intents.yaml")
const yaml = require("js-yaml")
const intents = yaml.load(fs.readFileSync(intentsPath, "utf8")).active_intents

// Simple PreHook simulation
function preHook(intentId, targetFile) {
	const intent = intents.find((i) => i.id === intentId)
	if (!intent) {
		throw new Error("You must select a valid active Intent ID before writing code.")
	}

	const allowed = intent.owned_scope.some((scope) => targetFile.startsWith(scope.replace("**", "")))
	if (!allowed) {
		throw new Error(`Scope Violation: ${intentId} is not authorized to edit ${targetFile}`)
	}

	console.log(`PreHook Passed: ${targetFile} is within scope for ${intentId}`)
}

// Simulate AI writing a file
function writeFile(intentId, filePath, content) {
	preHook(intentId, filePath)
	fs.writeFileSync(filePath, content)
	console.log(`File written successfully: ${filePath}`)
}

// === TEST CASES ===
try {
	// Valid case
	writeFile("INT-001", "src/api/weather.ts", "// Weather API code here")

	// Invalid scope
	writeFile("INT-001", "src/db/db.ts", "// DB code here")
} catch (err) {
	console.error("Error:", err.message)
}

try {
	// Invalid intent
	writeFile("INT-999", "src/api/weather.ts", "// Should fail")
} catch (err) {
	console.error("Error:", err.message)
}
