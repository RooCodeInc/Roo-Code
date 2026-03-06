import fs from "fs"
import yaml from "js-yaml"
import path from "path"
import { matchGlobPattern } from "../utils/glob"

/**
 * Represents an intent with its associated metadata and constraints.
 */
export interface Intent {
	/** Unique identifier for the intent */
	id: string
	/** Human-readable name of the intent */
	name: string
	/** Current status of the intent (e.g., 'active', 'completed') */
	status: string
	/** File path patterns that this intent is authorized to edit */
	owned_scope: string[]
	/** Additional constraints for the intent */
	constraints: string[]
	/** Acceptance criteria for the intent */
	acceptance_criteria: string[]
}

/**
 * Loads intents from the active_intents.yaml file.
 * @returns Array of Intent objects
 * @throws Error if file cannot be read or parsed
 */
export function loadIntents(): Intent[] {
	const file = path.resolve(".orchestration/active_intents.yaml")

	try {
		const content = fs.readFileSync(file, "utf-8")
		const parsed = yaml.load(content) as { active_intents: Intent[] }

		if (!parsed || !parsed.active_intents) {
			throw new Error("Invalid YAML structure: missing active_intents array")
		}

		return parsed.active_intents
	} catch (error) {
		throw new Error(`Failed to load intents: ${error instanceof Error ? error.message : "Unknown error"}`)
	}
}

/**
 * Pre-write hook that validates intent authorization before file modifications.
 * @param filePath - Path of the file to be modified
 * @param intentId - ID of the intent requesting the modification
 * @returns The validated Intent object
 * @throws Error if intent is invalid or scope violation occurs
 */
export function preWriteHook(filePath: string, intentId: string): Intent {
	const intents = loadIntents()
	const intent = intents.find((i) => i.id === intentId)

	if (!intent) {
		throw new Error(`Invalid Intent ID: ${intentId}`)
	}

	// Validate scope authorization
	const isAuthorized = intent.owned_scope.some((pattern) => {
		try {
			return matchGlobPattern(pattern, filePath)
		} catch (error) {
			throw new Error(
				`Pattern validation failed for pattern '${pattern}': ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
	})

	if (!isAuthorized) {
		throw new Error(`Scope Violation: Intent '${intentId}' is not authorized to edit '${filePath}'`)
	}

	return intent
}
