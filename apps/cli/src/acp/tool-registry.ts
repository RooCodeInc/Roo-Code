/**
 * Tool Registry
 *
 * Centralized registry for tool type definitions, categories, and validation schemas.
 * Provides type-safe tool identification and parameter validation.
 *
 * Uses exact matching with normalized tool names to avoid fragile substring matching.
 */

import { z } from "zod"
import type * as acp from "@agentclientprotocol/sdk"

// =============================================================================
// Tool Category Registry Class
// =============================================================================

/**
 * Tool category names.
 */
export type ToolCategory =
	| "edit"
	| "read"
	| "search"
	| "list"
	| "execute"
	| "delete"
	| "move"
	| "think"
	| "fetch"
	| "switchMode"
	| "fileWrite"

/**
 * Registry for tool categories with automatic Set generation.
 *
 * This class ensures that TOOL_CATEGORIES and lookup Sets are always in sync
 * by generating Sets automatically from the category definitions.
 */
class ToolCategoryRegistry {
	private readonly categories: Map<ToolCategory, Set<string>> = new Map()
	private readonly toolDefinitions: Record<ToolCategory, readonly string[]>

	constructor() {
		// Define tool categories with their associated tool names
		// All tool names are stored in normalized form (lowercase, no separators)
		this.toolDefinitions = {
			/** File edit operations (create, write, modify) */
			edit: [
				"newfilecreated",
				"editedexistingfile",
				"writetofile",
				"applydiff",
				"applieddiff",
				"createfile",
				"modifyfile",
			],

			/** File read operations */
			read: ["readfile"],

			/** File/codebase search operations */
			search: ["searchfiles", "codebasesearch", "grep", "ripgrep"],

			/** Directory listing operations */
			list: ["listfiles", "listfilestoplevel", "listfilesrecursive"],

			/** Command/shell execution */
			execute: ["executecommand", "runcommand"],

			/** File deletion */
			delete: ["deletefile", "removefile"],

			/** File move/rename */
			move: ["movefile", "renamefile"],

			/** Reasoning/thinking operations */
			think: ["think", "reason", "plan", "analyze"],

			/** External fetch/HTTP operations */
			fetch: ["fetch", "httpget", "httppost", "urlfetch", "webrequest"],

			/** Mode switching operations */
			switchMode: ["switchmode", "setmode"],

			/** File write operations (for streaming detection) */
			fileWrite: ["newfilecreated", "writetofile", "createfile", "editedexistingfile", "applydiff", "modifyfile"],
		}

		// Build Sets automatically from definitions
		for (const [category, tools] of Object.entries(this.toolDefinitions)) {
			this.categories.set(category as ToolCategory, new Set(tools))
		}
	}

	/**
	 * Check if a tool name belongs to a specific category.
	 * Uses O(1) Set lookup.
	 */
	isInCategory(toolName: string, category: ToolCategory): boolean {
		const normalized = this.normalizeToolName(toolName)
		return this.categories.get(category)?.has(normalized) ?? false
	}

	/**
	 * Get all tools in a category.
	 */
	getToolsInCategory(category: ToolCategory): readonly string[] {
		return this.toolDefinitions[category]
	}

	/**
	 * Get all category names.
	 */
	getCategoryNames(): ToolCategory[] {
		return Object.keys(this.toolDefinitions) as ToolCategory[]
	}

	/**
	 * Normalize a tool name for comparison.
	 * Converts to lowercase and removes all separators (-, _).
	 */
	private normalizeToolName(name: string): string {
		return name.toLowerCase().replace(/[-_]/g, "")
	}
}

// =============================================================================
// Singleton Registry Instance
// =============================================================================

/**
 * Global tool category registry instance.
 */
const toolCategoryRegistry = new ToolCategoryRegistry()

// =============================================================================
// Legacy Exports for Backward Compatibility
// =============================================================================

/**
 * Tool categories with their associated tool names.
 * @deprecated Use toolCategoryRegistry methods instead
 */
export const TOOL_CATEGORIES = {
	edit: toolCategoryRegistry.getToolsInCategory("edit"),
	read: toolCategoryRegistry.getToolsInCategory("read"),
	search: toolCategoryRegistry.getToolsInCategory("search"),
	list: toolCategoryRegistry.getToolsInCategory("list"),
	execute: toolCategoryRegistry.getToolsInCategory("execute"),
	delete: toolCategoryRegistry.getToolsInCategory("delete"),
	move: toolCategoryRegistry.getToolsInCategory("move"),
	think: toolCategoryRegistry.getToolsInCategory("think"),
	fetch: toolCategoryRegistry.getToolsInCategory("fetch"),
	switchMode: toolCategoryRegistry.getToolsInCategory("switchMode"),
	fileWrite: toolCategoryRegistry.getToolsInCategory("fileWrite"),
} as const

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * All known tool names (union of all categories)
 */
