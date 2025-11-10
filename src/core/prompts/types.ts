/**
 * Settings passed to system prompt generation functions
 */
export interface SystemPromptSettings {
	maxConcurrentFileReads: number
	todoListEnabled: boolean
	useAgentRules: boolean
	newTaskRequireTodos: boolean
	// Smart tool selection settings
	smartToolSelectionEnabled?: boolean
	smartToolSelectionMinTools?: number
	smartToolSelectionMaxTools?: number
}
