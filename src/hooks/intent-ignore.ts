import fs from "fs/promises"
import path from "path"

import { pathMatchesAnyPattern } from "./scope"

const DEFAULT_INTENT_IGNORE_NAME = ".intentignore"
const ORCHESTRATION_DIR = ".orchestration"
const INTENT_PREFIX = "intent:"

export interface IntentIgnoreResult {
	pathPatterns: string[]
	excludedIntentIds: string[]
}

/**
 * Load .intentignore-style file: path patterns (one per line) and optional
 * "intent:ID" lines to exclude specific intents from receiving changes.
 * Convention: lines starting with "intent:" are intent IDs to exclude; all other
 * non-empty, non-comment lines are path glob patterns that no write may touch.
 *
 * @param cwd - Workspace root
 * @param intentIgnorePath - Optional path relative to cwd (e.g. ".orchestration/.intentignore")
 */
export async function loadIntentIgnore(cwd: string, intentIgnorePath?: string): Promise<IntentIgnoreResult> {
	const filePath = intentIgnorePath
		? path.resolve(cwd, intentIgnorePath)
		: path.join(cwd, ORCHESTRATION_DIR, DEFAULT_INTENT_IGNORE_NAME)
	try {
		const raw = await fs.readFile(filePath, "utf-8")
		const pathPatterns: string[] = []
		const excludedIntentIds: string[] = []
		for (const line of raw.split("\n")) {
			const trimmed = line.trim()
			if (!trimmed || trimmed.startsWith("#")) continue
			if (trimmed.startsWith(INTENT_PREFIX)) {
				excludedIntentIds.push(trimmed.slice(INTENT_PREFIX.length).trim())
			} else {
				pathPatterns.push(trimmed)
			}
		}
		return { pathPatterns, excludedIntentIds }
	} catch {
		return { pathPatterns: [], excludedIntentIds: [] }
	}
}

export function isPathIgnored(relativePath: string, pathPatterns: string[]): boolean {
	return pathMatchesAnyPattern(relativePath, pathPatterns)
}

export function isIntentExcluded(intentId: string | null, excludedIntentIds: string[]): boolean {
	if (!intentId) return false
	return excludedIntentIds.some((id) => id === intentId)
}
