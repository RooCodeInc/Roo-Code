import type { PreHook } from "../types"
import { readActiveIntents } from "../utils/fileUtils"

export const contextLoader: PreHook = async (ctx) => {
	if (!ctx.intentId) return

	const intents = await readActiveIntents()
	const intent = intents.find((i) => i.id === ctx.intentId)
	if (!intent) return

	const constraints = intent.constraints || []
	const owned_scope = intent.owned_scope || []

	const xml = `<?xml version="1.0"?>\n<intent_context>\n  <id>${intent.id}</id>\n  <name>${intent.name || ""}</name>\n  <constraints>\n${constraints.map((c) => `    <constraint>${c}</constraint>`).join("\n")}\n  </constraints>\n  <owned_scope>\n${owned_scope.map((s) => `    <scope>${s}</scope>`).join("\n")}\n  </owned_scope>\n</intent_context>`

	ctx.metadata = { ...(ctx.metadata || {}), intent, intentContextXML: xml }
}
