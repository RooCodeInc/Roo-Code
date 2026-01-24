/**
 * Centralized defaults registry for Roo Code settings.
 *
 * IMPORTANT: These defaults should be applied at READ time (when consuming state),
 * NOT at WRITE time (when saving settings). This ensures:
 * - Users who haven't customized a setting inherit future default improvements
 * - Storage only contains intentional user customizations, not copies of defaults
 * - "Reset to Default" properly removes settings from storage (sets to undefined)
 *
 * Pattern:
 * - On save: pass `undefined` to remove a setting from storage (reset to default)
 * - On read: apply defaults using `value ?? settingDefaults.settingName`
 */

import { DEFAULT_CHECKPOINT_TIMEOUT_SECONDS } from "./global-settings.js"

/**
 * Default values for all settings that can be reset to default.
 *
 * These values are the source of truth for defaults throughout the application.
 * When a setting is undefined in storage, these defaults should be applied
 * at consumption time.
 */
export const settingDefaults = {
	// Browser settings
	browserToolEnabled: true,
	browserViewportSize: "900x600",
	remoteBrowserEnabled: false,
	screenshotQuality: 75,

	// Audio/TTS settings
	soundEnabled: true,
	soundVolume: 0.5,
	ttsEnabled: true,
	ttsSpeed: 1.0,

	// Diff/Editor settings
	diffEnabled: true,
	fuzzyMatchThreshold: 1.0,

	// Checkpoint settings
	enableCheckpoints: false,
	checkpointTimeout: DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,

	// Terminal settings
	terminalOutputLineLimit: 500,
	terminalOutputCharacterLimit: 50_000,
	terminalShellIntegrationTimeout: 30_000,

	// Context management settings
	maxOpenTabsContext: 20,
	maxWorkspaceFiles: 200,
	showRooIgnoredFiles: false,
	enableSubfolderRules: false,
	maxReadFileLine: -1,
	maxImageFileSize: 5,
	maxTotalImageSize: 20,
	maxConcurrentFileReads: 5,

	// Diagnostic settings
	includeDiagnosticMessages: true,
	maxDiagnosticMessages: 50,
	writeDelayMs: 1000,

	// Auto-approval settings
	alwaysAllowFollowupQuestions: false,

	// Prompt enhancement settings
	includeTaskHistoryInEnhance: true,

	// UI settings
	reasoningBlockCollapsed: true,
	enterBehavior: "send" as const,

	// Environment details settings
	includeCurrentTime: true,
	includeCurrentCost: true,
	maxGitStatusFiles: 0,

	// Language settings
	language: "en" as const,

	// MCP settings
	mcpEnabled: true,

	// Indexing settings
	codebaseIndexEnabled: false,
	codebaseIndexQdrantUrl: "http://localhost:6333",
	codebaseIndexEmbedderProvider: "openai" as const,
	codebaseIndexEmbedderBaseUrl: "",
	codebaseIndexEmbedderModelId: "",
	codebaseIndexEmbedderModelDimension: 1536,
	codebaseIndexOpenAiCompatibleBaseUrl: "",
	codebaseIndexBedrockRegion: "us-east-1",
	codebaseIndexBedrockProfile: "",
	codebaseIndexSearchMaxResults: 100,
	codebaseIndexSearchMinScore: 0.4,
	codebaseIndexOpenRouterSpecificProvider: "",
} as const

/**
 * Type representing all setting keys that have defaults.
 */
export type SettingWithDefault = keyof typeof settingDefaults

/**
 * Helper function to get a setting value with its default applied.
 * Use this when reading settings from storage.
 *
 * @param key - The setting key
 * @param value - The value from storage (may be undefined)
 * @returns The value if defined, otherwise the default
 *
 * @example
 * const browserToolEnabled = getSettingWithDefault('browserToolEnabled', storedValue)
 */
export function getSettingWithDefault<K extends SettingWithDefault>(
	key: K,
	value: (typeof settingDefaults)[K] | undefined,
): (typeof settingDefaults)[K] {
	return value ?? settingDefaults[key]
}

/**
 * Applies defaults to a partial settings object.
 * Only applies defaults for settings that are undefined.
 *
 * @param settings - Partial settings object
 * @returns Settings object with defaults applied for undefined values
 */
export function applySettingDefaults<T extends Partial<Record<SettingWithDefault, unknown>>>(
	settings: T,
): T & typeof settingDefaults {
	const result = { ...settings } as T & typeof settingDefaults

	for (const key of Object.keys(settingDefaults) as SettingWithDefault[]) {
		if (result[key] === undefined) {
			;(result as Record<SettingWithDefault, unknown>)[key] = settingDefaults[key]
		}
	}

	return result
}
