import type { PreHook } from "../types"
import { readActiveIntents } from "../utils/fileUtils"

export const intentValidator: PreHook = async (ctx) => {
	if (!ctx.intentId) throw new Error("You must cite a valid active Intent ID.")

	const intents = await readActiveIntents()
	const found = intents.find((i) => i.id === ctx.intentId)
	if (!found) throw new Error(`You must cite a valid active Intent ID. Intent ${ctx.intentId} not found.`)
}
