import * as fs from "fs"
import * as path from "path"
import yaml from "js-yaml"
import { PreHook } from "../interfaces"

export function intentHandshakePreHook(root: string): PreHook {
	return {
		async onPreToolUse(invocation) {
			// reserved for turn-enforcement; gate at write-time too
			if (invocation?.tool === "select_active_intent") return
		},
		async onPreWrite({ intentId }) {
			if (!intentId) throw new Error("Gatekeeper: missing intent_id")
			const data = yaml.load(
				fs.readFileSync(path.join(root, ".orchestration/active_intents.yaml"), "utf8"),
			) as any
			const found = (data?.active_intents || []).find((i: any) => i.id === intentId)
			if (!found) throw new Error(`Gatekeeper: unknown intent_id ${intentId}`)
		},
	}
}

export function loadActiveIntentContext(root: string, intentId: string) {
	const file = path.join(root, ".orchestration/active_intents.yaml")
	const data = yaml.load(fs.readFileSync(file, "utf8")) as any
	const intent = (data?.active_intents || []).find((i: any) => i.id === intentId)
	if (!intent) throw new Error(`No such active intent: ${intentId}`)
	const constraints = (intent.constraints || []).map((c: string) => `  <constraint>${c}</constraint>`).join("\n")
	const scope = (intent.owned_scope || []).map((s: string) => `  <path>${s}</path>`).join("\n")
	return [
		"<intent_context>",
		` <id>${intent.id}</id>`,
		` <name>${intent.name}</name>`,
		" <constraints>",
		constraints || "  <constraint/>",
		" </constraints>",
		" <owned_scope>",
		scope || "  <path/>",
		" </owned_scope>",
		"</intent_context>",
	].join("\n")
}