export type KnownToolName = (typeof TOOL_CATEGORIES)[ToolCategory][number]

// =============================================================================
// Tool Category Detection Functions
// =============================================================================

/**
 * Check if a tool name belongs to a specific category using exact matching.
 * Uses the centralized registry for O(1) lookup.
 */
export function isToolInCategory(toolName: string, category: ToolCategory): boolean {
	return toolCategoryRegistry.isInCategory(toolName, category)
}

/**
 * Check if tool is an edit operation.
 */
export function isEditTool(toolName: string): boolean {
	return isToolInCategory(toolName, "edit")
}

/**
 * Check if tool is a read operation.
 */
export function isReadTool(toolName: string): boolean {
	return isToolInCategory(toolName, "read")
}

/**
 * Check if tool is a search operation.
 */
export function isSearchTool(toolName: string): boolean {
	return isToolInCategory(toolName, "search")
}

/**
 * Check if tool is a list files operation.
 */
export function isListFilesTool(toolName: string): boolean {
	return isToolInCategory(toolName, "list")
}

/**
 * Check if tool is a command execution operation.
 */
export function isExecuteTool(toolName: string): boolean {
	return isToolInCategory(toolName, "execute")
}

/**
 * Check if tool is a delete operation.
 */
export function isDeleteTool(toolName: string): boolean {
	return isToolInCategory(toolName, "delete")
}

/**
 * Check if tool is a move/rename operation.
 */
export function isMoveTool(toolName: string): boolean {
	return isToolInCategory(toolName, "move")
}

/**
 * Check if tool is a think/reasoning operation.
 */
export function isThinkTool(toolName: string): boolean {
	return isToolInCategory(toolName, "think")
}

/**
 * Check if tool is an external fetch operation.
 */
export function isFetchTool(toolName: string): boolean {
	return isToolInCategory(toolName, "fetch")
}

/**
 * Check if tool is a mode switching operation.
 */
export function isSwitchModeTool(toolName: string): boolean {
	return isToolInCategory(toolName, "switchMode")
}

/**
 * Check if tool is a file write operation (for streaming).
 */
export function isFileWriteTool(toolName: string): boolean {
	return isToolInCategory(toolName, "fileWrite")
}

// =============================================================================
// Tool Kind Mapping
// =============================================================================

/**
 * Map a tool name to an ACP ToolKind.
 *
 * ACP defines these tool kinds for special UI treatment:
 * - read: Reading files or data
 * - edit: Modifying files or content
 * - delete: Removing files or data
 * - move: Moving or renaming files
 * - search: Searching for information
 * - execute: Running commands or code
 * - think: Internal reasoning or planning
 * - fetch: Retrieving external data
 * - switch_mode: Switching the current session mode
 * - other: Other tool types (default)
 *
 * Uses exact category matching for reliability. Falls back to "other" for unknown tools.
 */
export function mapToolToKind(toolName: string): acp.ToolKind {
	// Check exact category matches in priority order
	// Order matters only for overlapping categories (like fileWrite and edit)
	if (isToolInCategory(toolName, "switchMode")) {
		return "switch_mode"
	}
	if (isToolInCategory(toolName, "think")) {
		return "think"
	}
	if (isToolInCategory(toolName, "search")) {
		return "search"
	}
	if (isToolInCategory(toolName, "delete")) {
		return "delete"
	}
	if (isToolInCategory(toolName, "move")) {
		return "move"
	}
	if (isToolInCategory(toolName, "edit")) {
		return "edit"
	}
	if (isToolInCategory(toolName, "fetch")) {
		return "fetch"
	}
	if (isToolInCategory(toolName, "read")) {
		return "read"
	}
	if (isToolInCategory(toolName, "list")) {
		return "read" // list operations are read-like
	}
	if (isToolInCategory(toolName, "execute")) {
		return "execute"
	}

	// Default to other for unknown tools
	return "other"
}

// =============================================================================
// Zod Schemas for Tool Parameters
// =============================================================================

/**
 * Base schema for all tool parameters.
 */
const BaseToolParamsSchema = z.object({
	tool: z.string(),
})

/**
 * Schema for file path tools (read, delete, etc.)
 */
export const FilePathParamsSchema = BaseToolParamsSchema.extend({
	path: z.string(),
	content: z.string().optional(),
})

/**
 * Schema for file write/create tools.
 */
export const FileWriteParamsSchema = BaseToolParamsSchema.extend({
	path: z.string(),
	content: z.string(),
})

/**
 * Schema for file move/rename tools.
 */
export const FileMoveParamsSchema = BaseToolParamsSchema.extend({
	path: z.string(),
	newPath: z.string().optional(),
	destination: z.string().optional(),
})

/**
 * Schema for search tools.
 */
export const SearchParamsSchema = BaseToolParamsSchema.extend({
	path: z.string().optional(),
	regex: z.string().optional(),
	query: z.string().optional(),
	pattern: z.string().optional(),
	filePattern: z.string().optional(),
	content: z.string().optional(),
})

