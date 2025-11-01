import { Anthropic } from "@anthropic-ai/sdk"
import type { ChatCompletionTool as OpenAITool } from "openai/resources/chat/completions"

export interface ToolSpec {
	name: string
	description: string
	parameters: ToolSpecParameter[]
}

export interface ToolSpecParameter {
	name: string
	type?: "string" | "boolean" | "integer" | "array" | "object"
	required: boolean
	description: string
	items?: any
	properties?: Record<string, any>
	[key: string]: any // For additional JSON Schema fields
}

/**
 * Converts a ToolSpec into an OpenAI ChatCompletionTool definition
 */
export function toolSpecToOpenAITool(tool: ToolSpec): OpenAITool {
	const properties: Record<string, any> = {}
	const required: string[] = []

	if (tool.parameters) {
		for (const param of tool.parameters) {
			if (param.required) {
				required.push(param.name)
			}

			const paramType: string = param.type || "string"

			const paramSchema: any = {
				type: paramType,
				description: param.description,
			}

			if (paramType === "array" && param.items) {
				paramSchema.items = param.items
			}

			if (paramType === "object" && param.properties) {
				paramSchema.properties = param.properties
			}

			// Preserve any additional JSON Schema fields
			const reservedKeys = new Set(["name", "required", "description", "type", "items", "properties"])
			for (const key in param) {
				if (!reservedKeys.has(key) && param[key] !== undefined) {
					paramSchema[key] = param[key]
				}
			}

			properties[param.name] = paramSchema
		}
	}

	return {
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			strict: false,
			parameters: {
				type: "object",
				properties,
				required,
				additionalProperties: false,
			},
		},
	}
}

/**
 * Converts a ToolSpec into an Anthropic Tool definition
 */
export function toolSpecToAnthropicTool(tool: ToolSpec): Anthropic.Tool {
	const properties: Record<string, any> = {}
	const required: string[] = []

	if (tool.parameters) {
		for (const param of tool.parameters) {
			if (param.required) {
				required.push(param.name)
			}

			const paramType: string = param.type || "string"

			const paramSchema: any = {
				type: paramType,
				description: param.description,
			}

			if (paramType === "array" && param.items) {
				paramSchema.items = param.items
			}

			if (paramType === "object" && param.properties) {
				paramSchema.properties = param.properties
			}

			// Preserve any additional JSON Schema fields
			const reservedKeys = new Set(["name", "required", "description", "type", "items", "properties"])
			for (const key in param) {
				if (!reservedKeys.has(key) && param[key] !== undefined) {
					paramSchema[key] = param[key]
				}
			}

			properties[param.name] = paramSchema
		}
	}

	return {
		name: tool.name,
		description: tool.description,
		input_schema: {
			type: "object",
			properties,
			required,
		},
	}
}

/**
 * Converts an OpenAI ChatCompletionTool into an Anthropic Tool definition
 */
export function openAIToolToAnthropic(openAITool: OpenAITool): Anthropic.Tool {
	// Handle both function and custom tool types
	const func = "function" in openAITool ? openAITool.function : (openAITool as any).function

	return {
		name: func.name,
		description: func.description || "",
		input_schema: {
			type: "object",
			properties: func.parameters?.properties || {},
			required: (func.parameters?.required as string[]) || [],
		},
	}
}
