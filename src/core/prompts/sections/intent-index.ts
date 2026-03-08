import { Intent } from "../../intents/types"

export function intentIndexSection(intents: Intent[]) {
	const rows = (intents ?? []).slice(0, 30).map((i) => {
		const scope = (i.owned_scopes ?? []).slice(0, 4).join(", ")
		return `- ${i.id}: ${i.name} [${i.status}] scope: ${scope}${(i.owned_scopes?.length ?? 0) > 4 ? ", ..." : ""}`
	})

	const extra =
		(intents?.length ?? 0) > 30 ? `\n(Showing 30 of ${intents.length}. Use list_active_intents for full list.)` : ""

	return `
[ACTIVE INTENT INDEX]
${rows.length ? rows.join("\n") : "- (none found)"}${extra}
`.trim()
}
