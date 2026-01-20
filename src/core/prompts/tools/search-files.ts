import { ToolArgs } from "./types"

export function getSearchFilesDescription(args: ToolArgs): string {
	return `## search_files
Description: Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.

Craft your regex patterns carefully to balance specificity and flexibility. Use this tool to find code patterns, TODO comments, function definitions, or any text-based information across the project. The results include surrounding context, so analyze the surrounding code to better understand the matches. Leverage this tool in combination with other tools for more comprehensive analysis - for example, use it to find specific code patterns, then use read_file to examine the full context of interesting matches.

Parameters:
- path: (required) The path of the directory to search in (relative to the current workspace directory ${args.cwd}). This directory will be recursively searched.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).

Usage (native tool calling):
Call the tool with a JSON object containing the parameters.

Examples:
{ "path": ".", "regex": ".*", "file_pattern": "*.ts" }
{ "path": "src", "regex": "function\\s+\\w+", "file_pattern": "*.js" }`
}