/**
 * Schema for list files tools.
 */
export const ListFilesParamsSchema = BaseToolParamsSchema.extend({
	path: z.string(),
	recursive: z.boolean().optional(),
	content: z.string().optional(),
})

/**
 * Schema for command execution tools.
 */
export const CommandParamsSchema = BaseToolParamsSchema.extend({
	command: z.string().optional(),
	cwd: z.string().optional(),
})

/**
 * Schema for think/reasoning tools.
 */
export const ThinkParamsSchema = BaseToolParamsSchema.extend({
	thought: z.string().optional(),
	reasoning: z.string().optional(),
	analysis: z.string().optional(),
})

/**
 * Schema for mode switching tools.
 */
export const SwitchModeParamsSchema = BaseToolParamsSchema.extend({
	mode: z.string().optional(),
	modeId: z.string().optional(),
})

/**
 * Generic tool params schema (for unknown tools).
 */
export const GenericToolParamsSchema = BaseToolParamsSchema.passthrough()

// =============================================================================
// Parameter Types
// =============================================================================

export type FilePathParams = z.infer<typeof FilePathParamsSchema>
export type FileWriteParams = z.infer<typeof FileWriteParamsSchema>
export type FileMoveParams = z.infer<typeof FileMoveParamsSchema>
export type SearchParams = z.infer<typeof SearchParamsSchema>
export type ListFilesParams = z.infer<typeof ListFilesParamsSchema>
export type CommandParams = z.infer<typeof CommandParamsSchema>
export type ThinkParams = z.infer<typeof ThinkParamsSchema>
export type SwitchModeParams = z.infer<typeof SwitchModeParamsSchema>
export type GenericToolParams = z.infer<typeof GenericToolParamsSchema>

/**
 * Union of all tool parameter types.
 */
export type ToolParams =
	| FilePathParams
	| FileWriteParams
	| FileMoveParams
	| SearchParams
	| ListFilesParams
	| CommandParams
	| ThinkParams
	| SwitchModeParams
	| GenericToolParams

// =============================================================================
// Parameter Validation
// =============================================================================

/**
 * Result of parameter validation.
 */
export type ValidationResult<T> = { success: true; data: T } | { success: false; error: z.ZodError }

/**
 * Validate tool parameters against the appropriate schema.
 *
 * @param toolName - Name of the tool
 * @param params - Raw parameters to validate
 * @returns Validation result with typed params or error
 */
export function validateToolParams(toolName: string, params: unknown): ValidationResult<ToolParams> {
	// Select schema based on tool category
	let schema: z.ZodSchema

	if (isEditTool(toolName)) {
		schema = FileWriteParamsSchema
	} else if (isReadTool(toolName)) {
		schema = FilePathParamsSchema
	} else if (isSearchTool(toolName)) {
		schema = SearchParamsSchema
	} else if (isListFilesTool(toolName)) {
		schema = ListFilesParamsSchema
	} else if (isExecuteTool(toolName)) {
		schema = CommandParamsSchema
	} else if (isDeleteTool(toolName)) {
		schema = FilePathParamsSchema
	} else if (isMoveTool(toolName)) {
		schema = FileMoveParamsSchema
	} else if (isThinkTool(toolName)) {
		schema = ThinkParamsSchema
	} else if (isSwitchModeTool(toolName)) {
		schema = SwitchModeParamsSchema
	} else {
		// Use generic schema for unknown tools
		schema = GenericToolParamsSchema
	}

	const result = schema.safeParse(params)

	if (result.success) {
		return { success: true, data: result.data as ToolParams }
	}

	return { success: false, error: result.error }
}

/**
 * Parse and validate tool parameters, returning undefined on failure.
 * Use when validation failure should be handled gracefully.
 *
 * @param toolName - Name of the tool
 * @param params - Raw parameters to validate
 * @returns Validated params or undefined
 */
export function parseToolParams(toolName: string, params: unknown): ToolParams | undefined {
	const result = validateToolParams(toolName, params)
	return result.success ? result.data : undefined
}

// =============================================================================
// Tool Message Parsing
// =============================================================================

/**
 * Schema for parsing tool JSON from message text.
 */
export const ToolMessageSchema = z
	.object({
		tool: z.string(),
		path: z.string().optional(),
		content: z.string().optional(),
	})
	.passthrough()

export type ToolMessage = z.infer<typeof ToolMessageSchema>

/**
 * Parse tool information from a JSON message.
 *
 * @param text - JSON text to parse
 * @returns Parsed tool message or undefined if invalid
 */
export function parseToolMessage(text: string): ToolMessage | undefined {
	if (!text.startsWith("{")) {
		return undefined
	}

	try {
		const parsed = JSON.parse(text)
		const result = ToolMessageSchema.safeParse(parsed)
		return result.success ? result.data : undefined
	} catch {
		return undefined
	}
}
