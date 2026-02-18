import fs from "fs"
import path from "path"

// Define Intent type
export type Intent = {
	description: string
	constraints: string[]
	scope: string[]
	trace?: {
		files: string[]
		functions: string[]
	}
}

// Path to dynamic JSON intents file
const intentsPath = path.resolve(__dirname, "data/intents.json")

// Load intents from JSON, fallback to hardcoded Phase 1 intents
export function load_intents(): Record<string, Intent> {
	if (fs.existsSync(intentsPath)) {
		const raw = fs.readFileSync(intentsPath, "utf-8")
		return JSON.parse(raw)
	}

	// Phase 1 hardcoded intents
	return {
		"REQ-001": {
			description: "Initialize MCP server",
			constraints: ["do not write code immediately"],
			scope: ["packages/core/src/tools/"],
			trace: { files: ["server.ts"], functions: ["initializeServer"] },
		},
		"REQ-002": {
			description: "Set up AI-Native IDE",
			constraints: ["analyze user request first"],
			scope: ["packages/core/src/ide/"],
		},
	}
}

// Escape XML special characters
function escapeXml(str: string) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Return intent info as XML
export function select_active_intent(intent_id: string): string {
	if (!intent_id) throw new Error("intent_id is required")

	const intents = load_intents()
	const intent = intents[intent_id]
	if (!intent) throw new Error("Invalid intent_id")

	return `<intent_context>
  <description>${escapeXml(intent.description)}</description>
  <constraints>${escapeXml(intent.constraints.join(", "))}</constraints>
  <scope>${escapeXml(intent.scope.join(", "))}</scope>
</intent_context>`
}
