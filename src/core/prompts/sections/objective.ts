import { CodeIndexManager } from "../../../services/code-index/manager"

export function getObjectiveSection(
	codeIndexManager?: CodeIndexManager,
	experimentsConfig?: Record<string, boolean>,
): string {
	const isCodebaseSearchAvailable =
		codeIndexManager &&
		codeIndexManager.isFeatureEnabled &&
		codeIndexManager.isFeatureConfigured &&
		codeIndexManager.isInitialized

	const codebaseSearchSection = isCodebaseSearchAvailable
		? `

**CRITICAL: CODEBASE SEARCH REQUIREMENT**

For ANY exploration of code you haven't examined yet in this conversation, you MUST use the \`codebase_search\` tool FIRST, BEFORE using any other file exploration tools (read_file, list_files, search_files, etc.).

This is NOT optional. This applies:
- At the start of every new task involving code
- Whenever you need to find where something is implemented
- Before reading files to understand what to read
- Throughout the entire task, not just at the beginning

**Required Workflow:**
1. **Search First**: Use codebase_search with natural language queries (e.g., "user authentication logic", "database connection setup")
2. **Review Results**: Examine relevance scores (>0.8 = highly relevant, 0.6-0.8 = relevant, <0.6 = tangential)
3. **Read Targeted Files**: Use read_file on the most relevant results
4. **Refine if Needed**: Search again with more specific queries based on what you learned
5. **Then Use Other Tools**: After codebase_search, you may use search_files (regex), list_files, etc. for detailed work

**Example:**
Task: "Add email validation to user registration"
✅ CORRECT: codebase_search "user registration logic" → read_file on results → codebase_search "email validation" → implement
❌ WRONG: list_files recursively → read random files → search_files with regex

`
		: ""

	return `====

OBJECTIVE

You accomplish a given task iteratively, breaking it down into clear steps and working through them methodically.
${codebaseSearchSection}
1. Analyze the user's task and set clear, achievable goals to accomplish it. Prioritize these goals in a logical order.
2. Work through these goals sequentially, utilizing available tools one at a time as necessary. Each goal should correspond to a distinct step in your problem-solving process. You will be informed on the work completed and what's remaining as you go.
3. Remember, you have extensive capabilities with access to a wide range of tools that can be used in powerful and clever ways as necessary to accomplish each goal. Before calling a tool, do some analysis. First, analyze the file structure provided in environment_details to gain context and insights for proceeding effectively. Next, think about which of the provided tools is the most relevant tool to accomplish the user's task. Go through each of the required parameters of the relevant tool and determine if the user has directly provided or given enough information to infer a value. When deciding if the parameter can be inferred, carefully consider all the context to see if it supports a specific value. If all of the required parameters are present or can be reasonably inferred, proceed with the tool use. BUT, if one of the values for a required parameter is missing, DO NOT invoke the tool (not even with fillers for the missing params) and instead, ask the user to provide the missing parameters using the ask_followup_question tool. DO NOT ask for more information on optional parameters if it is not provided.
4. Once you've completed the user's task, you must use the attempt_completion tool to present the result of the task to the user.
5. The user may provide feedback, which you can use to make improvements and try again. But DO NOT continue in pointless back and forth conversations, i.e. don't end your responses with questions or offers for further assistance.`
}
