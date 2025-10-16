export function getSharedToolUseSection(apiProvider?: string): string {
	// Enhanced instructions for local models that may struggle with tool formatting
	const isLocalModel = apiProvider === "ollama" || apiProvider === "lmstudio"

	const baseSection = `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You must use exactly one tool per message, and every assistant message must include a tool call. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

Always use the actual tool name as the XML tag name for proper parsing and execution.`

	if (isLocalModel) {
		return (
			baseSection +
			`

# CRITICAL: Tool Use Requirements for Your Response

**MANDATORY**: Every response MUST contain EXACTLY ONE tool use in the XML format shown above.
**DO NOT**: Write explanations or text outside of the tool XML tags.
**DO NOT**: Guess file locations or code content - use the appropriate search tools first.
**ALWAYS**: Start with codebase_search tool when exploring code for the first time.

Example of a CORRECT response (using codebase_search):
<codebase_search>
<query>main function entry point</query>
</codebase_search>

Example of an INCORRECT response (this will fail):
I'll search for the main function in your codebase.
<codebase_search>
<query>main function</query>
</codebase_search>

Remember: Your ENTIRE response should be the tool XML, nothing else.`
		)
	}

	return baseSection
}
