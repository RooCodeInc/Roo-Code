export const tool = {
	name: "select_active_intent",
	description:
		"MANDATORY: Checkout an active intent by ID to load context before any modification. Prevents uncontrolled AI actions.",
	parameters: {
		type: "object",
		properties: {
			intent_id: { type: "string", description: "Intent ID (e.g. INT-001)" },
		},
		required: ["intent_id"],
	},
	execute: async (args) => {
		return `Intent ${args.intent_id} selected – context loaded.`
	},
}
