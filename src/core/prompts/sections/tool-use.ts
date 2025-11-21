import { ToolProtocol, TOOL_PROTOCOL, isNativeProtocol } from "@roo-code/types"

export function getSharedToolUseSection(
	protocol: ToolProtocol = TOOL_PROTOCOL.XML,
	allowMultiToolCalls: boolean = false,
): string {
	if (isNativeProtocol(protocol)) {
		return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. Use the provider-native tool-calling mechanism. Do not include XML markup or examples.`
	}

	// Default behavior: preserve existing single-tool-per-message guidance
	if (!allowMultiToolCalls) {
		return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You must use exactly one tool per message, and every assistant message must include a tool call. You use tools step-by-step to accomplish a given task, with each tool use being informed by the result of the previous tool use.

# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

Always use the actual tool name as the XML tag name for proper parsing and execution.`
	}

	// Experimental behavior: explicitly allow multiple tools per message
	return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You may call multiple tools per message, including different tool types, when it is efficient to do so. Every assistant message must still include at least one tool call. Use tools step-by-step to accomplish a given task, with each tool use being informed by the result of previous tool uses or earlier messages.

## Multi-tool Strategy

- At the start of every tool-using message, explicitly decide whether your upcoming actions are **independent information-gathering steps** or **stateful operations**. Batch all independent, low-risk information gathering (for example \`codebase_search\`, \`search_files\`, \`list_files\`, \`list_code_definition_names\`, \`read_file\`, or other inspection tools) into a single message so you collect every required context snippet before moving on.
- When you know you'll need multiple files or directories, enumerate everything you plan to inspect and issue the corresponding tool blocks back-to-back in the same message. This reduces round trips and ensures you have complete context before modifying anything.
- Continue to use single-tool-per-message sequencing for operations whose parameters depend on earlier tool results or that have external side effects, such as \`execute_command\`, \`browser_action\`, \`use_mcp_tool\` (for remote actions), \`write_to_file\`, \`apply_diff\`, \`insert_content\`, or \`generate_image\`. These should be run iteratively so you can confirm each result before proceeding.
- For editing workflows, first batch the necessary reads/searches to gather the relevant lines, then send a subsequent message that issues the editing tools (e.g., \`apply_diff\`, \`write_to_file\`, \`insert_content\`) using the gathered context. Never skip the verification step between a batched read/search message and a stateful follow-up.

To maximize development speed and reduce round-trip latency, whenever you need several independent pieces of information (for example, reading multiple files, listing files in several directories, or combining a search with one or more follow-up reads), you should batch those tool calls together in a single message as long as they are logically grouped and do not depend on each other's results.

# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure for a single tool call:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

When calling multiple tools in one message, include multiple tool blocks one after another (for example, a <read_file> block followed by an <execute_command> block). Always use the actual tool name as the XML tag name for proper parsing and execution.`
}
