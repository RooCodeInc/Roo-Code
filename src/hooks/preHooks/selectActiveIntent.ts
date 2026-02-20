/**
 * Pre-hook for select_active_intent
 *
 * Intercepts the select_active_intent call to:
 * 1. Validate the intent ID exists in active_intents.yaml
 * 2. Load intent context (scope, constraints, history)
 * 3. Inject context as XML block into LLM's next prompt
 *
 * This implements the "Reasoning Intercept" from the two-stage state machine.
 */

import { findIntentById } from "../utils/yamlLoader"
import type { ActiveIntent } from "../models/orchestration"

export interface SelectActiveIntentPreHookArgs {
	intent_id: string
}

export interface SelectActiveIntentPreHookResult {
	blocked: boolean
	context?: string
	error?: string
}

/** Context passed by the host (task, workspace root, etc.). */
export type SelectActiveIntentPreHookContext = {
	task?: unknown
	workspaceRoot?: string
	[key: string]: unknown
}

/**
 * Validate INT-XXX format for intent IDs
 */
function isValidIntentIdFormat(intentId: string): boolean {
	return /^INT-\d{3,}$/.test(intentId)
}

/**
 * Build XML context block from intent data
 */
function buildIntentContextXML(intent: ActiveIntent): string {
	const lines: string[] = []
	lines.push(`<intent_context intent_id="${escapeXml(intent.id)}">`)
	lines.push(`  <name>${escapeXml(intent.name)}</name>`)
	lines.push(`  <status>${escapeXml(intent.status)}</status>`)

	if (intent.owned_scope && intent.owned_scope.length > 0) {
		lines.push(`  <owned_scope>`)
		for (const scope of intent.owned_scope) {
			lines.push(`    <path>${escapeXml(scope)}</path>`)
		}
		lines.push(`  </owned_scope>`)
	}

	if (intent.constraints && intent.constraints.length > 0) {
		lines.push(`  <constraints>`)
		for (const constraint of intent.constraints) {
			lines.push(`    <constraint>${escapeXml(constraint)}</constraint>`)
		}
		lines.push(`  </constraints>`)
	}

	if (intent.acceptance_criteria && intent.acceptance_criteria.length > 0) {
		lines.push(`  <acceptance_criteria>`)
		for (const criterion of intent.acceptance_criteria) {
			lines.push(`    <criterion>${escapeXml(criterion)}</criterion>`)
		}
		lines.push(`  </acceptance_criteria>`)
	}

	lines.push(`</intent_context>`)
	return lines.join("\n")
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}

export async function selectActiveIntentPreHook(
	args: SelectActiveIntentPreHookArgs,
	context: SelectActiveIntentPreHookContext,
): Promise<SelectActiveIntentPreHookResult> {
	const { intent_id } = args
	const workspaceRoot = context.workspaceRoot

	// Validate workspace root is provided
	if (!workspaceRoot) {
		return {
			blocked: true,
			error: "Workspace root not provided. Cannot load active intents.",
		}
	}

	// Validate INT-XXX format
	if (!isValidIntentIdFormat(intent_id)) {
		return {
			blocked: true,
			error: `Invalid intent ID format: "${intent_id}". Expected format: INT-XXX (e.g., INT-001, INT-123).`,
		}
	}

	try {
		// Load intent from YAML file
		const intent = await findIntentById(workspaceRoot, intent_id)

		if (!intent) {
			return {
				blocked: true,
				error: `Intent "${intent_id}" not found in .orchestration/active_intents.yaml. Please ensure the intent exists and is properly formatted.`,
			}
		}

		// Build XML context block
		const contextXML = buildIntentContextXML(intent)

		return {
			blocked: false,
			context: contextXML,
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		return {
			blocked: true,
			error: `Failed to load intent context: ${errorMessage}`,
		}
	}
}
