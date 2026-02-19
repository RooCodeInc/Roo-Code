// src/tools/intentTools.ts

// Define a local type — Roo Code tools follow this shape (from built-in examples)
interface CustomTool {
	name: string
	description: string
	parameters: {
		type: string
		properties: Record<string, { type: string; description: string }>
		required: string[]
	}
}

export const selectActiveIntent: CustomTool = {
	name: "select_active_intent",
	description:
		"Select and checkout an active intent by ID to load its context, constraints, and scope. " +
		"This MUST be the first action before any code modification or tool that writes/changes files.",
	parameters: {
		type: "object",
		properties: {
			intent_id: {
				type: "string",
				description: 'The unique ID of the intent to checkout (e.g., "INT-001")',
			},
		},
		required: ["intent_id"],
	},
}

// Placeholder executor (real one added later in Phase 1)
export async function executeSelectActiveIntent(args: { intent_id: string }): Promise<string> {
	return `Intent ${args.intent_id} selected (context loading placeholder)`
}
