// Define the Intent type including optional trace info
export type Intent = {
	description: string
	constraints: string[]
	scope: string[]
	trace?: {
		files: string[]
		functions: string[]
	}
}

// Hardcoded intents for Phase 1 with trace
export const intents: Record<string, Intent> = {
	"REQ-001": {
		description: "Initialize MCP server",
		constraints: ["do not write code immediately"],
		scope: ["packages/core/src/tools/"],
		trace: {
			files: ["server.ts"],
			functions: ["initializeServer"],
		},
	},
	"REQ-002": {
		description: "Set up AI-Native IDE",
		constraints: ["analyze user request first"],
		scope: ["packages/core/src/ide/"],
		// No trace needed yet for this intent
	},
}

// Utility to escape XML special characters
function escapeXml(str: string) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Returns intent info as XML (Phase 1 functionality)
export function select_active_intent(intent_id: string): string {
	const intent = intents[intent_id]
	if (!intent) throw new Error("Invalid intent_id")

	const xmlContext = `<intent_context>
  <description>${escapeXml(intent.description)}</description>
  <constraints>${escapeXml(intent.constraints.join(", "))}</constraints>
  <scope>${escapeXml(intent.scope.join(", "))}</scope>
</intent_context>`

	return xmlContext
}
