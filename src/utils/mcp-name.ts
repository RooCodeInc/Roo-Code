/**
 * Utilities for sanitizing MCP server and tool names to conform to
 * API function name requirements across all providers.
 */

/**
 * Separator used between MCP prefix, server name, and tool name.
 * We use "--" (double hyphen) because:
 * 1. It's allowed by all providers (dashes are permitted in function names)
 * 2. It won't conflict with underscores in sanitized server/tool names
 * 3. It's unique enough to be a reliable delimiter for parsing
 */
export const MCP_TOOL_SEPARATOR = "--"

/**
 * Alternative separator that models may output.
 * Some models (like Claude) convert hyphens to underscores in tool names,
 * so "--" becomes "__". We need to recognize and handle this.
 */
export const MCP_TOOL_SEPARATOR_MANGLED = "__"

/**
 * Prefix for all MCP tool function names.
 */
export const MCP_TOOL_PREFIX = "mcp"

/**
 * Check if a tool name is an MCP tool (starts with the MCP prefix and separator).
 * Also recognizes mangled versions where models converted "--" to "__".
 *
 * @param toolName - The tool name to check
 * @returns true if the tool name starts with "mcp--" or "mcp__", false otherwise
 */
export function isMcpTool(toolName: string): boolean {
	return (
		toolName.startsWith(`${MCP_TOOL_PREFIX}${MCP_TOOL_SEPARATOR}`) ||
		toolName.startsWith(`${MCP_TOOL_PREFIX}${MCP_TOOL_SEPARATOR_MANGLED}`)
	)
}

/**
 * Sanitize a name to be safe for use in API function names.
 * This removes special characters and ensures the name starts correctly.
 *
 * Note: This does NOT remove dashes from names, but the separator "--" is
 * distinct enough (double hyphen) that single hyphens in names won't conflict.
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

	// Only allow alphanumeric, underscores, and dashes
	sanitized = sanitized.replace(/[^a-zA-Z0-9_\-]/g, "")

	// Replace any double-hyphen sequences with single hyphen to avoid separator conflicts
	sanitized = sanitized.replace(/--+/g, "-")

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
 * The format is: mcp--{sanitized_server_name}--{sanitized_tool_name}
 *
 * The total length is capped at 64 characters to conform to API limits.
 *
 * @param serverName - The MCP server name
 * @param toolName - The tool name
 * @returns A sanitized function name in the format mcp--serverName--toolName
 */
export function buildMcpToolName(serverName: string, toolName: string): string {
	const sanitizedServer = sanitizeMcpName(serverName)
	const sanitizedTool = sanitizeMcpName(toolName)

	// Build the full name: mcp--{server}--{tool}
	const fullName = `${MCP_TOOL_PREFIX}${MCP_TOOL_SEPARATOR}${sanitizedServer}${MCP_TOOL_SEPARATOR}${sanitizedTool}`

	// Truncate if necessary (max 64 chars for Gemini)
	if (fullName.length > 64) {
		return fullName.slice(0, 64)
	}

	return fullName
}

/**
 * Parse an MCP tool function name back into server and tool names.
 * This handles sanitized names by splitting on the "--" separator.
 * Also handles mangled names where models converted "--" to "__".
 *
 * Note: This returns the sanitized names, not the original names.
 * The original names cannot be recovered from the sanitized version.
 *
 * @param mcpToolName - The full MCP tool name (e.g., "mcp--weather--get_forecast" or "mcp__weather__get_forecast")
 * @returns An object with serverName, toolName, and wasMangled flag, or null if parsing fails
 */
