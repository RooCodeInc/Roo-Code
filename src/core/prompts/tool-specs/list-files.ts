import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for list_files
 * This defines the schema for listing directory contents
 */
export const listFilesToolSpec: ToolSpec = {
	name: "list_files",
	description:
		"Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. Do not use this tool to confirm the existence of files you may have created, as the user will let you know if the files were created successfully or not.",
	parameters: [
		{
			name: "path",
			type: "string",
			required: true,
			description: "The path of the directory to list contents for (relative to the current workspace directory)",
		},
		{
			name: "recursive",
			type: "boolean",
			required: false,
			description:
				"Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.",
		},
	],
}
