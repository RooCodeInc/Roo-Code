import type OpenAI from "openai"
import type { ModeConfig, ToolName, ToolGroup, ModelInfo } from "@roo-code/types"
import { getModeBySlug, getToolsForMode, isToolAllowedForMode } from "../../../shared/modes"
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "../../../shared/tools"
import { defaultModeSlug } from "../../../shared/modes"
import type { CodeIndexManager } from "../../../services/code-index/manager"
import type { McpHub } from "../../../services/mcp/McpHub"
import { searchAndReplaceTool } from "../../tools/SearchAndReplaceTool"
import { writeToFileTool } from "../../tools/WriteToFileTool"
import { applyDiffTool } from "../../tools/ApplyDiffTool"

/**
 * Tool aliases registry - built from tools that define aliases.
 * Maps canonical tool name to array of alias names.
 */
const TOOL_ALIASES: Map<string, string[]> = new Map()

/**
 * Reverse lookup - maps alias name to canonical tool name.
 */
const ALIAS_TO_CANONICAL: Map<string, string> = new Map()

/**
 * Get all tool names from TOOL_GROUPS (including regular tools and customTools).
 */
function getAllToolNames(): Set<string> {
	const toolNames = new Set<string>()
	for (const groupConfig of Object.values(TOOL_GROUPS)) {
		groupConfig.tools.forEach((tool) => toolNames.add(tool))
		if (groupConfig.customTools) {
			groupConfig.customTools.forEach((tool) => toolNames.add(tool))
		}
	}
	return toolNames
}

/**
 * Register a tool's aliases. Validates for duplicate aliases and conflicts with tool names.
 * @param toolName - The canonical tool name
 * @param aliases - Array of alias names
 * @throws Error if an alias is already registered or conflicts with a tool name
 */
function registerToolAliases(toolName: string, aliases: string[]): void {
	if (aliases.length === 0) return

	const allToolNames = getAllToolNames()

	// Check for duplicate aliases and conflicts with tool names
	for (const alias of aliases) {
		if (ALIAS_TO_CANONICAL.has(alias)) {
			throw new Error(
				`Duplicate tool alias "${alias}" - already registered for tool "${ALIAS_TO_CANONICAL.get(alias)}"`,
			)
		}
		if (TOOL_ALIASES.has(alias)) {
			throw new Error(`Alias "${alias}" conflicts with canonical tool name in alias registry`)
		}
		if (allToolNames.has(alias)) {
			throw new Error(`Alias "${alias}" conflicts with existing tool name`)
		}
	}

	// Register the aliases
	TOOL_ALIASES.set(toolName, aliases)
	for (const alias of aliases) {
		ALIAS_TO_CANONICAL.set(alias, toolName)
	}
}

// Register all tool aliases from tool instances
registerToolAliases(searchAndReplaceTool.name, searchAndReplaceTool.aliases)
registerToolAliases(writeToFileTool.name, writeToFileTool.aliases)
registerToolAliases(applyDiffTool.name, applyDiffTool.aliases)

/**
 * Resolves a tool name to its canonical name.
 * If the tool name is an alias, returns the canonical tool name.
 * If it's already a canonical name or unknown, returns as-is.
 *
 * @param toolName - The tool name to resolve (may be an alias)
 * @returns The canonical tool name
 */
export function resolveToolAlias(toolName: string): string {
	const canonical = ALIAS_TO_CANONICAL.get(toolName)
	return canonical ?? toolName
}

/**
 * Applies tool alias resolution to a set of allowed tools.
 * Resolves any aliases to their canonical tool names.
 *
 * @param allowedTools - Set of tools that may contain aliases
 * @returns Set with aliases resolved to canonical names
 */
export function applyToolAliases(allowedTools: Set<string>): Set<string> {
	const result = new Set<string>()

	for (const tool of allowedTools) {
		// Resolve alias to canonical name
		result.add(resolveToolAlias(tool))
	}

	return result
}

/**
 * Gets all tools in an alias group (including the canonical tool).
 *
 * @param toolName - Any tool name in the alias group
 * @returns Array of all tool names in the alias group, or just the tool if not aliased
 */
export function getToolAliasGroup(toolName: string): string[] {
	// Check if it's a canonical tool with aliases
	if (TOOL_ALIASES.has(toolName)) {
		return [toolName, ...TOOL_ALIASES.get(toolName)!]
	}
	// Check if it's an alias
	const canonical = ALIAS_TO_CANONICAL.get(toolName)
	if (canonical) {
		return [canonical, ...TOOL_ALIASES.get(canonical)!]
	}
	return [toolName]
}

/**
 * Apply model-specific tool customization to a set of allowed tools.
 *
 * This function filters tools based on model configuration:
 * 1. Removes tools specified in modelInfo.excludedTools
 * 2. Adds tools from modelInfo.includedTools (only if they belong to allowed groups)
 *
 * @param allowedTools - Set of tools already allowed by mode configuration
 * @param modeConfig - Current mode configuration to check tool groups
 * @param modelInfo - Model configuration with tool customization
 * @returns Modified set of tools after applying model customization
 */
