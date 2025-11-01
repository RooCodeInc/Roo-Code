import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for list_code_definition_names
 * This defines the schema for listing code definitions
 */
export const listCodeDefinitionNamesToolSpec: ToolSpec = {
	name: "list_code_definition_names",
	description:
		"Request to list definition names (classes, functions, methods, etc.) from source code. This tool can analyze either a single file or all files at the top level of a specified directory. It provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.",
	parameters: [
		{
			name: "path",
			type: "string",
			required: true,
			description:
				"The path of the file or directory (relative to the current working directory) to analyze. When given a directory, it lists definitions from all top-level source files.",
		},
	],
}
