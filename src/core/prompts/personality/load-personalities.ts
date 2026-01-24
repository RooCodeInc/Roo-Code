import * as fs from "fs"
import * as path from "path"

import { Personality, type PersonalityMessages, PERSONALITIES } from "@roo-code/types"

/**
 * Cache for loaded personality content to avoid repeated file reads.
 */
let cachedPersonalityContent: PersonalityMessages | undefined

/**
 * The directory path where personality markdown files are stored.
 * Files should be named after the personality value (e.g., "friendly.md", "pragmatic.md").
 */
const PERSONALITIES_DIR = path.join(__dirname, "..", "personalities")

/**
 * Loads personality content from the markdown files in the personalities directory.
 *
 * This function reads markdown files for each personality and caches the results.
 * Files are expected to be named after the personality value (lowercase).
 *
 * @returns PersonalityMessages object if all personalities loaded successfully,
 *          undefined if any personality file is missing or unreadable
 *
 * @example
 * ```typescript
 * const content = loadPersonalityContent()
 * if (content) {
 *   console.log(content[Personality.Friendly]) // Content from friendly.md
 * }
 * ```
 */
export function loadPersonalityContent(): PersonalityMessages | undefined {
	// Return cached content if available
	if (cachedPersonalityContent) {
		return cachedPersonalityContent
	}

	try {
		const messages: Partial<Record<Personality, string>> = {}

		for (const personality of PERSONALITIES) {
			const filePath = path.join(PERSONALITIES_DIR, `${personality}.md`)

			if (!fs.existsSync(filePath)) {
				console.warn(`[personality] Missing personality file: ${filePath}`)
				return undefined
			}

			const content = fs.readFileSync(filePath, "utf-8")
			messages[personality] = content.trim()
		}

		// Verify all personalities have content
		for (const personality of PERSONALITIES) {
			if (!messages[personality]) {
				console.warn(`[personality] Empty content for personality: ${personality}`)
				return undefined
			}
		}

		// Cache and return the result
		cachedPersonalityContent = messages as PersonalityMessages
		return cachedPersonalityContent
	} catch (error) {
		console.warn(`[personality] Failed to load personality content:`, error)
		return undefined
	}
}

/**
 * Loads content for a specific personality from its markdown file.
 *
 * @param personality - The personality to load content for
 * @returns The content string, or undefined if loading fails
 *
 * @example
 * ```typescript
 * const friendlyContent = loadSinglePersonalityContent(Personality.Friendly)
 * ```
 */
export function loadSinglePersonalityContent(personality: Personality): string | undefined {
	try {
		const filePath = path.join(PERSONALITIES_DIR, `${personality}.md`)

		if (!fs.existsSync(filePath)) {
			console.warn(`[personality] Missing personality file: ${filePath}`)
			return undefined
		}

		return fs.readFileSync(filePath, "utf-8").trim()
	} catch (error) {
		console.warn(`[personality] Failed to load personality content for "${personality}":`, error)
		return undefined
	}
}

/**
 * Clears the cached personality content.
 * Useful for testing or when personality files are updated at runtime.
 */
export function clearPersonalityCache(): void {
	cachedPersonalityContent = undefined
}

/**
 * Gets the directory path where personality files are stored.
 * Useful for debugging or configuration verification.
 *
 * @returns The absolute path to the personalities directory
 */
export function getPersonalitiesDirectory(): string {
	return PERSONALITIES_DIR
}
