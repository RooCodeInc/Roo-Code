/**
 * Generates XML-formatted tool descriptions for the system prompt.
 *
 * When useXmlToolCalling is enabled, native tool definitions are omitted from the
 * API request. Instead, tool descriptions must be embedded in the system prompt
 * so the model knows what tools are available and their parameter schemas.
 *
 * This module converts OpenAI ChatCompletionTool definitions to the XML-based
 * tool description format that the model can understand.
 */

import type OpenAI from "openai"

/**
 * Convert an array of OpenAI tool definitions into an XML tool catalog
 * suitable for inclusion in the system prompt.
 *
 * @param tools - Array of OpenAI ChatCompletionTool definitions
 * @returns XML-formatted tool catalog string
 */
// Hand-crafted descriptions for critical tools that models struggle with.
// These match the original Roo Code XML format with detailed examples.
const HANDCRAFTED_TOOL_DESCRIPTIONS: Record<string, string> = {
	attempt_completion: `## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must confirm that you've received successful results from the user for any previous tool uses. If not, then DO NOT use this tool.
Parameters:
- result: (required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.
Usage:
<attempt_completion>
<result>
Your final result description here
</result>
</attempt_completion>

Example: Completing after updating CSS
<attempt_completion>
<result>
I've updated the CSS to use flexbox layout for better responsiveness
</result>
</attempt_completion>`,

	ask_followup_question: `## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task. Use when you need clarification or more details to proceed effectively.
Parameters:
- question: (required) A clear, specific question addressing the information needed.
- follow_up: (required) A list of 2-4 suggested answers, each in its own <suggest> tag. Suggestions must be complete, actionable answers without placeholders.
Usage:
<ask_followup_question>
<question>Your question here</question>
<follow_up>
<suggest>First suggestion</suggest>
<suggest>Second suggestion</suggest>
<suggest>Third suggestion</suggest>
</follow_up>
</ask_followup_question>

Example: Asking about a file path
<ask_followup_question>
<question>What is the path to the frontend-config.json file?</question>
<follow_up>
<suggest>./src/frontend-config.json</suggest>
<suggest>./config/frontend-config.json</suggest>
<suggest>./frontend-config.json</suggest>
</follow_up>
</ask_followup_question>`,
}

export function generateXmlToolCatalog(tools: OpenAI.Chat.ChatCompletionTool[]): string {
	if (!tools || tools.length === 0) {
		return ""
	}

	const toolDescriptions = tools
		.map((tool) => {
			// Use hand-crafted descriptions for critical tools
			const toolName = (tool as any).function?.name
			if (toolName && HANDCRAFTED_TOOL_DESCRIPTIONS[toolName]) {
				return HANDCRAFTED_TOOL_DESCRIPTIONS[toolName]
			}
			return formatToolAsXml(tool)
		})
		.join("\n\n")

	return `\n\n# Tools\n\n${toolDescriptions}`
}

/**
 * Format a single OpenAI tool definition as a COMPACT XML tool description.
 * Keeps descriptions short to save context window space for local models.
 */
function formatToolAsXml(tool: OpenAI.Chat.ChatCompletionTool): string {
	if (tool.type !== "function" || !("function" in tool)) {
		return ""
	}
	const fn = (tool as any).function as { name: string; description?: string; parameters?: unknown }
	const name = fn.name
	// Truncate description to first sentence to save tokens
	const fullDesc = fn.description || ""
	const firstSentence = fullDesc.split(/\.(?:\s|$)/)[0]
	const description = firstSentence.length < 200 ? firstSentence + "." : fullDesc.substring(0, 200) + "..."
	const params = fn.parameters as JsonSchema | undefined

	let result = `## ${name}\n${description}\nUsage: <${name}>`

	if (params && params.properties) {
		const required = new Set(params.required || [])
		const paramParts: string[] = []
		for (const [paramName, paramSchema] of Object.entries(params.properties)) {
			const isRequired = required.has(paramName)
			paramParts.push(`<${paramName}>${isRequired ? "(required)" : "(optional)"}</${paramName}>`)
		}
		result += paramParts.join("")
	}

	result += `</${name}>`
	return result
}

/**
 * Format a JSON schema type into a human-readable string.
 */
function formatParamType(schema: JsonSchema): string {
	if (schema.enum) {
		return schema.enum.map((v: unknown) => `"${v}"`).join(" | ")
	}

	if (schema.type === "object") {
		return "object"
	}

	if (schema.type === "array") {
		const itemType = schema.items ? formatParamType(schema.items as JsonSchema) : "any"
		return `array of ${itemType}`
	}

	return schema.type || "string"
}

/**
 * Minimal JSON Schema type for our parsing needs.
 */
interface JsonSchema {
	type?: string
	description?: string
	properties?: Record<string, unknown>
	required?: string[]
	items?: unknown
	enum?: unknown[]
	additionalProperties?: boolean
}
