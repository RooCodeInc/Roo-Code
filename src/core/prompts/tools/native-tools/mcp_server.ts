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
	const mcpList = modeConfig?.mcpList

	const servers = mcpHub.getServers(mcpList)
	const tools: OpenAI.Chat.ChatCompletionTool[] = []
	const seenToolNames = new Set<string>()

	for (const server of servers) {
		let serverConfig: any = {}
		try {
			serverConfig = JSON.parse(server.config)
		} catch (e) {
			console.warn(`[getMcpServerTools] ⚠ Failed to parse config for "${server.name}"`)
		}

		const visible = isServerVisibleToAgent(server.name, serverConfig, mcpList)
		if (!visible) {
			continue
		}

		if (!server.tools) {
			continue
		}

		for (const tool of server.tools) {
			if (tool.enabledForPrompt === false) {
				continue
			}

			const toolName = buildMcpToolName(server.name, tool.name)

			if (seenToolNames.has(toolName)) {
				continue
			}
			seenToolNames.add(toolName)

			const originalSchema = tool.inputSchema as Record<string, unknown> | undefined

			let parameters: JsonSchema
			if (originalSchema) {
				parameters = normalizeToolSchema(originalSchema) as JsonSchema
			} else {
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
