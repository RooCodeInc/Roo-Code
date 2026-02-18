/**
 * Active Intents YAML Loader
 *
 * Reads and parses `.orchestration/active_intents.yaml` from the workspace root.
 * This is the data source for the Intent Handshake protocol.
 *
 * The file is expected to contain a list of intents with the following structure:
 *
 * ```yaml
 * intents:
 *   - id: "refactor-auth-module"
 *     goal: "Refactor the authentication module"
 *     status: "IN_PROGRESS"
 *     constraints:
 *       - "Must maintain backward compatibility"
 *       - "No new dependencies"
 *     scope:
 *       - "src/auth/**"
 *   - id: "add-logging"
 *     goal: "Add structured logging"
 *     status: "COMPLETED"
 *     constraints: []
 *     scope:
 *       - "src/**"
 * ```
 */

import * as fs from "fs"
import * as path from "path"

/**
 * Path to the active intents YAML file, relative to workspace root.
 */
export const ACTIVE_INTENTS_PATH = ".orchestration/active_intents.yaml"

/**
 * Represents a single intent entry parsed from active_intents.yaml.
 */
export interface ActiveIntent {
	id: string
	goal: string
	status: string
	constraints: string[]
	scope: string[]
}

/**
 * A single trace event recorded during intent-governed tool execution.
 * Kept intentionally lightweight to avoid context window bloat.
 */
export interface IntentTraceEvent {
	/** The tool that was executed */
	toolName: string
	/** One-line summary of what the tool did */
	summary: string
	/** Whether the tool succeeded or failed */
	outcome: "success" | "error"
	/** ISO timestamp of the event */
	timestamp: string
	/** The intent_id this event is associated with */
	intentId: string
}

/**
 * Maximum number of trace entries included in <intent_context>.
 * Prevents context window bloat while still providing recent history.
 */
export const MAX_TRACE_ENTRIES = 10

/**
 * Lightweight YAML parser for the active_intents.yaml format.
 *
 * Handles the specific YAML structure used by active_intents.yaml without
 * requiring a full YAML library dependency. Supports:
 * - Top-level `intents:` key with list items
 * - String scalar fields (id, goal, status)
 * - String array fields (constraints, scope) using `- ` list syntax
 * - Quoted and unquoted string values
 */
