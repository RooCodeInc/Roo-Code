import { ToolArgs } from "./types"

export function getSearchFilesDescription(args: ToolArgs): string {
	return `## search_files
Description: Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context. By default, the tool respects .gitignore files (including nested ones) and excludes ignored paths from results.
Parameters:
- path: (required) The path of the directory to search in (relative to the current workspace directory ${args.cwd}). This directory will be recursively searched.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).
- include_ignored: (optional) Set to "true" to include files that are ignored by .gitignore. Default is "false" (respects .gitignore).
Usage:
<search_files>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
<include_ignored>true or false (optional, default: false)</include_ignored>
</search_files>

Example: Requesting to search for all .ts files in the current directory (respecting .gitignore)
<search_files>
<path>.</path>
<regex>.*</regex>
<file_pattern>*.ts</file_pattern>
</search_files>

Example: Requesting to search including ignored files
<search_files>
<path>.</path>
<regex>TODO</regex>
<include_ignored>true</include_ignored>
</search_files>`
}
