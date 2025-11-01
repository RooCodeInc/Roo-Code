import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for write_to_file
 * This defines the schema for creating or overwriting files
 */
export const writeToFileToolSpec: ToolSpec = {
	name: "write_to_file",
	description:
		"Request to write content to a file. This tool is primarily used for **creating new files** or for scenarios where a **complete rewrite of an existing file is intentionally required**. If the file exists, it will be overwritten. If it doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.",
	parameters: [
		{
			name: "path",
			type: "string",
			required: true,
			description: "The path of the file to write to (relative to the current workspace directory)",
		},
		{
			name: "content",
			type: "string",
			required: true,
			description:
				"The content to write to the file. When performing a full rewrite of an existing file or creating a new one, ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified. Do NOT include the line numbers in the content though, just the actual content of the file.",
		},
		{
			name: "line_count",
			type: "integer",
			required: true,
			description:
				"The number of lines in the file. Make sure to compute this based on the actual content of the file, not the number of lines in the content you're providing.",
		},
	],
}
