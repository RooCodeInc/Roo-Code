export function getSharedToolUseSection(useXmlToolCalling?: boolean): string {
	if (useXmlToolCalling) {
		return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

For example, to use the new_task tool:

<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
</new_task>

For example, to use the execute_command tool:

<execute_command>
<command>npm run dev</command>
</execute_command>

**IMPORTANT XML FORMATTING RULES:**
- Always use the actual tool name as the XML tag name for proper parsing and execution.
- Every opening tag MUST have a matching closing tag (e.g., <tool_name>...</tool_name>).
- Parameter tags must be nested inside the tool tag.
- Do NOT use self-closing tags (e.g., <param /> is invalid).
- Do NOT include JSON objects or other non-XML formatting for tool calls.
- Do NOT wrap tool calls in markdown code blocks - output raw XML directly.

**COMMON MISTAKES TO AVOID:**
- ❌ Using JSON format: { "tool": "read_file", "path": "src/app.ts" }
- ❌ Missing closing tags: <read_file><path>src/app.ts</path>
- ❌ Using self-closing: <read_file path="src/app.ts" />
- ✅ Correct XML format:
<read_file>
<path>src/app.ts</path>
</read_file>`
	}

	return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. Use the provider-native tool-calling mechanism. Do not include XML markup or examples. You must call at least one tool per assistant response. Prefer calling as many tools as are reasonably needed in a single response to reduce back-and-forth and complete tasks faster.`
}
