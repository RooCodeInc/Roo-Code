/**
 * YAML loader utility for .orchestration/active_intents.yaml
 * Handles reading and parsing the active intents file with proper error handling
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { fileExistsAtPath } from "../../utils/fs"
import type { ActiveIntentsFile, ActiveIntent } from "../models/orchestration"

const ORCHESTRATION_DIR = ".orchestration"
const ACTIVE_INTENTS_FILE = "active_intents.yaml"

/**
 * Get the path to the active_intents.yaml file
 */
export function getActiveIntentsPath(workspaceRoot: string): string {
	return path.join(workspaceRoot, ORCHESTRATION_DIR, ACTIVE_INTENTS_FILE)
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
 * Find an intent by ID in the active intents file
 */
export async function findIntentById(workspaceRoot: string, intentId: string): Promise<ActiveIntent | null> {
	const intentsFile = await loadActiveIntents(workspaceRoot)

	if (!intentsFile) {
		return null
	}

	return intentsFile.active_intents.find((intent) => intent.id === intentId) || null
}
