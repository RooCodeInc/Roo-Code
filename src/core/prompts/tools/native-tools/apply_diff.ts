import type OpenAI from "openai"

export const apply_diff_single_file = {
	type: "function",
	function: {
		name: "apply_diff",
		description:
			"Apply precise, targeted modifications to an existing file using one or more search/replace blocks. This tool is for surgical edits only; the 'SEARCH' block must exactly match the existing content, including whitespace and indentation. " +
			"To make multiple targeted changes, provide multiple SEARCH/REPLACE blocks in the 'diff' parameter. Use the 'read_file' tool first if you are not confident in the exact content to search for. " +
			"Structure: '<<<<<<< SEARCH\\n:start_line:N\\n-------\\nexact content\\n=======\\nreplacement\\n>>>>>>> REPLACE' where N is the actual line number. " +
			"Example single change: { path: 'src/utils.ts', diff: '<<<<<<< SEARCH\\n:start_line:5\\n-------\\nfunction add(a, b) {\\n  return a + b;\\n}\\n=======\\nfunction add(a: number, b: number): number {\\n  return a + b;\\n}\\n>>>>>>> REPLACE' }. " +
			"Example multiple changes: { path: 'src/app.ts', diff: '<<<<<<< SEARCH\\n:start_line:10\\n-------\\nold code here\\n=======\\nnew code here\\n>>>>>>> REPLACE\\n\\n<<<<<<< SEARCH\\n:start_line:25\\n-------\\nmore old code\\n=======\\nmore new code\\n>>>>>>> REPLACE' }. " +
			"CRITICAL: Use exactly ONE line of '=======' between search and replace content - multiple '=======' lines will corrupt the file.",
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "The path of the file to modify, relative to the current workspace directory.",
				},
				diff: {
					type: "string",
					description:
						"A string containing one or more search/replace blocks defining the changes. The ':start_line:' is required and indicates the starting line number of the original content. You must not add a start line for the replacement content. " +
						"Format: '<<<<<<< SEARCH\\n:start_line:5\\n-------\\nexact content\\n=======\\nreplacement\\n>>>>>>> REPLACE'. " +
						"Example: '<<<<<<< SEARCH\\n:start_line:10\\n-------\\nconst x = 1;\\n=======\\nconst x = 2;\\n>>>>>>> REPLACE'. " +
						"For multiple edits: separate each block with a blank line and use different start_line values. " +
						"IMPORTANT: The start_line must be the actual line number (e.g., :start_line:5, not :start_line:[5]).",
				},
			},
			required: ["path", "diff"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
