/**
 * Reads and parses .orchestration/active_intents.yaml.
 *
 * This is the single source of truth for what work is authorized.
 * Every pre-hook reads from here; it is never written by hooks directly
 * (humans maintain it, or a future tool updates it).
 */

import fs from "fs/promises"
import { parse as parseYaml } from "yaml"
import { ActiveIntent, ActiveIntentsFile } from "../types"
import { getActiveIntentsPath } from "./orchestrationPaths"

/**
 * Load all active intents from the workspace's active_intents.yaml.
 * Returns an empty array if the file does not exist (graceful degradation).
 */
export async function loadActiveIntents(cwd: string): Promise<ActiveIntent[]> {
	const filePath = getActiveIntentsPath(cwd)
	try {
		const raw = await fs.readFile(filePath, "utf-8")
		const parsed = parseYaml(raw) as ActiveIntentsFile
		return parsed?.active_intents ?? []
	} catch {
		// File doesn't exist or is invalid YAML — governance cannot be enforced
		return []
	}
}

/**
 * Find a specific intent by its ID.
 * Returns null if not found or file doesn't exist.
 */
export async function findIntentById(cwd: string, intentId: string): Promise<ActiveIntent | null> {
	const intents = await loadActiveIntents(cwd)
	return intents.find((i) => i.id === intentId) ?? null
}

/**
 * Check whether a file path falls within any of the intent's owned_scope patterns.
 *
 * Scope matching rules:
 * - "src/auth/**" matches any file under src/auth/
 * - "src/middleware/jwt.ts" matches exactly that file
 * - Paths are compared using normalized forward slashes
 */
export function isPathInScope(filePath: string, ownedScope: string[]): boolean {
	// Normalize to forward slashes for cross-platform consistency
	const normalized = filePath.replace(/\\/g, "/")

	return ownedScope.some((pattern) => {
		const normalizedPattern = pattern.replace(/\\/g, "/")

		// Glob-style: pattern ends with /** — match any file under the prefix
		if (normalizedPattern.endsWith("/**")) {
			const prefix = normalizedPattern.slice(0, -3)
			return normalized === prefix || normalized.startsWith(prefix + "/")
		}

		// Glob-style: pattern ends with /* — match any direct child
		if (normalizedPattern.endsWith("/*")) {
			const prefix = normalizedPattern.slice(0, -2)
			const rest = normalized.slice(prefix.length + 1)
			return normalized.startsWith(prefix + "/") && !rest.includes("/")
		}

		// Exact match
		return normalized === normalizedPattern
	})
}