/**
 * Result of applying model tool customization.
 * Contains the set of allowed tools and any alias renames to apply.
 */
interface ModelToolCustomizationResult {
	allowedTools: Set<string>
	/** Maps canonical tool name to alias name for tools that should be renamed */
	aliasRenames: Map<string, string>
}

export function applyModelToolCustomization(
	allowedTools: Set<string>,
	modeConfig: ModeConfig,
	modelInfo?: ModelInfo,
): ModelToolCustomizationResult {
	if (!modelInfo) {
		return { allowedTools, aliasRenames: new Map() }
	}

	const result = new Set(allowedTools)
	const aliasRenames = new Map<string, string>()

	// Apply excluded tools (remove from allowed set)
	if (modelInfo.excludedTools && modelInfo.excludedTools.length > 0) {
		modelInfo.excludedTools.forEach((tool) => {
			const resolvedTool = resolveToolAlias(tool)
			result.delete(resolvedTool)
		})
	}

	// Apply included tools (add to allowed set, but only if they belong to an allowed group)
	if (modelInfo.includedTools && modelInfo.includedTools.length > 0) {
		// Build a map of tool -> group for all tools in TOOL_GROUPS (including customTools)
		const toolToGroup = new Map<string, ToolGroup>()
		for (const [groupName, groupConfig] of Object.entries(TOOL_GROUPS)) {
			// Add regular tools
			groupConfig.tools.forEach((tool) => {
				toolToGroup.set(tool, groupName as ToolGroup)
			})
			// Add customTools (opt-in only tools)
			if (groupConfig.customTools) {
				groupConfig.customTools.forEach((tool) => {
					toolToGroup.set(tool, groupName as ToolGroup)
				})
			}
		}

		// Get the list of allowed groups for this mode
		const allowedGroups = new Set(
			modeConfig.groups.map((groupEntry) => (Array.isArray(groupEntry) ? groupEntry[0] : groupEntry)),
		)

		// Add included tools only if they belong to an allowed group
		// If the tool was specified as an alias, track the rename
		modelInfo.includedTools.forEach((tool) => {
			const resolvedTool = resolveToolAlias(tool)
			const toolGroup = toolToGroup.get(resolvedTool)
			if (toolGroup && allowedGroups.has(toolGroup)) {
				result.add(resolvedTool)
				// If the tool was specified as an alias, rename it in the API
				if (tool !== resolvedTool) {
					aliasRenames.set(resolvedTool, tool)
				}
			}
		})
	}

	return { allowedTools: result, aliasRenames }
}

/**
 * Filters native tools based on mode restrictions and model customization.
 * This ensures native tools are filtered the same way XML tools are filtered in the system prompt.
 *
 * @param nativeTools - Array of all available native tools
 * @param mode - Current mode slug
 * @param customModes - Custom mode configurations
 * @param experiments - Experiment flags
 * @param codeIndexManager - Code index manager for codebase_search feature check
 * @param settings - Additional settings for tool filtering (includes modelInfo for model-specific customization)
 * @param mcpHub - MCP hub for checking available resources
 * @returns Filtered array of tools allowed for the mode
 */
export function filterNativeToolsForMode(
	nativeTools: OpenAI.Chat.ChatCompletionTool[],
	mode: string | undefined,
	customModes: ModeConfig[] | undefined,
	experiments: Record<string, boolean> | undefined,
	codeIndexManager?: CodeIndexManager,
	settings?: Record<string, any>,
	mcpHub?: McpHub,
): OpenAI.Chat.ChatCompletionTool[] {
	// Get mode configuration and all tools for this mode
	const modeSlug = mode ?? defaultModeSlug
	let modeConfig = getModeBySlug(modeSlug, customModes)

	// Fallback to default mode if current mode config is not found
	// This ensures the agent always has functional tools even if a custom mode is deleted
	// or configuration becomes corrupted
	if (!modeConfig) {
		modeConfig = getModeBySlug(defaultModeSlug, customModes)!
	}

	// Get all tools for this mode (including always-available tools)
	const allToolsForMode = getToolsForMode(modeConfig.groups)

	// Filter to only tools that pass permission checks
	let allowedToolNames = new Set(
		allToolsForMode.filter((tool) =>
			isToolAllowedForMode(
				tool as ToolName,
				modeSlug,
				customModes ?? [],
				undefined,
				undefined,
				experiments ?? {},
			),
		),
	)

	// Apply model-specific tool customization
	const modelInfo = settings?.modelInfo as ModelInfo | undefined
	const { allowedTools: customizedTools, aliasRenames } = applyModelToolCustomization(
		allowedToolNames,
		modeConfig,
		modelInfo,
	)
	allowedToolNames = customizedTools

	// Apply tool aliases - if one tool in an alias group is allowed, all aliases are allowed
	allowedToolNames = applyToolAliases(allowedToolNames)

	// Conditionally exclude codebase_search if feature is disabled or not configured
	if (
		!codeIndexManager ||
		!(codeIndexManager.isFeatureEnabled && codeIndexManager.isFeatureConfigured && codeIndexManager.isInitialized)
	) {
		allowedToolNames.delete("codebase_search")
	}

	// Conditionally exclude update_todo_list if disabled in settings
	if (settings?.todoListEnabled === false) {
		allowedToolNames.delete("update_todo_list")
	}

	// Conditionally exclude generate_image if experiment is not enabled
	if (!experiments?.imageGeneration) {
		allowedToolNames.delete("generate_image")
	}

	// Conditionally exclude run_slash_command if experiment is not enabled
	if (!experiments?.runSlashCommand) {
		allowedToolNames.delete("run_slash_command")
	}

	// Conditionally exclude browser_action if disabled in settings
	if (settings?.browserToolEnabled === false) {
		allowedToolNames.delete("browser_action")
	}

	// Conditionally exclude apply_diff if diffs are disabled
	if (settings?.diffEnabled === false) {
		allowedToolNames.delete("apply_diff")
	}

	// Conditionally exclude access_mcp_resource if MCP is not enabled or there are no resources
	if (!mcpHub || !hasAnyMcpResources(mcpHub)) {
		allowedToolNames.delete("access_mcp_resource")
	}

	// Filter native tools based on allowed tool names and apply alias renames
	const filteredTools: OpenAI.Chat.ChatCompletionTool[] = []

	for (const tool of nativeTools) {
		// Handle both ChatCompletionTool and ChatCompletionCustomTool
		if ("function" in tool && tool.function) {
			const toolName = tool.function.name
			if (allowedToolNames.has(toolName)) {
				// Check if this tool should be renamed to an alias
				const aliasName = aliasRenames.get(toolName)
				if (aliasName) {
					// Clone the tool with the alias name
					filteredTools.push({
						...tool,
						function: {
							...tool.function,
							name: aliasName,
						},
					})
				} else {
					filteredTools.push(tool)
				}
			}
		}
	}

	return filteredTools
}