function parseActiveIntentsYaml(content: string): ActiveIntent[] {
	const intents: ActiveIntent[] = []
	const lines = content.split("\n")

	let inIntentsBlock = false
	let currentIntent: Partial<ActiveIntent> | null = null
	let currentArrayField: string | null = null

	for (const rawLine of lines) {
		const line = rawLine.replace(/\r$/, "") // Handle CRLF

		// Skip empty lines and comments
		if (line.trim() === "" || line.trim().startsWith("#")) {
			continue
		}

		// Detect top-level `intents:` key
		if (/^intents:\s*$/.test(line)) {
			inIntentsBlock = true
			continue
		}

		if (!inIntentsBlock) {
			continue
		}

		// New intent item (starts with `  - id:` or `  -`)
		const newItemMatch = line.match(/^\s{2}-\s+id:\s*["']?(.+?)["']?\s*$/)
		if (newItemMatch) {
			// Save previous intent if valid
			if (currentIntent && currentIntent.id) {
				intents.push(normalizeIntent(currentIntent))
			}
			currentIntent = {
				id: newItemMatch[1],
				goal: "",
				status: "",
				constraints: [],
				scope: [],
			}
			currentArrayField = null
			continue
		}

		if (!currentIntent) {
			continue
		}

		// Field with scalar value (4 spaces indent): `    goal: "..."` or `    status: IN_PROGRESS`
		const scalarMatch = line.match(/^\s{4}(\w+):\s*["']?(.+?)["']?\s*$/)
		if (scalarMatch) {
			const [, key, value] = scalarMatch
			if (key === "goal" || key === "status") {
				;(currentIntent as any)[key] = value
			}
			currentArrayField = null
			continue
		}

		// Field with array start (4 spaces indent): `    constraints:` or `    scope:`
		const arrayStartMatch = line.match(/^\s{4}(\w+):\s*$/)
		if (arrayStartMatch) {
			const key = arrayStartMatch[1]
			if (key === "constraints" || key === "scope") {
				currentArrayField = key
				if (!(currentIntent as any)[key]) {
					;(currentIntent as any)[key] = []
				}
			}
			continue
		}

		// Empty array shorthand: `    constraints: []`
		const emptyArrayMatch = line.match(/^\s{4}(\w+):\s*\[\]\s*$/)
		if (emptyArrayMatch) {
			const key = emptyArrayMatch[1]
			if (key === "constraints" || key === "scope") {
				;(currentIntent as any)[key] = []
			}
			currentArrayField = null
			continue
		}

		// Array item (6 spaces indent): `      - "value"` or `      - value`
		const arrayItemMatch = line.match(/^\s{6}-\s+["']?(.+?)["']?\s*$/)
		if (arrayItemMatch && currentArrayField) {
			const arr = (currentIntent as any)[currentArrayField]
			if (Array.isArray(arr)) {
				arr.push(arrayItemMatch[1])
			}
			continue
		}
	}

	// Don't forget the last intent
	if (currentIntent && currentIntent.id) {
		intents.push(normalizeIntent(currentIntent))
	}

	return intents
}

/**
 * Normalize a partial intent into a complete ActiveIntent with defaults.
 */
function normalizeIntent(partial: Partial<ActiveIntent>): ActiveIntent {
	return {
		id: partial.id || "",
		goal: partial.goal || "",
		status: partial.status || "UNKNOWN",
		constraints: partial.constraints || [],
		scope: partial.scope || [],
	}
}

/**
 * Check if the workspace is in "governed mode" (has active_intents.yaml).
 *
 * @param cwd - Workspace root directory
 * @returns true if .orchestration/active_intents.yaml exists
 */
export function isGovernedWorkspace(cwd: string): boolean {
	const yamlPath = path.join(cwd, ACTIVE_INTENTS_PATH)
	return fs.existsSync(yamlPath)
}

/**
 * Load and parse all active intents from .orchestration/active_intents.yaml.
 *
 * @param cwd - Workspace root directory
 * @returns Array of ActiveIntent entries, or empty array if file doesn't exist or is malformed
 */
export async function loadActiveIntents(cwd: string): Promise<ActiveIntent[]> {
	const yamlPath = path.join(cwd, ACTIVE_INTENTS_PATH)

	try {
		const content = await fs.promises.readFile(yamlPath, "utf-8")
		return parseActiveIntentsYaml(content)
	} catch (error: any) {
		if (error.code === "ENOENT") {
			// File doesn't exist — ungoverned workspace
			return []
		}
		console.warn(`[activeIntents] Failed to parse ${ACTIVE_INTENTS_PATH}: ${error.message}`)
		return []
	}
}

/**
 * Find a specific intent by its ID.
 *
 * @param intents - Array of parsed active intents
 * @param id - The intent ID to look up
 * @returns The matching ActiveIntent or undefined
 */
export function findIntentById(intents: ActiveIntent[], id: string): ActiveIntent | undefined {
	return intents.find((intent) => intent.id === id)
}

/**
 * Build the <intent_context> XML block for a given intent.
 * This is returned as the tool result and also injected as pre-hook context.
 *
 * @param intent - The active intent to render
 * @param traceEntries - Optional trace events to include (max MAX_TRACE_ENTRIES)
 * @returns XML string with intent context
 */
export function buildIntentContextXml(intent: ActiveIntent, traceEntries?: IntentTraceEvent[]): string {
	const constraintsXml =
		intent.constraints.length > 0
			? intent.constraints.map((c) => `\t\t<constraint>${c}</constraint>`).join("\n")
			: "\t\t<!-- no constraints -->"

	const scopeXml =
		intent.scope.length > 0
			? intent.scope.map((s) => `\t\t<path>${s}</path>`).join("\n")
			: "\t\t<!-- no scope restrictions -->"

	const parts = [
		"<intent_context>",
		`\t<intent_id>${intent.id}</intent_id>`,
		`\t<goal>${intent.goal}</goal>`,
		`\t<status>${intent.status}</status>`,
		"\t<constraints>",
		constraintsXml,
		"\t</constraints>",
		"\t<scope>",
		scopeXml,
		"\t</scope>",
	]

	// Append trace section if there are relevant entries
	const traceXml = buildTraceXml(traceEntries)
	if (traceXml) {
		parts.push(traceXml)
	}

	parts.push("</intent_context>")
	return parts.join("\n")
}

/**
 * Build the <trace> XML section from trace events.
 *
 * Returns null if there are no trace entries (the section is omitted entirely).
 * Limits to MAX_TRACE_ENTRIES most recent events.
 *
 * @param entries - Trace events (may be undefined or empty)
 * @returns XML string for the trace section, or null if empty
 */
export function buildTraceXml(entries?: IntentTraceEvent[]): string | null {
	if (!entries || entries.length === 0) {
		return null
	}

	// Take the most recent entries, capped at MAX_TRACE_ENTRIES
	const recent = entries.slice(-MAX_TRACE_ENTRIES)

	const eventsXml = recent
		.map((e) => `\t\t<event tool="${e.toolName}" outcome="${e.outcome}" time="${e.timestamp}">${e.summary}</event>`)
		.join("\n")

	return `\t<trace>\n${eventsXml}\n\t</trace>`
}
