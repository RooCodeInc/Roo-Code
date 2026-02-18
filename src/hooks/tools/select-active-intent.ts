import { ToolCall, ToolHookContext } from "../types"
import { loadActiveIntents } from "../utils/yaml-store"

export interface SelectActiveIntentParams {
	intent_id: string
}

export async function handleSelectActiveIntent(
	params: SelectActiveIntentParams,
	context: ToolHookContext,
): Promise<{ success: boolean; intent_id: string; context_injected: boolean; message: string; xml_context: string }> {
	const intents = await loadActiveIntents(context.workspacePath)

	const intent = intents.find((i) => i.id === params.intent_id)
	if (!intent) {
		throw new Error(`Invalid intent_id: ${params.intent_id}. Available: ${intents.map((i) => i.id).join(", ")}`)
	}

	const contextXml = `
<intent_context>
  <id>${intent.id}</id>
  <name>${intent.name}</name>
  <scope>
    ${intent.owned_scope.map((f: string) => `    <file pattern="${f}"/>`).join("\n")}
  </scope>
  <constraints>
    ${intent.constraints.map((c: string) => `    <constraint>${escapeXml(c)}</constraint>`).join("\n")}
  </constraints>
  <acceptance_criteria>
    ${intent.acceptance_criteria.map((ac: string) => `    <criterion>${escapeXml(ac)}</criterion>`).join("\n")}
  </acceptance_criteria>
</intent_context>`

	return {
		success: true,
		intent_id: params.intent_id,
		context_injected: true,
		message: `Context loaded for ${intent.name}. Proceed with code generation within defined scope.`,
		xml_context: contextXml,
	}
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}
