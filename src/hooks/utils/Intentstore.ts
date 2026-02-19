/**
utils/intentStore.ts
─────────────────────────────────────────────────────────────
Read/write layer for .orchestration/active_intents.yaml
This is the single source of truth for intent state.
All hooks that need intent data go through this module.
─────────────────────────────────────────────────────────────
*/
import * as fs from "fs"
import * as path from "path"
import * as yaml from "js-yaml"

export interface ActiveIntent {
	id: string
	name: string
	status: "PENDING" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED"
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
	created_at?: string
	updated_at?: string
}

export interface IntentsFile {
	active_intents: ActiveIntent[]
}

const ORCHESTRATION_DIR = ".orchestration"
const INTENTS_FILE = "active_intents.yaml"

function getIntentsPath(workspacePath: string): string {
	return path.join(workspacePath, ORCHESTRATION_DIR, INTENTS_FILE)
}

/**
Load all active intents from the YAML file.
Returns empty array if file doesn't exist.
*/
export function loadIntents(workspacePath: string): ActiveIntent[] {
	const filePath = getIntentsPath(workspacePath)
	if (!fs.existsSync(filePath)) return []

	try {
		const raw = fs.readFileSync(filePath, "utf8")
		const data = yaml.load(raw) as IntentsFile
		return data?.active_intents ?? []
	} catch (err) {
		console.error("[intentStore] Failed to parse active_intents.yaml:", err)
		return []
	}
}

/**
Find a single intent by ID. Returns null if not found.
*/
export function findIntent(workspacePath: string, intentId: string): ActiveIntent | null {
	const intents = loadIntents(workspacePath)
	return intents.find((i) => i.id === intentId) ?? null
}

/**
Update the status of a specific intent and write back to disk.
*/
export function updateIntentStatus(workspacePath: string, intentId: string, status: ActiveIntent["status"]): boolean {
	const filePath = getIntentsPath(workspacePath)
	const intents = loadIntents(workspacePath)
	const intent = intents.find((i) => i.id === intentId)

	if (!intent) return false

	intent.status = status
	intent.updated_at = new Date().toISOString()

	const updated: IntentsFile = { active_intents: intents }
	fs.writeFileSync(filePath, yaml.dump(updated, { lineWidth: 120 }), "utf8")
	return true
}

/**
Check if a file path matches any of the owned_scope globs for an intent.
Supports ** glob patterns.
*/
export function isFileInScope(intent: ActiveIntent, filePath: string): boolean {
	// Normalize to forward slashes
	const normalized = filePath.replace(/\\/g, "/")

	for (const pattern of intent.owned_scope) {
		if (matchesGlob(pattern, normalized)) return true
	}
	return false
}

/**
Check if a file path is in a .intentignore file.
*/
export function isIntentIgnored(workspacePath: string, filePath: string): boolean {
	const ignorePath = path.join(workspacePath, ".intentignore")
	if (!fs.existsSync(ignorePath)) return false

	const lines = fs
		.readFileSync(ignorePath, "utf8")
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith("#"))

	const normalized = filePath.replace(/\\/g, "/")
	return lines.some((pattern) => matchesGlob(pattern, normalized))
}

// ── Glob matching ──────────────────────────────────────────────
function matchesGlob(pattern: string, filePath: string): boolean {
	// Convert glob to regex
	const regexStr = pattern
		.replace(/\./g, "\\.")
		.replace(/\*\*/g, "__DOUBLESTAR__")
		.replace(/\*/g, "[^/]*")
		.replace(/__DOUBLESTAR__/g, ".*")

	const regex = new RegExp(`^${regexStr}$`)
	return regex.test(filePath)
}
