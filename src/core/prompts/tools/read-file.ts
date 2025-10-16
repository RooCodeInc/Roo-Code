import { ToolArgs } from "./types"

export function getReadFileDescription(args: ToolArgs): string {
	const maxConcurrentReads = args.settings?.maxConcurrentFileReads ?? 5
	const isMultipleReadsEnabled = maxConcurrentReads > 1

	return `## read_file
Description: Request to read the contents of ${isMultipleReadsEnabled ? "one or more files" : "a file"}. The tool outputs line-numbered content (e.g. "1 | const x = 1") for easy reference when creating diffs or discussing code.${args.partialReadsEnabled ? " Use line ranges to efficiently read specific portions of large files." : ""} Use pattern to search for specific content in files. Supports text extraction from PDF and DOCX files, but may not handle other binary files properly.

${isMultipleReadsEnabled ? `**IMPORTANT: You can read a maximum of ${maxConcurrentReads} files in a single request.** If you need to read more files, use multiple sequential read_file requests.` : "**IMPORTANT: Multiple file reads are currently disabled. You can only read one file at a time.**"}

${args.partialReadsEnabled ? `By specifying line ranges, you can efficiently read specific portions of large files without loading the entire file into memory.` : ""} Use pattern to search for specific content and get lightweight results with match locations - pattern returns line numbers + context, allowing you to then use line_range to read full context around matches.
Parameters:
- args: Contains one or more file elements, where each file contains:
  - path: (required) File path (relative to workspace directory ${args.cwd})
  ${
		args.partialReadsEnabled
			? `- line_range: (optional) One or more line range elements in format "start-end" (1-based, inclusive)
  `
			: ""
  }- pattern: (optional) Regex pattern to search within the file (lightweight search mode)

Usage:
<read_file>
<args>
  <file>
    <path>path/to/file</path>
    ${args.partialReadsEnabled ? `<line_range>start-end</line_range>` : ""}
  </file>
</args>
</read_file>

Examples:

1. Reading a single file:
<read_file>
<args>
  <file>
    <path>src/app.ts</path>
    ${args.partialReadsEnabled ? `<line_range>1-1000</line_range>` : ""}
  </file>
</args>
</read_file>

${isMultipleReadsEnabled ? `2. Reading multiple files (within the ${maxConcurrentReads}-file limit):` : ""}${
		isMultipleReadsEnabled
			? `
<read_file>
<args>
  <file>
    <path>src/app.ts</path>
    ${
		args.partialReadsEnabled
			? `<line_range>1-50</line_range>
    <line_range>100-150</line_range>`
			: ""
	}
  </file>
  <file>
    <path>src/utils.ts</path>
    ${args.partialReadsEnabled ? `<line_range>10-20</line_range>` : ""}
  </file>
</args>
</read_file>`
			: ""
	}

${isMultipleReadsEnabled ? "3. " : "2. "}Reading an entire file:
<read_file>
<args>
  <file>
    <path>config.json</path>
  </file>
</args>
</read_file>

${isMultipleReadsEnabled ? "4. " : "3. "}Searching for a pattern (lightweight mode):
<read_file>
<args>
  <file>
    <path>src/app.ts</path>
    <pattern>async function|TODO</pattern>
  </file>
</args>
</read_file>
${
	args.partialReadsEnabled
		? `
${isMultipleReadsEnabled ? "5. " : "4. "}Combining pattern and line_range (search within specific range):
<read_file>
<args>
  <file>
    <path>src/utils.ts</path>
    <line_range>100-500</line_range>
    <pattern>export const</pattern>
  </file>
</args>
</read_file>`
		: ""
}

CRITICAL RULES FOR READING FILES (YOU MUST FOLLOW):

**Pattern Search (Always Available):**
- **Find specific content:** Use pattern to search within a single file, or use search_files to search across multiple files
- **Pattern search workflow:** Use pattern to find matches (returns line numbers + context)${args.partialReadsEnabled ? `, then use line_range to read full context around matches` : ""}
- **Pattern output:** Returns match locations (line numbers) + 2 lines of context per match (max 20 matches)

✅ Pattern Examples:
- Searching for pattern: <pattern>async function|class.*implements</pattern>
${args.partialReadsEnabled ? `- Pattern + range: <line_range>100-500</line_range> and <pattern>TODO|FIXME</pattern>` : ""}
${
	args.partialReadsEnabled
		? `
**Line Range Features:**
1. **Large files (>300 lines):** System will auto-limit to first 100 lines if you don't specify line_range, with an educational notice showing you how to use line_range for specific sections
2. **Preview unknown files:** Read first without line_range to see file size and structure, then use line_range for specific sections if needed
3. **Multiple sections:** Use multiple <line_range> tags in ONE request to read non-adjacent sections efficiently

✅ Line Range Examples:
- Reading large file preview: <line_range>1-100</line_range>
- Reading specific function: <line_range>450-520</line_range>
- Reading multiple sections: <line_range>1-50</line_range> and <line_range>200-250</line_range>

📚 How it works:
- Files ≤300 lines: Full content returned
- Files >300 lines without line_range: First 100 lines + notice with usage examples
- Files >300 lines with line_range: Exact ranges you specified

`
		: ""
}
- ${isMultipleReadsEnabled ? `You MUST read all related files together in a single operation (up to ${maxConcurrentReads} files at once)` : "You MUST read files one at a time, as multiple file reads are currently disabled"}
- You MUST obtain all necessary context before proceeding with changes
${isMultipleReadsEnabled ? `- When you need to read more than ${maxConcurrentReads} files, prioritize the most critical files first, then use subsequent read_file requests for additional files` : ""}`
}
