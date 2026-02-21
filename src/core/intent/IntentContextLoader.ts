import fs from "fs/promises"
import path from "path"
import * as yaml from "yaml"

export const ACTIVE_INTENTS_RELATIVE_PATH = path.join(".orchestration", "active_intents.yaml")
export const TRACE_LOG_RELATIVE_PATH = ".roo-tool-trace.log"
export const INVALID_ACTIVE_INTENT_ERROR = "You must cite a valid active Intent ID"

export interface IntentContext {
	intent_id: string
	constraints: unknown
	scope: unknown
	relatedTraceEntries: string[]
}

type IntentEntry = Record<string, unknown>

function xmlEscape(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;")
}

function normalizeIntentEntries(data: unknown): IntentEntry[] {
	if (Array.isArray(data)) {
		return data.filter(Boolean) as IntentEntry[]
	}

	if (data && typeof data === "object") {
		const root = data as Record<string, unknown>

		if (Array.isArray(root.active_intents)) {
			return root.active_intents.filter(Boolean) as IntentEntry[]
		}

		if (Array.isArray(root.intents)) {
			return root.intents.filter(Boolean) as IntentEntry[]
		}

		return Object.entries(root).map(([intent_id, entry]) => ({
			intent_id,
			...(entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}),
		}))
	}

	return []
}

function toIntentId(entry: IntentEntry): string {
	return String(entry.intent_id ?? entry.id ?? "").trim()
}

function parseTraceLines(traceContent: string, intentId: string): string[] {
	const normalizedIntentId = intentId.trim()
	if (!normalizedIntentId) {
		return []
	}

	const candidates = traceContent
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)

	return candidates.filter((line) => {
		const lower = line.toLowerCase()
		return (
			line.includes(normalizedIntentId) ||
			lower.includes(`intent_id=${normalizedIntentId.toLowerCase()}`) ||
			lower.includes(`[intent:${normalizedIntentId.toLowerCase()}]`)
		)
	})
}

async function readYamlFile(workspaceRoot: string): Promise<unknown> {
	const yamlPath = path.join(workspaceRoot, ACTIVE_INTENTS_RELATIVE_PATH)
	const content = await fs.readFile(yamlPath, "utf-8")
	return yaml.parse(content)
}

async function readTraceFile(workspaceRoot: string): Promise<string> {
	const tracePath = path.join(workspaceRoot, TRACE_LOG_RELATIVE_PATH)
	try {
		return await fs.readFile(tracePath, "utf-8")
	} catch {
		return ""
	}
}

export async function loadIntentContext(workspaceRoot: string, intentId: string): Promise<IntentContext | null> {
	const data = await readYamlFile(workspaceRoot)
	const intents = normalizeIntentEntries(data)
	const match = intents.find((entry) => toIntentId(entry) === intentId.trim())

	if (!match) {
		return null
	}

	const traceContent = await readTraceFile(workspaceRoot)
	const relatedTraceEntries = parseTraceLines(traceContent, intentId)

	return {
		intent_id: toIntentId(match),
		constraints: match.constraints ?? {},
		scope: match.scope ?? {},
		relatedTraceEntries,
	}
}

export function renderIntentContextXml(context: Pick<IntentContext, "constraints" | "scope">): string {
	const constraintsJson = xmlEscape(JSON.stringify(context.constraints ?? {}, null, 2))
	const scopeJson = xmlEscape(JSON.stringify(context.scope ?? {}, null, 2))

	return `<intent_context>\n  <constraints>${constraintsJson}</constraints>\n  <scope>${scopeJson}</scope>\n</intent_context>`
}

export function renderIntentPreHookXml(context: IntentContext): string {
	const traceXml =
		context.relatedTraceEntries.length > 0
			? `\n  <related_trace>\n${context.relatedTraceEntries
					.map((entry) => `    <entry>${xmlEscape(entry)}</entry>`)
					.join("\n")}\n  </related_trace>`
			: ""

	const constraintsJson = xmlEscape(JSON.stringify(context.constraints ?? {}, null, 2))
	const scopeJson = xmlEscape(JSON.stringify(context.scope ?? {}, null, 2))

	return `<intent_context_snapshot>\n  <intent_id>${xmlEscape(context.intent_id)}</intent_id>\n  <constraints>${constraintsJson}</constraints>\n  <scope>${scopeJson}</scope>${traceXml}\n</intent_context_snapshot>`
}
