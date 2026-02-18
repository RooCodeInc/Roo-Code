import type { ActiveIntent } from "../utils/fileUtils"
import { readActiveIntents } from "../utils/fileUtils"

export async function selectActiveIntent(intentId: string) {
	const intents = await readActiveIntents()
	const found = intents.find((i) => i.id === intentId)
	if (!found) return { error: `Intent ${intentId} not found` }

	const xml = buildIntentXML(found)
	return { intent: found, intent_context_xml: xml }
}

function buildIntentXML(intent: ActiveIntent): string {
	const constraints = (intent.constraints || []).map((c) => `<constraint>${escapeXml(c)}</constraint>`).join("\n")
	const scopes = (intent.owned_scope || []).map((s) => `<scope>${escapeXml(s)}</scope>`).join("\n")

	return `<?xml version="1.0"?>\n<intent_context>\n  <id>${escapeXml(intent.id)}</id>\n  <name>${escapeXml(intent.name || "")}</name>\n  <status>${escapeXml(intent.status || "")}</status>\n  <constraints>\n${constraints}\n  </constraints>\n  <owned_scope>\n${scopes}\n  </owned_scope>\n</intent_context>`
}

function escapeXml(s: string) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&apos;")
}
