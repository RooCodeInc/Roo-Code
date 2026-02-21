import fs from "fs/promises"
import path from "path"
import yaml from "yaml"

import type { IntentContext, ActiveIntentsDoc } from "./types"

const ORCHESTRATION_DIR = ".orchestration"
const ACTIVE_INTENTS_FILE = "active_intents.yaml"
const AGENT_TRACE_FILE = "agent_trace.jsonl"

/**
 * Loads intent context from .orchestration/active_intents.yaml for the given intent ID.
 * Used by the Pre-Hook when the agent calls select_active_intent.
 */
export async function loadIntentContext(cwd: string, intentId: string): Promise<IntentContext | null> {
	const filePath = path.join(cwd, ORCHESTRATION_DIR, ACTIVE_INTENTS_FILE)
	try {
		const raw = await fs.readFile(filePath, "utf-8")
		const doc = yaml.parse(raw) as ActiveIntentsDoc
		const intent = doc?.active_intents?.find((i) => i.id === intentId)
		if (!intent) return null
		return {
			id: intent.id,
			name: intent.name,
			status: intent.status,
			constraints: intent.constraints ?? [],
			owned_scope: intent.owned_scope ?? [],
			acceptance_criteria: intent.acceptance_criteria,
		}
	} catch {
		return null
	}
}

/**
 * Build an XML block to inject as the tool result for select_active_intent.
 */
export function buildIntentContextXml(context: IntentContext): string {
	const constraintsXml =
		context.constraints.length > 0
			? context.constraints.map((c) => `  <constraint>${escapeXml(c)}</constraint>`).join("\n")
			: "  <constraint>None specified</constraint>"
	const scopeXml =
		context.owned_scope.length > 0
			? context.owned_scope.map((s) => `  <scope>${escapeXml(s)}</scope>`).join("\n")
			: "  <scope>No scope restriction</scope>"
	const criteriaXml =
		(context.acceptance_criteria?.length ?? 0) > 0
			? context.acceptance_criteria!.map((a) => `  <criterion>${escapeXml(a)}</criterion>`).join("\n")
			: "  <criterion>None specified</criterion>"

	return `<intent_context>
  <id>${escapeXml(context.id)}</id>
  <name>${escapeXml(context.name)}</name>
  <status>${escapeXml(context.status)}</status>
  <constraints>
${constraintsXml}
  </constraints>
  <owned_scope>
${scopeXml}
  </owned_scope>
  <acceptance_criteria>
${criteriaXml}
  </acceptance_criteria>
</intent_context>`
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}

/**
 * Read recent agent trace lines for an intent (optional: for "related history" in context).
 */
export async function readRecentTraceForIntent(cwd: string, intentId: string, limit: number = 20): Promise<string[]> {
	const filePath = path.join(cwd, ORCHESTRATION_DIR, AGENT_TRACE_FILE)
	try {
		const raw = await fs.readFile(filePath, "utf-8")
		const lines = raw.trim().split("\n").filter(Boolean)
		const related: string[] = []
		for (let i = lines.length - 1; i >= 0 && related.length < limit; i--) {
			const entry = JSON.parse(lines[i]) as {
				files?: Array<{ conversations?: Array<{ related?: Array<{ value: string }> }> }>
			}
			for (const f of entry.files ?? []) {
				for (const conv of f.conversations ?? []) {
					for (const r of conv.related ?? []) {
						if (r.value === intentId) {
							related.push(lines[i])
							break
						}
					}
				}
			}
		}
		return related
	} catch {
		return []
	}
}