export function parseMcpToolName(
	mcpToolName: string,
): { serverName: string; toolName: string; wasMangled: boolean } | null {
	// Try canonical format first: mcp--server--tool
	const canonicalPrefix = MCP_TOOL_PREFIX + MCP_TOOL_SEPARATOR
	if (mcpToolName.startsWith(canonicalPrefix)) {
		const remainder = mcpToolName.slice(canonicalPrefix.length)
		const separatorIndex = remainder.indexOf(MCP_TOOL_SEPARATOR)
		if (separatorIndex !== -1) {
			const serverName = remainder.slice(0, separatorIndex)
			const toolName = remainder.slice(separatorIndex + MCP_TOOL_SEPARATOR.length)
			if (serverName && toolName) {
				return { serverName, toolName, wasMangled: false }
			}
		}
	}

	// Try mangled format: mcp__server__tool (models may convert -- to __)
	const mangledPrefix = MCP_TOOL_PREFIX + MCP_TOOL_SEPARATOR_MANGLED
	if (mcpToolName.startsWith(mangledPrefix)) {
		const remainder = mcpToolName.slice(mangledPrefix.length)
		const separatorIndex = remainder.indexOf(MCP_TOOL_SEPARATOR_MANGLED)
		if (separatorIndex !== -1) {
			const serverName = remainder.slice(0, separatorIndex)
			const toolName = remainder.slice(separatorIndex + MCP_TOOL_SEPARATOR_MANGLED.length)
			if (serverName && toolName) {
				return { serverName, toolName, wasMangled: true }
			}
		}
	}

	return null
}

/**
 * Generate possible original names from a potentially mangled name.
 * When models convert hyphens to underscores, we need to try matching
 * the mangled name against servers/tools that may have had hyphens.
 *
 * Since we can't know which underscores were originally hyphens, we generate
 * all possible combinations for fuzzy matching.
 *
 * For efficiency, we limit this to names with a reasonable number of underscores.
 *
 * @param mangledName - A name that may have had hyphens converted to underscores
 * @returns An array of possible original names, including the input unchanged
 */
export function generatePossibleOriginalNames(mangledName: string): string[] {
	const results: string[] = [mangledName]

	// Find positions of all underscores
	const underscorePositions: number[] = []
	for (let i = 0; i < mangledName.length; i++) {
		if (mangledName[i] === "_") {
			underscorePositions.push(i)
		}
	}

	// Limit to prevent exponential explosion (2^n combinations)
	// 8 underscores = 256 combinations, which is reasonable
	if (underscorePositions.length > 8) {
		// For too many underscores, just try the most common pattern:
		// replace all underscores with hyphens
		results.push(mangledName.replace(/_/g, "-"))
		return results
	}

	// Generate all combinations of replacing underscores with hyphens
	const numCombinations = 1 << underscorePositions.length // 2^n
	for (let mask = 1; mask < numCombinations; mask++) {
		let variant = mangledName
		for (let i = underscorePositions.length - 1; i >= 0; i--) {
			if (mask & (1 << i)) {
				const pos = underscorePositions[i]
				variant = variant.slice(0, pos) + "-" + variant.slice(pos + 1)
			}
		}
		results.push(variant)
	}

	return results
}

/**
 * Find a matching server name from a potentially mangled server name.
 * Tries exact match first, then tries variations with underscores replaced by hyphens.
 *
 * @param mangledServerName - The server name from parsed MCP tool (may be mangled)
 * @param availableServers - List of actual server names to match against
 * @returns The matching server name, or null if no match found
 */
export function findMatchingServerName(mangledServerName: string, availableServers: string[]): string | null {
	// Try exact match first
	if (availableServers.includes(mangledServerName)) {
		return mangledServerName
	}

	// Generate possible original names and try to find a match
	const possibleNames = generatePossibleOriginalNames(mangledServerName)
	for (const possibleName of possibleNames) {
		if (availableServers.includes(possibleName)) {
			return possibleName
		}
	}

	return null
}

/**
 * Find a matching tool name from a potentially mangled tool name.
 * Tries exact match first, then tries variations with underscores replaced by hyphens.
 *
 * @param mangledToolName - The tool name from parsed MCP tool (may be mangled)
 * @param availableTools - List of actual tool names to match against
 * @returns The matching tool name, or null if no match found
 */
export function findMatchingToolName(mangledToolName: string, availableTools: string[]): string | null {
	// Try exact match first
	if (availableTools.includes(mangledToolName)) {
		return mangledToolName
	}

	// Generate possible original names and try to find a match
	const possibleNames = generatePossibleOriginalNames(mangledToolName)
	for (const possibleName of possibleNames) {
		if (availableTools.includes(possibleName)) {
			return possibleName
		}
	}

	return null
}
