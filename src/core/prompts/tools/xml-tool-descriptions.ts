import type OpenAI from "openai"

/**
 * Converts native tool definitions (OpenAI ChatCompletionTool format) into
 * XML-formatted tool description text for inclusion in the system prompt.
 *
 * When useXmlToolCalling is enabled, the model doesn't receive native tool
 * definitions in the API request body. Instead, tools are described in the
 * system prompt using XML format so the model outputs tool calls as raw XML.
 */

/**
 * Generate a complete XML tools catalog from native tool definitions.
 *
 * @param tools - Array of OpenAI ChatCompletionTool definitions
 * @returns A string containing all tool descriptions formatted for XML tool calling
 */
export function generateXmlToolsCatalog(tools: OpenAI.Chat.ChatCompletionTool[]): string {
	const toolDescriptions = tools
		.filter((tool) => tool.type === "function" && tool.function)
		.map((tool) => generateXmlToolDescription(tool))
		.join("\n\n")

	return `\n\n# Tools\n\n${toolDescriptions}`
}

/**
 * Generate an XML-formatted description for a single tool.
 */
function generateXmlToolDescription(tool: OpenAI.Chat.ChatCompletionTool): string {
	if (tool.type !== "function" || !("function" in tool)) return ""
	const func = (tool as any).function as { name: string; description?: string; parameters?: unknown }
	if (!func) return ""

	const name = func.name
	const description = func.description || ""
	const params = func.parameters as JsonSchema | undefined

	const paramDescriptions = params ? formatParameters(params) : ""
	const usageExample = params ? generateUsageExample(name, params) : `<${name}>\n</${name}>`

	return `## ${name}

Description: ${description}

${paramDescriptions}
Usage:
${usageExample}`
}

interface JsonSchema {
	type?: string
	properties?: Record<string, JsonSchemaProperty>
	required?: string[]
	additionalProperties?: boolean
}

interface JsonSchemaProperty {
	type?: string | string[]
	description?: string
	enum?: string[]
	properties?: Record<string, JsonSchemaProperty>
	required?: string[]
	items?: JsonSchemaProperty
}

/**
 * Format parameter descriptions from a JSON schema.
 */
function formatParameters(schema: JsonSchema): string {
	if (!schema.properties || Object.keys(schema.properties).length === 0) {
		return "Parameters: None\n"
	}

	const required = new Set(schema.required || [])
	const lines: string[] = ["Parameters:"]

	for (const [paramName, paramDef] of Object.entries(schema.properties)) {
		const isRequired = required.has(paramName)
		const reqLabel = isRequired ? "required" : "optional"
		const typeStr = formatType(paramDef.type)
		const desc = paramDef.description || ""
		const enumValues = paramDef.enum ? ` (values: ${paramDef.enum.join(", ")})` : ""

		lines.push(`- ${paramName}: (${reqLabel}${typeStr ? ", " + typeStr : ""}) ${desc}${enumValues}`)

		// Handle nested object parameters (like indentation in read_file)
		if (paramDef.type === "object" && paramDef.properties) {
			const nestedRequired = new Set(paramDef.required || [])
			for (const [nestedName, nestedDef] of Object.entries(paramDef.properties)) {
				const nestedReqLabel = nestedRequired.has(nestedName) ? "required" : "optional"
				const nestedType = formatType(nestedDef.type)
				const nestedDesc = nestedDef.description || ""
				lines.push(`  - ${nestedName}: (${nestedReqLabel}${nestedType ? ", " + nestedType : ""}) ${nestedDesc}`)
			}
		}
	}

	return lines.join("\n") + "\n"
}

/**
 * Format a JSON schema type into a readable string.
 */
function formatType(type: string | string[] | undefined): string {
	if (!type) return ""
	if (Array.isArray(type)) {
		return type.filter((t) => t !== "null").join(" | ")
	}
	return type
}

/**
 * Generate an XML usage example showing the tool's required parameters.
 */
function generateUsageExample(toolName: string, schema: JsonSchema): string {
	if (!schema.properties) {
		return `<${toolName}>\n</${toolName}>`
	}

	const required = new Set(schema.required || [])
	const exampleParams: string[] = []

	for (const [paramName, paramDef] of Object.entries(schema.properties)) {
		// Only show required params in the example to keep it concise
		if (required.has(paramName)) {
			// For nested objects, flatten them into individual tags
			if (paramDef.type === "object" && paramDef.properties) {
				// Skip nested object example in the outer example - they are documented in parameters
				exampleParams.push(`<${paramName}>...nested parameters...</${paramName}>`)
			} else {
				const placeholder = getPlaceholder(paramName, paramDef)
				exampleParams.push(`<${paramName}>${placeholder}</${paramName}>`)
			}
		}
	}

	const paramsStr = exampleParams.map((p) => `${p}`).join("\n")
	return `<${toolName}>\n${paramsStr}\n</${toolName}>`
}

/**
 * Get a meaningful placeholder value for a parameter.
 */
function getPlaceholder(paramName: string, paramDef: JsonSchemaProperty): string {
	if (paramDef.enum && paramDef.enum.length > 0) {
		return paramDef.enum[0]
	}

	// Common parameter name to placeholder mapping
	const placeholders: Record<string, string> = {
		path: "file path here",
		command: "your command here",
		content: "file content here",
		query: "search query here",
		regex: "regex pattern here",
		question: "your question here",
		result: "your result here",
		message: "your message here",
		diff: "diff content here",
		patch: "patch content here",
		mode_slug: "mode slug here",
		reason: "reason here",
		server_name: "server name here",
		tool_name: "tool name here",
		uri: "resource URI here",
		file_path: "file path here",
		old_string: "old string here",
		new_string: "new string here",
		skill: "skill name here",
		prompt: "image prompt here",
		todos: "todo list here",
	}

	return placeholders[paramName] || `${paramName} value`
}
