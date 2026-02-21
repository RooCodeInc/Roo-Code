/**
 * YAML loader utility for .orchestration/active_intents.yaml
 * Handles reading and parsing the active intents file with proper error handling.
 * Supports in-memory caching for findIntentById; clear with clearIntentCache() or
 * wire a file watcher on getActiveIntentsPath(workspaceRoot) to invalidate on change.
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { fileExistsAtPath } from "../../utils/fs"
import type { ActiveIntentsFile, ActiveIntent } from "../models/orchestration"

const ORCHESTRATION_DIR = ".orchestration"
const ACTIVE_INTENTS_FILE = "active_intents.yaml"

/** In-memory cache for loaded intents (by workspace file path + TTL) */
interface IntentCache {
	intents: Map<string, ActiveIntent>
	timestamp: number
	filePath: string
}

let intentCache: IntentCache | null = null
const CACHE_TTL_MS = 5000 // 5 seconds

/**
 * Get the path to the active_intents.yaml file
 */
export function getActiveIntentsPath(workspaceRoot: string): string {
	return path.join(workspaceRoot, ORCHESTRATION_DIR, ACTIVE_INTENTS_FILE)
}

/**
 * Read and parse active_intents.yaml (never throws).
 * Returns { active_intents: [] } if file is missing or parse fails.
 * Use for cache-friendly loading in findIntentById.
 */
export async function readActiveIntents(workspaceRoot: string): Promise<ActiveIntentsFile> {
	const filePath = getActiveIntentsPath(workspaceRoot)
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const parsed = yaml.parse(content)
		if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.active_intents)) {
			return { active_intents: [] }
		}
		return { active_intents: parsed.active_intents as ActiveIntent[] }
	} catch (error) {
		console.error("Error reading active_intents.yaml:", error)
		return { active_intents: [] }
	}
}

/**
 * Load and parse active_intents.yaml from the workspace
 * Returns null if file doesn't exist (not an error - file may not be created yet)
 * Throws if file exists but is invalid
 */
export async function loadActiveIntents(workspaceRoot: string): Promise<ActiveIntentsFile | null> {
	const filePath = getActiveIntentsPath(workspaceRoot)

	// Check if file exists
	if (!(await fileExistsAtPath(filePath))) {
		return null
	}

	try {
		// Read file content
		const content = await fs.readFile(filePath, "utf-8")

		// Parse YAML
		const parsed = yaml.parse(content)

		// Validate structure - ensure it has active_intents array
		if (!parsed || typeof parsed !== "object") {
			throw new Error("Invalid YAML structure: expected an object")
		}

		if (!Array.isArray(parsed.active_intents)) {
			throw new Error("Invalid YAML structure: active_intents must be an array")
		}

		// Return typed structure
		return {
			active_intents: parsed.active_intents as ActiveIntent[],
		}
	} catch (error) {
		if (error instanceof yaml.YAMLParseError) {
			throw new Error(`Failed to parse ${ACTIVE_INTENTS_FILE}: ${error.message}`)
		}
		throw error
	}
}

/**
 * Find an intent by ID with caching.
 * Uses in-memory cache when the same file was loaded within CACHE_TTL_MS.
 */
export async function findIntentById(workspaceRoot: string, intentId: string): Promise<ActiveIntent | null> {
	const filePath = getActiveIntentsPath(workspaceRoot)
	const now = Date.now()

	if (intentCache && intentCache.filePath === filePath && now - intentCache.timestamp < CACHE_TTL_MS) {
		return intentCache.intents.get(intentId) ?? null
	}

	const intentsFile = await readActiveIntents(workspaceRoot)
	const intentMap = new Map<string, ActiveIntent>()
	for (const intent of intentsFile.active_intents) {
		intentMap.set(intent.id, intent)
	}
	intentCache = { intents: intentMap, timestamp: now, filePath }
	return intentMap.get(intentId) ?? null
}

/**
 * Get a cached intent by ID without reloading the file.
 * Returns null if cache is empty or intent is not in cache.
 */
export function getCachedIntent(intentId: string): ActiveIntent | null {
	if (!intentCache) {
		return null
	}
	return intentCache.intents.get(intentId) ?? null
}

/**
 * Clear the intent cache. Call after editing .orchestration/active_intents.yaml
 * or wire to a file watcher on getActiveIntentsPath(workspaceRoot) for automatic invalidation.
 */
export function clearIntentCache(): void {
	intentCache = null
}
