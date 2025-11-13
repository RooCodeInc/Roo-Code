import type OpenAI from "openai"
import type { ModeConfig, ToolName } from "@roo-code/types"
import { getModeBySlug, getGroupName, isToolAllowedForMode } from "../../../shared/modes"
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "../../../shared/tools"
import { defaultModeSlug } from "../../../shared/modes"

/**
 * Filters native tools based on mode restrictions.
 * This ensures native tools are filtered the same way XML tools are filtered in the system prompt.
 *
 * @param nativeTools - Array of all available native tools
 * @param mode - Current mode slug
 * @param customModes - Custom mode configurations
 * @param experiments - Experiment flags
 * @returns Filtered array of tools allowed for the mode
 */
export function filterNativeToolsForMode(
	nativeTools: OpenAI.Chat.ChatCompletionTool[],
	mode: string | undefined,
	customModes: ModeConfig[] | undefined,
	experiments: Record<string, boolean> | undefined,
): OpenAI.Chat.ChatCompletionTool[] {
	// Get mode configuration and build set of allowed tools
	const modeSlug = mode ?? defaultModeSlug
	const modeConfig = getModeBySlug(modeSlug, customModes)
	const allowedToolNames = new Set<string>()

	// Add tools from mode's groups that pass permission checks
	if (modeConfig) {
		modeConfig.groups.forEach((groupEntry) => {
			const groupName = getGroupName(groupEntry)
			const toolGroup = TOOL_GROUPS[groupName]
			if (toolGroup) {
				toolGroup.tools.forEach((tool) => {
					if (
						isToolAllowedForMode(
							tool as ToolName,
							modeSlug,
							customModes ?? [],
							undefined,
							undefined,
							experiments ?? {},
						)
					) {
						allowedToolNames.add(tool)
					}
				})
			}
		})
	}

	// Add always-available tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => allowedToolNames.add(tool))

	// Filter native tools based on allowed tool names
	return nativeTools.filter((tool) => {
		// Handle both ChatCompletionTool and ChatCompletionCustomTool
		if ("function" in tool && tool.function) {
			return allowedToolNames.has(tool.function.name)
		}
		return false
	})
}

/**
 * Filters MCP tools based on whether use_mcp_tool is allowed in the current mode.
 *
 * @param mcpTools - Array of MCP tools
 * @param mode - Current mode slug
 * @param customModes - Custom mode configurations
 * @param experiments - Experiment flags
 * @returns Filtered array of MCP tools if use_mcp_tool is allowed, empty array otherwise
 */
export function filterMcpToolsForMode(
	mcpTools: OpenAI.Chat.ChatCompletionTool[],
	mode: string | undefined,
	customModes: ModeConfig[] | undefined,
	experiments: Record<string, boolean> | undefined,
): OpenAI.Chat.ChatCompletionTool[] {
	const modeSlug = mode ?? defaultModeSlug

	// MCP tools are always in the mcp group, check if use_mcp_tool is allowed
	const isMcpAllowed = isToolAllowedForMode(
		"use_mcp_tool",
		modeSlug,
		customModes ?? [],
		undefined,
		undefined,
		experiments ?? {},
	)

	return isMcpAllowed ? mcpTools : []
}
