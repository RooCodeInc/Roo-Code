import { ToolProtocol } from "@roo-code/types"

/**
 * Settings passed to system prompt generation functions
 */
export interface SystemPromptSettings {
	maxConcurrentFileReads: number
	todoListEnabled: boolean
	useAgentRules: boolean
	newTaskRequireTodos: boolean
	terminalShellIntegrationDisabled?: boolean
	toolProtocol?: ToolProtocol
}
