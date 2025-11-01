import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for search_and_replace
 * This defines the schema for find and replace operations
 */
export const searchAndReplaceToolSpec: ToolSpec = {
	name: "search_and_replace",
	description:
		"Use this tool to find and replace specific text strings or patterns (using regex) within a file. It's suitable for targeted replacements across multiple locations within the file. Supports literal text and regex patterns, case sensitivity options, and optional line ranges. Shows a diff preview before applying changes.",
	parameters: [
		{
			name: "path",
			type: "string",
			required: true,
			description: "The path of the file to modify (relative to the current workspace directory)",
		},
		{
			name: "search",
			type: "string",
			required: true,
			description: "The text or pattern to search for",
		},
		{
			name: "replace",
			type: "string",
			required: true,
			description: "The text to replace matches with",
		},
		{
			name: "start_line",
			type: "integer",
			required: false,
			description: "Starting line number for restricted replacement (1-based)",
		},
		{
			name: "end_line",
			type: "integer",
			required: false,
			description: "Ending line number for restricted replacement (1-based)",
		},
		{
			name: "use_regex",
			type: "boolean",
			required: false,
			description: 'Set to "true" to treat search as a regex pattern (default: false)',
		},
		{
			name: "ignore_case",
			type: "boolean",
			required: false,
			description: 'Set to "true" to ignore case when matching (default: false)',
		},
	],
}
