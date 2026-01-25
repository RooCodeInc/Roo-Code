import type OpenAI from "openai"

/**
 * Creates the read_file tool definition following the paginated read spec.
 *
 * Single-file reads with line-based pagination, stable line numbering,
 * and bounded output to stay within context budgets.
 *
 * @returns Native tool definition for read_file
 */
export function createReadFileTool(): OpenAI.Chat.ChatCompletionTool {
	const description = `Request to read a file with line-based pagination. Returns at most 2000 lines per call (configurable via limit parameter). Use offset parameter to read subsequent chunks.

Path Resolution and Sandbox:
- file_path is required and must be relative to workspace root
- Paths are resolved to absolute and canonicalized
- Access is restricted to workspace root (sandbox enforcement)
- Directories are rejected

Pagination:
- offset (default: 0): 0-based line offset. offset=0 starts at file line 1
- limit (default: 2000): Maximum lines per call (hard cap)
- When reached_eof=false in response, continue with offset=next_offset
- Line numbers are file-global and stable across chunks

Output Format:
- format (default: "cat_n"): Returns cat -n style with right-aligned line numbers
- max_chars_per_line (default: 2000): Truncates lines exceeding this limit
- Binary files return error with code "unsupported_mime_type"

Example: Read first chunk of file:
{ "file_path": "src/main.ts" }

Example: Read next chunk using pagination:
{ "file_path": "src/main.ts", "offset": 2000 }

Example: Read specific section with custom limit:
{ "file_path": "src/main.ts", "offset": 100, "limit": 50 }`

	return {
		type: "function",
		function: {
			name: "read_file",
			description,
			strict: true,
			parameters: {
				type: "object",
				properties: {
					file_path: {
						type: "string",
						description: "Path to the file to read, relative to workspace root (required)",
					},
					offset: {
						type: ["integer", "null"],
						description: "0-based line offset. offset=0 starts at file line 1 (default: 0)",
					},
					limit: {
						type: ["integer", "null"],
						description: "Maximum number of lines to return (default: 2000, hard cap enforced)",
					},
					format: {
						type: ["string", "null"],
						description: 'Output format, currently only "cat_n" supported (default: "cat_n")',
						enum: ["cat_n", null],
					},
					max_chars_per_line: {
						type: ["integer", "null"],
						description: "Maximum characters per line before truncation (default: 2000)",
					},
				},
				required: ["file_path", "offset", "limit", "format", "max_chars_per_line"],
				additionalProperties: false,
			},
		},
	} satisfies OpenAI.Chat.ChatCompletionTool
}

export const read_file = createReadFileTool()
