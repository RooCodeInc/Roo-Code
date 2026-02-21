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
 * Optionally include related agent trace entries for consolidated context.
 */
export function buildIntentContextXml(context: IntentContext, relatedTracePaths: string[] = []): string {
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
	const traceXml =
		relatedTracePaths.length > 0
			? relatedTracePaths.map((p) => `  <file>${escapeXml(p)}</file>`).join("\n")
			: "  <file>None yet</file>"

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
  <related_agent_trace>
${traceXml}
  </related_agent_trace>
</intent_context>`
}

/**
 * Load intent from active_intents.yaml, gather related agent_trace entries for that intent,
 * and return a consolidated XML context block (for Pre-Hook injection).
 */
export async function buildConsolidatedIntentContextXml(cwd: string, intentId: string): Promise<string | null> {
	const context = await loadIntentContext(cwd, intentId)
	if (!context) return null
	const traceLines = await readRecentTraceForIntent(cwd, intentId, 20)
	const paths = new Set<string>()
	for (const line of traceLines) {
		try {
			const entry = JSON.parse(line) as { files?: Array<{ relative_path?: string }> }
			for (const f of entry.files ?? []) {
				if (f.relative_path) paths.add(f.relative_path)
			}
		} catch {
			// skip malformed lines
		}
	}
	return buildIntentContextXml(context, [...paths])
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
