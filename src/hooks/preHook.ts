import fs from "fs"
import yaml from "js-yaml"
export async function preHook(command: string, args: any) {
	// Load active intents
	const intents = yaml.load(fs.readFileSync(".orchestration/active_intents.yaml", "utf8"))

	// Ensure the agent selects an intent
	if (!args.intent_id || !intents.active_intents.find((i: any) => i.id === args.intent_id)) {
		return { allowed: false, reason: "You must cite a valid active Intent ID" }
	}

	// Enforce scope
	const intent = intents.active_intents.find((i: any) => i.id === args.intent_id)
	if (!intent.owned_scope.some((pattern: string) => args.file?.startsWith(pattern.replace("/**", "")))) {
		return { allowed: false, reason: `Scope Violation: ${args.intent_id} cannot edit ${args.file}` }
	}

	return { allowed: true }
}
