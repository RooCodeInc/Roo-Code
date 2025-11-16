import { ToolProtocol, TOOL_PROTOCOL, isNativeProtocol } from "@roo-code/types"

export function getSharedToolUseSection(
	protocol: ToolProtocol = TOOL_PROTOCOL.XML,
	experiments?: Record<string, boolean>,
): string {
	if (isNativeProtocol(protocol)) {
		return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. Use the provider-native tool-calling mechanism. Do not include XML markup or examples.`
	}

	const multiToolCallsEnabled = experiments?.multiToolCalls === true

	const toolUsageGuidance = multiToolCallsEnabled
		? `You have access to a set of tools that are executed upon the user's approval. You can use multiple tools per message when appropriate, especially for independent, low-risk operations like reading files or searching code. Every assistant message must include at least one tool call. When using multiple tools, batch independent operations (like multiple file reads or searches) to reduce round trips and improve efficiency.`
		: `You have access to a set of tools that are executed upon the user's approval. You must use exactly one tool per message, and every assistant message must include a tool call. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.`

	return `====

TOOL USE

${toolUsageGuidance}

# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

Always use the actual tool name as the XML tag name for proper parsing and execution.`
}
