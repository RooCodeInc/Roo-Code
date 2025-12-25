import { ToolArgs } from "./types"

/**
 * Generate a simplified read_file tool description for models that only support single file reads
 * Supports optional line_range for reading specific portions of a file
 * Uses the simpler format: <read_file><path>file/path.ext</path><line_range>start-end</line_range></read_file>
 */
export function getSimpleReadFileDescription(args: ToolArgs): string {
	return `## read_file
Description: Request to read the contents of a file. The tool outputs line-numbered content (e.g. "1 | const x = 1") for easy reference when discussing code. Use line_range to efficiently read specific portions of large files.

Parameters:
- path: (required) File path (relative to workspace directory ${args.cwd})
- line_range: (optional) Line range in format "start-end" (1-based, inclusive). Use this to read specific sections of a file, especially useful for continuing to read a large file that was truncated.

Usage:
<read_file>
<path>path/to/file</path>
<line_range>start-end</line_range>
</read_file>

Examples:

1. Reading a TypeScript file (full file):
<read_file>
<path>src/app.ts</path>
</read_file>

2. Reading specific lines from a file:
<read_file>
<path>src/app.ts</path>
<line_range>1-100</line_range>
</read_file>

3. Continuing to read after truncation (e.g., after reading lines 1-500):
<read_file>
<path>src/app.ts</path>
<line_range>501-1000</line_range>
</read_file>

4. Reading a configuration file:
<read_file>
<path>config.json</path>
</read_file>

IMPORTANT: When a file is too large to display completely, the tool will show a truncation notice with the exact line number to continue from. Use the line_range parameter to read the next section of the file.`
}
