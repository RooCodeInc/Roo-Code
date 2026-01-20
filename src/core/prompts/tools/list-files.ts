import { ToolArgs } from "./types"

export function getListFilesDescription(args: ToolArgs): string {
	return `## list_files
Description: Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. Do not use this tool to confirm the existence of files you may have created, as the user will let you know if the files were created successfully or not.
Parameters:
- path: (required) The path of the directory to list contents for (relative to the current workspace directory ${args.cwd})
- recursive: (optional) Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.
Usage (native tool calling):
Call the tool with a JSON object containing the parameters.

Example:
{ "path": ".", "recursive": false }`
}
