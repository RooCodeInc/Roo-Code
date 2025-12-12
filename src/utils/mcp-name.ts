/**
 * Utilities for sanitizing MCP server and tool names to conform to
 * API function name requirements (e.g., Gemini's restrictions).
 *
 * Gemini function name requirements:
 * - Must start with a letter or an underscore
 * - Must be alphanumeric (a-z, A-Z, 0-9), underscores (_), dots (.), colons (:), or dashes (-)
 * - Maximum length of 64 characters
 */

/**
 * Sanitize a name to be safe for use in API function names.
 *
 * @param name - The original name (e.g., MCP server name or tool name)
 * @returns A sanitized name that conforms to API requirements
 */
export function sanitizeMcpName(name: string): string {
	if (!name) {
		return "_"
	}

	// Replace spaces with underscores first
	let sanitized = name.replace(/\s+/g, "_")

	// Remove any characters that are not alphanumeric, underscores, dots, colons, or dashes
	sanitized = sanitized.replace(/[^a-zA-Z0-9_.\-:]/g, "")

	// Ensure the name starts with a letter or underscore
	if (sanitized.length > 0 && !/^[a-zA-Z_]/.test(sanitized)) {
		sanitized = "_" + sanitized
	}

	// If empty after sanitization, use a placeholder
	if (!sanitized) {
		sanitized = "_unnamed"
	}

	return sanitized
}

/**
 * Build a full MCP tool function name from server and tool names.
 * The format is: mcp_{sanitized_server_name}_{sanitized_tool_name}
 *
 * The total length is capped at 64 characters to conform to API limits.
 *
 * @param serverName - The MCP server name
 * @param toolName - The tool name
 * @returns A sanitized function name in the format mcp_serverName_toolName
 */
export function buildMcpToolName(serverName: string, toolName: string): string {
	const sanitizedServer = sanitizeMcpName(serverName)
	const sanitizedTool = sanitizeMcpName(toolName)

	// Build the full name: mcp_{server}_{tool}
	// "mcp_" = 4 chars, "_" separator = 1 char, max total = 64
	const fullName = `mcp_${sanitizedServer}_${sanitizedTool}`

	// Truncate if necessary (max 64 chars for Gemini)
	if (fullName.length > 64) {
		return fullName.slice(0, 64)
	}

	return fullName
}

/**
 * Parse an MCP tool function name back into server and tool names.
 * This handles sanitized names by splitting on the expected format.
 *
 * Note: This returns the sanitized names, not the original names.
 * The original names cannot be recovered from the sanitized version.
 *
 * @param mcpToolName - The full MCP tool name (e.g., "mcp_weather_get_forecast")
 * @returns An object with serverName and toolName, or null if parsing fails
 */
export function parseMcpToolName(mcpToolName: string): { serverName: string; toolName: string } | null {
	if (!mcpToolName.startsWith("mcp_")) {
		return null
	}

	// Remove the "mcp_" prefix
	const remainder = mcpToolName.slice(4)

	// Find the first underscore to split server from tool
	const underscoreIndex = remainder.indexOf("_")
	if (underscoreIndex === -1) {
		return null
	}

	const serverName = remainder.slice(0, underscoreIndex)
	const toolName = remainder.slice(underscoreIndex + 1)

	if (!serverName || !toolName) {
		return null
	}

	return { serverName, toolName }
}
