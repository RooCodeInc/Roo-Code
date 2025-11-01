import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for search_files
 * This defines the schema for regex searching across files
 */
export const searchFilesToolSpec: ToolSpec = {
	name: "search_files",
	description:
		"Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.",
	parameters: [
		{
			name: "path",
			type: "string",
			required: true,
			description:
				"The path of the directory to search in (relative to the current workspace directory). This directory will be recursively searched.",
		},
		{
			name: "regex",
			type: "string",
			required: true,
			description: "The regular expression pattern to search for. Uses Rust regex syntax.",
		},
		{
			name: "file_pattern",
			type: "string",
			required: false,
			description:
				"Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).",
		},
	],
}
