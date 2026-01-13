/**
 * Location Extractor
 *
 * Extracts file locations from tool parameters for ACP tool calls.
 * Handles various parameter formats and tool-specific behaviors.
 */

import type * as acp from "@agentclientprotocol/sdk"

import { isSearchTool, isListFilesTool } from "../tool-registry.js"
import { resolveFilePathUnsafe } from "../utils/index.js"

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters that may contain file locations.
 */
export interface LocationParams {
	tool?: string
	path?: string
	file?: string
	filePath?: string
	file_path?: string
	directory?: string
	dir?: string
	paths?: string[]
	content?: string
}

// =============================================================================
// Location Extraction
// =============================================================================

/**
 * Extract file locations from tool parameters.
 *
 * Handles different tool types:
 * - Search tools: Extract file paths from search results
 * - List files: Include the directory being listed
 * - File operations: Extract path from standard parameters
 *
 * @param params - Tool parameters
 * @param workspacePath - Optional workspace path to resolve relative paths
 * @returns Array of tool call locations
 */
export function extractLocations(params: Record<string, unknown>, workspacePath?: string): acp.ToolCallLocation[] {
	const locations: acp.ToolCallLocation[] = []
	const toolName = (params.tool as string | undefined)?.toLowerCase() || ""

	// For search tools, the 'path' parameter is a search scope directory, not a file being accessed.
	// Don't include it in locations. Instead, try to extract file paths from search results.
	if (isSearchTool(toolName)) {
		// Try to extract file paths from search results content
		const content = params.content as string | undefined
		if (content) {
			return extractFilePathsFromSearchResults(content, workspacePath)
		}
		return []
	}

	// For list_files tools, the 'path' is a directory being listed, which is valid to include
	// but we should mark it as a directory operation rather than a file access
	if (isListFilesTool(toolName)) {
		const dirPath = params.path as string | undefined
		if (dirPath) {
			const absolutePath = resolveFilePathUnsafe(dirPath, workspacePath)
			locations.push({ path: absolutePath })
		}
		return locations
	}

	// Check for common path parameters (for file operations)
	const pathParams = ["path", "file", "filePath", "file_path"]
	for (const param of pathParams) {
		if (typeof params[param] === "string") {
			const filePath = params[param] as string
			const absolutePath = resolveFilePathUnsafe(filePath, workspacePath)
			locations.push({ path: absolutePath })
		}
	}

	// Check for directory parameters separately (for directory operations)
	const dirParams = ["directory", "dir"]
	for (const param of dirParams) {
		if (typeof params[param] === "string") {
			const dirPath = params[param] as string
			const absolutePath = resolveFilePathUnsafe(dirPath, workspacePath)
			locations.push({ path: absolutePath })
		}
	}

	// Check for paths array
	if (Array.isArray(params.paths)) {
		for (const p of params.paths) {
			if (typeof p === "string") {
				const absolutePath = resolveFilePathUnsafe(p, workspacePath)
				locations.push({ path: absolutePath })
			}
		}
	}

	return locations
}

/**
 * Extract file paths from search results content.
 *
 * Search results typically have format: "# path/to/file.ts" for each matched file.
 *
 * @param content - Search results content
 * @param workspacePath - Optional workspace path
 * @returns Array of locations from search results
 */
export function extractFilePathsFromSearchResults(content: string, workspacePath?: string): acp.ToolCallLocation[] {
	const locations: acp.ToolCallLocation[] = []
	const seenPaths = new Set<string>()

	// Match file headers in search results (e.g., "# src/utils.ts" or "## path/to/file.js")
	const fileHeaderPattern = /^#+\s+(.+?\.[a-zA-Z0-9]+)\s*$/gm
	let match

	while ((match = fileHeaderPattern.exec(content)) !== null) {
		const filePath = match[1]!.trim()
		// Skip if we've already seen this path or if it looks like a markdown header (not a file path)
		if (seenPaths.has(filePath) || (!filePath.includes("/") && !filePath.includes("."))) {
			continue
		}
		seenPaths.add(filePath)
		const absolutePath = resolveFilePathUnsafe(filePath, workspacePath)
		locations.push({ path: absolutePath })
	}

	return locations
}
