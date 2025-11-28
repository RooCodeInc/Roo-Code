import type { ToolName, ModeConfig } from "@roo-code/types"

import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS, DiffStrategy } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"
import { Mode, getModeConfig, isToolAllowedForMode, getGroupName } from "../../../shared/modes"

import { ToolArgs } from "./types"
import { getExecuteCommandDescription } from "./execute-command"
import { getReadFileDescription } from "./read-file"
import { getSimpleReadFileDescription } from "./simple-read-file"
import { getFetchInstructionsDescription } from "./fetch-instructions"
import { shouldUseSingleFileRead } from "@roo-code/types"
import { getWriteToFileDescription } from "./write-to-file"
import { getSearchFilesDescription } from "./search-files"
import { getListFilesDescription } from "./list-files"
import { getInsertContentDescription } from "./insert-content"
import { getListCodeDefinitionNamesDescription } from "./list-code-definition-names"
import { getBrowserActionDescription } from "./browser-action"
import { getAskFollowupQuestionDescription } from "./ask-followup-question"
import { getAttemptCompletionDescription } from "./attempt-completion"
import { getUseMcpToolDescription } from "./use-mcp-tool"
import { getAccessMcpResourceDescription } from "./access-mcp-resource"
import { getSwitchModeDescription } from "./switch-mode"
import { getNewTaskDescription } from "./new-task"
import { getCodebaseSearchDescription } from "./codebase-search"
import { getUpdateTodoListDescription } from "./update-todo-list"
import { getRunSlashCommandDescription } from "./run-slash-command"
import { getGenerateImageDescription } from "./generate-image"
import { CodeIndexManager } from "../../../services/code-index/manager"

// Import lite descriptions
import {
	getLiteReadFileDescription,
	getLiteWriteToFileDescription,
	getLiteSearchFilesDescription,
	getLiteListFilesDescription,
	getLiteExecuteCommandDescription,
	getLiteInsertContentDescription,
	getLiteListCodeDefinitionNamesDescription,
	getLiteAskFollowupQuestionDescription,
	getLiteAttemptCompletionDescription,
	getLiteBrowserActionDescription,
	getLiteSwitchModeDescription,
	getLiteNewTaskDescription,
	getLiteUpdateTodoListDescription,
	getLiteFetchInstructionsDescription,
	getLiteApplyDiffDescription,
	getLiteCodebaseSearchDescription,
	getLiteUseMcpToolDescription,
	getLiteAccessMcpResourceDescription,
	getLiteGenerateImageDescription,
	getLiteRunSlashCommandDescription,
} from "./lite-descriptions"

// Map of tool names to their description functions
const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
	execute_command: (args) => {
		if (args.settings?.liteMode) return getLiteExecuteCommandDescription()
		return getExecuteCommandDescription(args)
	},
	read_file: (args) => {
		if (args.settings?.liteMode) return getLiteReadFileDescription(args)
		// Check if the current model should use the simplified read_file tool
		const modelId = args.settings?.modelId
		if (modelId && shouldUseSingleFileRead(modelId)) {
			return getSimpleReadFileDescription(args)
		}
		return getReadFileDescription(args)
	},
	fetch_instructions: (args) => {
		if (args.settings?.liteMode) return getLiteFetchInstructionsDescription()
		return getFetchInstructionsDescription(args.settings?.enableMcpServerCreation)
	},
	write_to_file: (args) => {
		if (args.settings?.liteMode) return getLiteWriteToFileDescription()
		return getWriteToFileDescription(args)
	},
	search_files: (args) => {
		if (args.settings?.liteMode) return getLiteSearchFilesDescription()
		return getSearchFilesDescription(args)
	},
	list_files: (args) => {
		if (args.settings?.liteMode) return getLiteListFilesDescription()
		return getListFilesDescription(args)
	},
	list_code_definition_names: (args) => {
		if (args.settings?.liteMode) return getLiteListCodeDefinitionNamesDescription()
		return getListCodeDefinitionNamesDescription(args)
	},
	browser_action: (args) => {
		if (args.settings?.liteMode) return getLiteBrowserActionDescription()
		return getBrowserActionDescription(args)
	},
	ask_followup_question: (args) => {
		if (args.settings?.liteMode) return getLiteAskFollowupQuestionDescription()
		return getAskFollowupQuestionDescription()
	},
	attempt_completion: (args) => {
		if (args.settings?.liteMode) return getLiteAttemptCompletionDescription()
		return getAttemptCompletionDescription(args)
	},
	use_mcp_tool: (args) => {
		if (args.settings?.liteMode) return getLiteUseMcpToolDescription()
		return getUseMcpToolDescription(args)
	},
	access_mcp_resource: (args) => {
		if (args.settings?.liteMode) return getLiteAccessMcpResourceDescription()
		return getAccessMcpResourceDescription(args)
	},
	codebase_search: (args) => {
		if (args.settings?.liteMode) return getLiteCodebaseSearchDescription()
		return getCodebaseSearchDescription(args)
	},
	switch_mode: (args) => {
		if (args.settings?.liteMode) return getLiteSwitchModeDescription()
		return getSwitchModeDescription()
	},
	new_task: (args) => {
		if (args.settings?.liteMode) return getLiteNewTaskDescription()
		return getNewTaskDescription(args)
	},
	insert_content: (args) => {
		if (args.settings?.liteMode) return getLiteInsertContentDescription()
		return getInsertContentDescription(args)
	},
	apply_diff: (args) => {
		if (args.settings?.liteMode) return getLiteApplyDiffDescription(args.diffStrategy)
		return args.diffStrategy
			? args.diffStrategy.getToolDescription({ cwd: args.cwd, toolOptions: args.toolOptions })
			: ""
	},
	update_todo_list: (args) => {
		if (args.settings?.liteMode) return getLiteUpdateTodoListDescription()
		return getUpdateTodoListDescription(args)
	},
	run_slash_command: (args) => {
		if (args.settings?.liteMode) return getLiteRunSlashCommandDescription()
		return getRunSlashCommandDescription()
	},
	generate_image: (args) => {
		if (args.settings?.liteMode) return getLiteGenerateImageDescription()
		return getGenerateImageDescription(args)
	},
}

