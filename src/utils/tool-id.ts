/**
 * Sanitize a tool_use ID to match API validation pattern: ^[a-zA-Z0-9_-]+$
 * Replaces any invalid character with underscore.
 */
export function sanitizeToolUseId(id: string): string {
	return id.replace(/[^a-zA-Z0-9_-]/g, "_")
}
