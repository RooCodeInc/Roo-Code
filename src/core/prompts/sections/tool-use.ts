export function getSharedToolUseSection(useXmlToolCalling?: boolean): string {
	if (useXmlToolCalling) {
		return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You must use exactly one tool per message, and every assistant message must include a tool call. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name becomes the XML tag. Each parameter is a nested tag:

<tool_name>
<param>value</param>
</tool_name>

Always use the actual tool name as the XML tag name for proper parsing and execution.`
	}

	return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. Use the provider-native tool-calling mechanism. Do not include XML markup or examples. You must call at least one tool per assistant response. Prefer calling as many tools as are reasonably needed in a single response to reduce back-and-forth and complete tasks faster.`
}
