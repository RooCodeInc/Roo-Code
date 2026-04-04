import type OpenAI from "openai"
import { McpHub } from "../../../../services/mcp/McpHub"
import { buildMcpToolName } from "../../../../utils/mcp-name"
import { normalizeToolSchema, type JsonSchema } from "../../../../utils/json-schema"
import { defaultModeSlug, getModeBySlug } from "../../../../shared/modes"
import { isServerVisibleToAgent } from "../../../../services/mcp/McpMigration"
import { ModeConfig } from "@jabberwock/types"

/**
 * Dynamically generates native tool definitions for all enabled tools across connected MCP servers.
 * Tools are deduplicated by name to prevent API errors. When the same server exists in both
 * global and project configs, project servers take priority (handled by McpHub.getServers()).
 *
 * @param mcpHub The McpHub instance containing connected servers.
 * @param mode Current mode slug for context isolation.
 * @param customModes Custom mode configurations.
 * @returns An array of OpenAI.Chat.ChatCompletionTool definitions.
 */
export function getMcpServerTools(
	mcpHub?: McpHub,
	mode?: string,
	customModes?: ModeConfig[],
): OpenAI.Chat.ChatCompletionTool[] {
	if (!mcpHub) {
		return []
	}

	const modeSlug = mode ?? defaultModeSlug
	const modeConfig = getModeBySlug(modeSlug, customModes)
	const mcpList = modeConfig?.mcpList ?? []

	const servers = mcpHub.getServers()
	const tools: OpenAI.Chat.ChatCompletionTool[] = []
	// Track seen tool names to prevent duplicates (e.g., when same server exists in both global and project configs)
	const seenToolNames = new Set<string>()

	for (const server of servers) {
		// Jabberwock: Context Isolation (Per-Agent MCP)
		let serverConfig: any = {}
		try {
			serverConfig = JSON.parse(server.config)
		} catch (e) {
			// ignore parsing error
		}

		if (!isServerVisibleToAgent(server.name, serverConfig, mcpList)) {
			continue
		}

		if (!server.tools) {
			continue
		}
		for (const tool of server.tools) {
			// Filter tools where tool.enabledForPrompt is not explicitly false
			if (tool.enabledForPrompt === false) {
				continue
			}

			// Build sanitized tool name for API compliance
			// The name is sanitized to conform to API requirements (e.g., Gemini's function name restrictions)
			const toolName = buildMcpToolName(server.name, tool.name)

			// Skip duplicate tool names - first occurrence wins (project servers come before global servers)
			if (seenToolNames.has(toolName)) {
				continue
			}
			seenToolNames.add(toolName)

			const originalSchema = tool.inputSchema as Record<string, unknown> | undefined

			// Normalize schema for JSON Schema 2020-12 compliance (type arrays → anyOf)
			let parameters: JsonSchema
			if (originalSchema) {
				parameters = normalizeToolSchema(originalSchema) as JsonSchema
			} else {
				// No schema provided - create a minimal valid schema
				parameters = { type: "object", additionalProperties: false } as JsonSchema
			}

			const toolDefinition: OpenAI.Chat.ChatCompletionTool = {
				type: "function",
				function: {
					name: toolName,
					description: tool.description,
					parameters: parameters as OpenAI.FunctionParameters,
				},
			}

			tools.push(toolDefinition)
		}
	}

	return tools
}
