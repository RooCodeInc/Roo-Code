import * as vscode from "vscode"
import { ContextProxy } from "../../core/config/ContextProxy"

export interface ConversationMemoryConfig {
	// Basic enablement
	enabled: boolean
	provider: "inherit" | "openai" | "ollama" | "anthropic" | "custom"

	// When provider !== 'inherit', these are used:
	memoryLLMProvider?: string
	memoryModelId?: string
	memoryLLMOptions?: Record<string, any>

	// Memory-specific settings
	autoExtraction: boolean
	processingMode: "realtime" | "background" | "manual"
	factRetentionDays: number
	maxFactsPerConversation: number
	conflictResolutionMode: "aggressive" | "conservative" | "manual"

	// Token and cost budgets
	promptBudgetTokens: number
	memoryToolDefaultLimit: number
	dailyProcessingBudgetUSD: number
}

export class ConversationMemoryConfigManager {
	private currentConfig: ConversationMemoryConfig | undefined
	private contextProxy: ContextProxy

	constructor(contextProxy: ContextProxy) {
		this.contextProxy = contextProxy
	}

	public async loadConfiguration(): Promise<{ requiresRestart: boolean }> {
		const previousConfig = this.currentConfig

		// Load memory-specific configuration
		const memoryConfig = vscode.workspace.getConfiguration("roo.conversationMemory")
		const codeIndexConfig = vscode.workspace.getConfiguration("roo.codeIndex")

		// Determine inheritance mode
		const inheritanceMode = memoryConfig.get("provider", "inherit")

		if (inheritanceMode === "inherit") {
			// Inherit from code indexing settings
			this.currentConfig = {
				enabled: memoryConfig.get("enabled", false),
				provider: "inherit",

				// Inherit LLM settings from code indexing
				memoryLLMProvider: codeIndexConfig.get("embedderProvider"),
				memoryModelId: codeIndexConfig.get("modelId"),
				memoryLLMOptions: {
					...codeIndexConfig.get("openAiOptions", {}),
					...codeIndexConfig.get("ollamaOptions", {}),
					...codeIndexConfig.get("geminiOptions", {}),
					...codeIndexConfig.get("mistralOptions", {}),
				},

				// Memory-specific settings
				autoExtraction: memoryConfig.get("autoExtraction", true),
				processingMode: memoryConfig.get("processingMode", "background"),
				factRetentionDays: memoryConfig.get("retentionDays", 90),
				maxFactsPerConversation: memoryConfig.get("maxFacts", 10),
				conflictResolutionMode: memoryConfig.get("conflictResolutionMode", "conservative"),

				// Budgets
				promptBudgetTokens: memoryConfig.get("promptBudgetTokens", 400),
				memoryToolDefaultLimit: memoryConfig.get("memoryToolDefaultLimit", 10),
				dailyProcessingBudgetUSD: memoryConfig.get("dailyProcessingBudgetUSD", 1.0),
			}
		} else {
			// Independent configuration
			this.currentConfig = {
				enabled: memoryConfig.get("enabled", false),
				provider: memoryConfig.get("provider", "inherit"),
				memoryLLMProvider: memoryConfig.get("memoryLLMProvider"),
				memoryModelId: memoryConfig.get("memoryModelId"),
				memoryLLMOptions: memoryConfig.get("memoryLLMOptions", {}),

				// Memory-specific settings
				autoExtraction: memoryConfig.get("autoExtraction", true),
				processingMode: memoryConfig.get("processingMode", "background"),
				factRetentionDays: memoryConfig.get("retentionDays", 90),
				maxFactsPerConversation: memoryConfig.get("maxFacts", 10),
				conflictResolutionMode: memoryConfig.get("conflictResolutionMode", "conservative"),

				// Budgets
				promptBudgetTokens: memoryConfig.get("promptBudgetTokens", 400),
				memoryToolDefaultLimit: memoryConfig.get("memoryToolDefaultLimit", 10),
				dailyProcessingBudgetUSD: memoryConfig.get("dailyProcessingBudgetUSD", 1.0),
			}
		}

		// Determine if restart is required
		const requiresRestart = this.hasSignificantChanges(previousConfig, this.currentConfig)

		return { requiresRestart }
	}

	public getConfig(): ConversationMemoryConfig {
		if (!this.currentConfig) {
			throw new Error("Configuration not loaded. Call loadConfiguration() first.")
		}
		return this.currentConfig
	}

	public get isFeatureEnabled(): boolean {
		return this.currentConfig?.enabled ?? false
	}

	public get isFeatureConfigured(): boolean {
		if (!this.currentConfig?.enabled) {
			return false
		}

		// Check if we have necessary LLM configuration
		if (this.currentConfig.provider === "inherit") {
			// Check if code indexing is configured
			const codeIndexConfig = vscode.workspace.getConfiguration("roo.codeIndex")
			return codeIndexConfig.get("enabled", false) && codeIndexConfig.get("embedderProvider") !== undefined
		}

		// For independent configuration, check if provider is set
		return this.currentConfig.memoryLLMProvider !== undefined
	}

	public validateDependencies(): { isValid: boolean; errors: string[]; warnings: string[] } {
		const codeIndexConfig = vscode.workspace.getConfiguration("roo.codeIndex")
		const memoryConfig = vscode.workspace.getConfiguration("roo.conversationMemory")

		const errors: string[] = []
		const warnings: string[] = []

		// Memory system can work independently or inherit from code indexing
		if (memoryConfig.get("provider") === "inherit") {
			// Check if code indexing is enabled when inheriting
			if (!codeIndexConfig.get("enabled", false) && memoryConfig.get("enabled", false)) {
				warnings.push(
					"Conversation memory is set to inherit from code indexing, but code indexing is disabled. Consider enabling code indexing or using independent configuration.",
				)
			}

			// Check embedder configuration
			const provider = codeIndexConfig.get("embedderProvider")
			if (!provider && memoryConfig.get("provider") === "inherit") {
				errors.push(
					"No embedder provider configured for code indexing. Configure code indexing first or set independent memory provider.",
				)
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	private hasSignificantChanges(
		oldConfig: ConversationMemoryConfig | undefined,
		newConfig: ConversationMemoryConfig,
	): boolean {
		if (!oldConfig) {
			return true
		}

		// Check for changes that require restart
		return (
			oldConfig.provider !== newConfig.provider ||
			oldConfig.memoryLLMProvider !== newConfig.memoryLLMProvider ||
			oldConfig.memoryModelId !== newConfig.memoryModelId ||
			JSON.stringify(oldConfig.memoryLLMOptions) !== JSON.stringify(newConfig.memoryLLMOptions)
		)
	}
}
