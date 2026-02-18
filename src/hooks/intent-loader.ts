/**
 * Intent context loader for .orchestration/active_intents.yaml
 *
 * This module loads intent context from the orchestration layer and formats it
 * for injection into the LLM prompt. Intents provide structured context about
 * what the agent is working on, related files, and objectives.
 */

import type { IntentContext } from "./types"

/**
 * Loads intent context from .orchestration/active_intents.yaml
 *
 * @param intentId - The intent identifier selected by the agent
 * @returns XML-formatted context block for prompt injection
 *
 * @example
 * const context = await loadIntentContext("INTENT-001")
 * // Returns: <intent_context intent_id="INTENT-001">...</intent_context>
 */
export async function loadIntentContext(intentId: string): Promise<string> {
	// TODO: Implementation for Phase 1
	// 1. Read .orchestration/active_intents.yaml
	// 2. Parse YAML and find matching intent
	// 3. Format as XML block

	return `<intent_context intent_id="${intentId}"><!-- context injected here --></intent_context>`
}

/**
 * Parses intent metadata from .orchestration/active_intents.yaml
 *
 * @param cwd - Workspace root directory
 * @returns Array of available intents
 *
 * @example
 * const intents = await parseActiveIntents("/workspace")
 * console.log(intents.map(i => i.intentId))
 */
export async function parseActiveIntents(cwd: string): Promise<IntentContext[]> {
	// TODO: Implementation for Phase 1
	// 1. Check if .orchestration/active_intents.yaml exists
	// 2. Parse YAML file
	// 3. Transform into IntentContext objects

	return []
}

/**
 * Formats an IntentContext into XML for prompt injection.
 *
 * @param intent - The intent context to format
 * @returns XML string ready for prompt injection
 *
 * @example
 * const intent = { intentId: "INTENT-001", title: "Fix auth bug", context: "..." }
 * const xml = formatIntentAsXml(intent)
 * // Returns: <intent_context intent_id="INTENT-001"><title>Fix auth bug</title>...</intent_context>
 */
export function formatIntentAsXml(intent: IntentContext): string {
	// TODO: Implementation for Phase 1

	const parts: string[] = [
		`<intent_context intent_id="${escapeXml(intent.intentId)}">`,
		`  <title>${escapeXml(intent.title)}</title>`,
		`  <context>${escapeXml(intent.context)}</context>`,
	]

	if (intent.files && intent.files.length > 0) {
		parts.push(`  <related_files>`)
		for (const file of intent.files) {
			parts.push(`    <file>${escapeXml(file)}</file>`)
		}
		parts.push(`  </related_files>`)
	}

	if (intent.metadata) {
		parts.push(`  <metadata>`)
		for (const [key, value] of Object.entries(intent.metadata)) {
			parts.push(`    <${key}>${escapeXml(String(value))}</${key}>`)
		}
		parts.push(`  </metadata>`)
	}

	parts.push(`</intent_context>`)

	return parts.join("\n")
}

/**
 * Escapes special XML characters.
 * @internal
 */
function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}

/**
 * Checks if intent context is available for the current workspace.
 *
 * @param cwd - Workspace root directory
 * @returns true if .orchestration/active_intents.yaml exists
 *
 * @example
 * if (await hasIntentContext("/workspace")) {
 *   const intents = await parseActiveIntents("/workspace")
 * }
 */
export async function hasIntentContext(cwd: string): Promise<boolean> {
	// TODO: Implementation for Phase 1
	// Check if .orchestration/active_intents.yaml exists

	return false
}
