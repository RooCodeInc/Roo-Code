import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for apply_diff
 * This defines the schema for applying targeted changes to files
 */
export const applyDiffToolSpec: ToolSpec = {
	name: "apply_diff",
	description:
		"Request to apply PRECISE, TARGETED modifications to an existing file by searching for specific sections of content and replacing them. This tool is for SURGICAL EDITS ONLY - specific changes to existing code. You can perform multiple distinct search and replace operations within a single `apply_diff` call by providing multiple SEARCH/REPLACE blocks in the `diff` parameter. This is the preferred way to make several targeted changes efficiently. The SEARCH section must exactly match existing content including whitespace and indentation. If you're not confident in the exact content to search for, use the read_file tool first to get the exact content. When applying the diffs, be extra careful to remember to change any closing brackets or other syntax that may be affected by the diff farther down in the file. ALWAYS make as many changes in a single 'apply_diff' request as possible using multiple SEARCH/REPLACE blocks",
	parameters: [
		{
			name: "path",
			type: "string",
			required: true,
			description: "The path of the file to modify (relative to the current workspace directory)",
		},
		{
			name: "diff",
			type: "string",
			required: true,
			description:
				"The search/replace block defining the changes. Format:\n```\n<<<<<<< SEARCH\n:start_line: (required) The line number of original content where the search block starts.\n-------\n[exact content to find including whitespace]\n=======\n[new content to replace with]\n>>>>>>> REPLACE\n```\nYou can include multiple SEARCH/REPLACE blocks in a single diff.",
		},
	],
}
