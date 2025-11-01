import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for insert_content
 * This defines the schema for inserting content into files
 */
export const insertContentToolSpec: ToolSpec = {
	name: "insert_content",
	description:
		"Use this tool specifically for adding new lines of content into a file without modifying existing content. Specify the line number to insert before, or use line 0 to append to the end. Ideal for adding imports, functions, configuration blocks, log entries, or any multi-line text block.",
	parameters: [
		{
			name: "path",
			type: "string",
			required: true,
			description: "File path relative to workspace directory",
		},
		{
			name: "line",
			type: "integer",
			required: true,
			description:
				"Line number where content will be inserted (1-based). Use 0 to append at end of file. Use any positive number to insert before that line",
		},
		{
			name: "content",
			type: "string",
			required: true,
			description: "The content to insert at the specified line",
		},
	],
}