export function getToolDescriptionsForMode(
	mode: Mode,
	cwd: string,
	supportsComputerUse: boolean,
	codeIndexManager?: CodeIndexManager,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mcpHub?: McpHub,
	customModes?: ModeConfig[],
	experiments?: Record<string, boolean>,
	partialReadsEnabled?: boolean,
	settings?: Record<string, any>,
	enableMcpServerCreation?: boolean,
	modelId?: string,
): string {
	const config = getModeConfig(mode, customModes)
	const args: ToolArgs = {
		cwd,
		supportsComputerUse,
		diffStrategy,
		browserViewportSize,
		mcpHub,
		partialReadsEnabled,
		settings: {
			...settings,
			enableMcpServerCreation,
			modelId,
		},
		experiments,
	}

	const tools = new Set<string>()

	// Add tools from mode's groups
	config.groups.forEach((groupEntry) => {
		const groupName = getGroupName(groupEntry)
		const toolGroup = TOOL_GROUPS[groupName]
		if (toolGroup) {
			toolGroup.tools.forEach((tool) => {
				if (
					isToolAllowedForMode(
						tool as ToolName,
						mode,
						customModes ?? [],
						undefined,
						undefined,
						experiments ?? {},
					)
				) {
					tools.add(tool)
				}
			})
		}
	})

	// Add always available tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

	// Conditionally exclude codebase_search if feature is disabled or not configured
	if (
		!codeIndexManager ||
		!(codeIndexManager.isFeatureEnabled && codeIndexManager.isFeatureConfigured && codeIndexManager.isInitialized)
	) {
		tools.delete("codebase_search")
	}

	// Conditionally exclude update_todo_list if disabled in settings
	if (settings?.todoListEnabled === false) {
		tools.delete("update_todo_list")
	}

	// Conditionally exclude generate_image if experiment is not enabled
	if (!experiments?.imageGeneration) {
		tools.delete("generate_image")
	}

	// Conditionally exclude run_slash_command if experiment is not enabled
	if (!experiments?.runSlashCommand) {
		tools.delete("run_slash_command")
	}

	// Map tool descriptions for allowed tools
	const descriptions = Array.from(tools).map((toolName) => {
		const descriptionFn = toolDescriptionMap[toolName]
		if (!descriptionFn) {
			return undefined
		}

		const description = descriptionFn({
			...args,
			toolOptions: undefined, // No tool options in group-based approach
		})

		return description
	})

	return `# Tools\n\n${descriptions.filter(Boolean).join("\n\n")}`
}

// Export individual description functions for backward compatibility
export {
	getExecuteCommandDescription,
	getReadFileDescription,
	getSimpleReadFileDescription,
	getFetchInstructionsDescription,
	getWriteToFileDescription,
	getSearchFilesDescription,
	getListFilesDescription,
	getListCodeDefinitionNamesDescription,
	getBrowserActionDescription,
	getAskFollowupQuestionDescription,
	getAttemptCompletionDescription,
	getUseMcpToolDescription,
	getAccessMcpResourceDescription,
	getSwitchModeDescription,
	getInsertContentDescription,
	getCodebaseSearchDescription,
	getRunSlashCommandDescription,
	getGenerateImageDescription,
}

// Export native tool definitions (JSON schema format for OpenAI-compatible APIs)
export { nativeTools } from "./native-tools"
