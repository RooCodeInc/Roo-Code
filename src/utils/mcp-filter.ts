/**
 * MCP server/tool filtering helpers for per-mode access control.
 *
 * ISSUE-16 (M1): This module must NOT import from 'vscode' or any module
 * that transitively imports 'vscode'. The getGroupName / getGroupOptions
 * helpers are inlined instead of imported from src/shared/modes.ts.
 */

import type { GroupEntry, McpGroupOptions, McpServerFilter, ModeConfig } from "@roo-code/types"

import { DEFAULT_MODES } from "@roo-code/types"

import { normalizeForComparison } from "./mcp-name"

// ---------------------------------------------------------------------------
// Inlined helpers (M1 — avoids vscode import chain via src/shared/modes.ts)
// ---------------------------------------------------------------------------

/**
 * Extract the group name from a GroupEntry, which can be either a plain
 * string ('mcp') or a tuple (['mcp', { ... }]).
 */
function getGroupName(entry: GroupEntry): string {
	if (typeof entry === "string") {
		return entry
	}
	return entry[0]
}

/**
 * Extract the options object from a GroupEntry tuple. Returns undefined
 * when the entry is a plain string.
 */
function getGroupOptions(entry: GroupEntry): Record<string, unknown> | undefined {
	if (typeof entry === "string") {
		return undefined
	}
	return entry[1] as Record<string, unknown> | undefined
}

// ---------------------------------------------------------------------------
// Mode lookup (inlined to avoid vscode dependency)
// ---------------------------------------------------------------------------

function findMode(modeSlug: string, customModes?: ModeConfig[]): ModeConfig | undefined {
	// Custom modes take precedence
	const custom = customModes?.find((m) => m.slug === modeSlug)
	if (custom) {
		return custom
	}
	// Fall back to built-in modes
	return DEFAULT_MODES.find((m) => m.slug === modeSlug)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve the MCP group options for a mode. Returns `undefined` when the
 * mode does not exist or does not include an 'mcp' group. Returns an empty
 * object `{}` when the mcp group is a plain string (no filtering configured).
 */
export function getMcpFilterForMode(modeSlug: string, customModes?: ModeConfig[]): McpGroupOptions | undefined {
	const mode = findMode(modeSlug, customModes)
	if (!mode) {
		return undefined
	}

	const mcpEntry = mode.groups.find((g) => getGroupName(g) === "mcp")

	if (!mcpEntry) {
		return undefined
	}

	const opts = getGroupOptions(mcpEntry)
	if (!opts) {
		// Plain string 'mcp' — no filtering configured
		return {}
	}

	return opts as McpGroupOptions
}

/**
 * Determine whether a given MCP server is allowed for a mode.
 *
 * Rules:
 * - No mcp group at all → true (no filtering)
 * - Server explicitly disabled → false
 * - Server not listed + allow policy (default) → true
 * - Server not listed + deny policy → false
 * - Server listed + not disabled → true
 */
export function isMcpServerAllowedForMode(serverName: string, modeSlug: string, customModes?: ModeConfig[]): boolean {
	const filter = getMcpFilterForMode(modeSlug, customModes)

	// No mcp group at all → allow everything
	if (filter === undefined) {
		return true
	}

	const servers = filter.mcpServers
	if (!servers) {
		// mcp group exists but no server-level config → allow
		return true
	}

	const normalizedInput = normalizeForComparison(serverName)
	let matchedFilter: McpServerFilter | undefined

	for (const [configName, configFilter] of Object.entries(servers)) {
		if (normalizeForComparison(configName) === normalizedInput) {
			matchedFilter = configFilter
			break
		}
	}

	if (matchedFilter !== undefined) {
		// Server is explicitly listed
		return !matchedFilter.disabled
	}

	// Server not listed — check default policy
	const policy = filter.mcpDefaultPolicy || "allow"
	return policy === "allow"
}

/**
 * Determine whether a specific tool on an MCP server is allowed for a mode.
 *
 * Rules:
 * - Server disabled → false (regardless of tool config)
 * - No tool-level filtering → true
 * - allowedTools exists → tool must be in list (takes precedence)
 * - disabledTools exists → tool must NOT be in list
 * - Default → true
 */
export function isMcpToolAllowedForMode(
	serverName: string,
	toolName: string,
	modeSlug: string,
	customModes?: ModeConfig[],
): boolean {
	// First check server-level access
	if (!isMcpServerAllowedForMode(serverName, modeSlug, customModes)) {
		return false
	}

	const filter = getMcpFilterForMode(modeSlug, customModes)
	if (!filter || !filter.mcpServers) {
		return true
	}

	// Find the server filter entry using normalized comparison
	const normalizedServer = normalizeForComparison(serverName)
	let serverFilter: McpServerFilter | undefined

	for (const [configName, configFilter] of Object.entries(filter.mcpServers)) {
		if (normalizeForComparison(configName) === normalizedServer) {
			serverFilter = configFilter
			break
		}
	}

	if (!serverFilter) {
		// Server not in the filter list → already allowed by isMcpServerAllowedForMode
		return true
	}

	const normalizedTool = normalizeForComparison(toolName)

	// allowedTools takes precedence
	if (serverFilter.allowedTools && serverFilter.allowedTools.length > 0) {
		return serverFilter.allowedTools.some((t) => normalizeForComparison(t) === normalizedTool)
	}

	// disabledTools check
	if (serverFilter.disabledTools && serverFilter.disabledTools.length > 0) {
		return !serverFilter.disabledTools.some((t) => normalizeForComparison(t) === normalizedTool)
	}

	return true
}
