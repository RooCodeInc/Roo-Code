import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for codebase_search
 * This defines the schema for semantic codebase searching
 */
export const codebaseSearchToolSpec: ToolSpec = {
	name: "codebase_search",
	description:
		"Find files most relevant to the search query using semantic search. Searches based on meaning rather than exact text matches. By default searches entire workspace. Reuse the user's exact wording unless there's a clear reason not to - their phrasing often helps semantic search. Queries MUST be in English (translate if needed).",
	parameters: [
		{
			name: "query",
			type: "string",
			required: true,
			description:
				"The search query. Reuse the user's exact wording/question format unless there's a clear reason not to.",
		},
		{
			name: "path",
			type: "string",
			required: false,
			description:
				"Limit search to specific subdirectory (relative to the current workspace directory). Leave empty for entire workspace.",
		},
	],
}
