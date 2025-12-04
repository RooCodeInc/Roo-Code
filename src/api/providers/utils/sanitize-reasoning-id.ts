/**
 * Sanitizes reasoning detail IDs to only contain allowed characters.
 * The OpenAI Responses API only allows IDs containing letters, numbers, underscores, or dashes.
 * This function replaces any invalid characters (like colons from IDs like "rs_xxx:4") with underscores.
 *
 * @param id - The original ID that may contain invalid characters
 * @returns The sanitized ID with only allowed characters, or undefined if input is undefined/null
 */
export function sanitizeReasoningDetailId(id: string | null | undefined): string | null | undefined {
	if (id === null || id === undefined) {
		return id
	}

	// Replace any character that is not a letter, number, underscore, or dash with an underscore
	return id.replace(/[^a-zA-Z0-9_-]/g, "_")
}