/**
 * Helper function to check if any MCP server has resources available
 */
function hasAnyMcpResources(mcpHub: McpHub): boolean {
	const servers = mcpHub.getServers()
	return servers.some((server) => server.resources && server.resources.length > 0)
}

/**
 * Checks if a specific tool is allowed in the current mode.
 * This is useful for dynamically filtering system prompt content.
 *
 * @param toolName - Name of the tool to check
 * @param mode - Current mode slug
 * @param customModes - Custom mode configurations
 * @param experiments - Experiment flags
 * @param codeIndexManager - Code index manager for codebase_search feature check
 * @param settings - Additional settings for tool filtering
 * @returns true if the tool is allowed in the mode, false otherwise
 */
export function isToolAllowedInMode(
	toolName: ToolName,
	mode: string | undefined,
	customModes: ModeConfig[] | undefined,
	experiments: Record<string, boolean> | undefined,
	codeIndexManager?: CodeIndexManager,
	settings?: Record<string, any>,
): boolean {
	const modeSlug = mode ?? defaultModeSlug

	// Check if it's an always-available tool
	if (ALWAYS_AVAILABLE_TOOLS.includes(toolName)) {
		// But still check for conditional exclusions
		if (toolName === "codebase_search") {
			return !!(
				codeIndexManager &&
				codeIndexManager.isFeatureEnabled &&
				codeIndexManager.isFeatureConfigured &&
				codeIndexManager.isInitialized
			)
		}
		if (toolName === "update_todo_list") {
			return settings?.todoListEnabled !== false
		}
		if (toolName === "generate_image") {
			return experiments?.imageGeneration === true
		}
		if (toolName === "run_slash_command") {
			return experiments?.runSlashCommand === true
		}
		return true
	}

	// Check for browser_action being disabled by user settings
	if (toolName === "browser_action" && settings?.browserToolEnabled === false) {
		return false
	}

	// Check if the tool is allowed by the mode's groups
	// Also check if any tool in the alias group is allowed
	const aliasGroup = getToolAliasGroup(toolName)
	return aliasGroup.some((aliasedTool) =>
		isToolAllowedForMode(
			aliasedTool as ToolName,
			modeSlug,
			customModes ?? [],
			undefined,
			undefined,
			experiments ?? {},
		),
	)
}

/**
 * Gets the list of available tools from a specific tool group for the current mode.
 * This is useful for dynamically building system prompt content based on available tools.
 *
 * @param groupName - Name of the tool group to check
 * @param mode - Current mode slug
 * @param customModes - Custom mode configurations
 * @param experiments - Experiment flags
 * @param codeIndexManager - Code index manager for codebase_search feature check
 * @param settings - Additional settings for tool filtering
 * @returns Array of tool names that are available from the group
 */
export function getAvailableToolsInGroup(
	groupName: ToolGroup,
	mode: string | undefined,
	customModes: ModeConfig[] | undefined,
	experiments: Record<string, boolean> | undefined,
	codeIndexManager?: CodeIndexManager,
	settings?: Record<string, any>,
): ToolName[] {
	const toolGroup = TOOL_GROUPS[groupName]
	if (!toolGroup) {
		return []
	}

	return toolGroup.tools.filter((tool) =>
		isToolAllowedInMode(tool as ToolName, mode, customModes, experiments, codeIndexManager, settings),
	) as ToolName[]
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
