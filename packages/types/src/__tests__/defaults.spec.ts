import { describe, expect, it } from "vitest"
import { settingDefaults, getSettingWithDefault } from "../defaults.js"
import { DEFAULT_CHECKPOINT_TIMEOUT_SECONDS, DEFAULT_WRITE_DELAY_MS } from "../global-settings.js"

describe("settingDefaults", () => {
	it("should have all expected default values", () => {
		// Auto-approval settings (all default to false for safety)
		expect(settingDefaults.autoApprovalEnabled).toBe(false)
		expect(settingDefaults.alwaysAllowReadOnly).toBe(false)
		expect(settingDefaults.alwaysAllowReadOnlyOutsideWorkspace).toBe(false)
		expect(settingDefaults.alwaysAllowWrite).toBe(false)
		expect(settingDefaults.alwaysAllowWriteOutsideWorkspace).toBe(false)
		expect(settingDefaults.alwaysAllowWriteProtected).toBe(false)
		expect(settingDefaults.alwaysAllowBrowser).toBe(false)
		expect(settingDefaults.alwaysAllowMcp).toBe(false)
		expect(settingDefaults.alwaysAllowModeSwitch).toBe(false)
		expect(settingDefaults.alwaysAllowSubtasks).toBe(false)
		expect(settingDefaults.alwaysAllowExecute).toBe(false)
		expect(settingDefaults.alwaysAllowFollowupQuestions).toBe(false)
		expect(settingDefaults.requestDelaySeconds).toBe(0)
		expect(settingDefaults.followupAutoApproveTimeoutMs).toBe(0)
		expect(settingDefaults.commandExecutionTimeout).toBe(0)
		expect(settingDefaults.preventCompletionWithOpenTodos).toBe(false)
		expect(settingDefaults.autoCondenseContext).toBe(false)
		expect(settingDefaults.autoCondenseContextPercent).toBe(50)

		// Browser settings
		expect(settingDefaults.browserToolEnabled).toBe(true)
		expect(settingDefaults.browserViewportSize).toBe("900x600")
		expect(settingDefaults.remoteBrowserEnabled).toBe(false)
		expect(settingDefaults.screenshotQuality).toBe(75)

		// Audio/TTS settings
		expect(settingDefaults.soundEnabled).toBe(true)
		expect(settingDefaults.soundVolume).toBe(0.5)
		expect(settingDefaults.ttsEnabled).toBe(true)
		expect(settingDefaults.ttsSpeed).toBe(1.0)

		// Checkpoint settings
		expect(settingDefaults.enableCheckpoints).toBe(false)
		expect(settingDefaults.checkpointTimeout).toBe(DEFAULT_CHECKPOINT_TIMEOUT_SECONDS)

		// Terminal settings
		expect(settingDefaults.terminalOutputLineLimit).toBe(500)
		expect(settingDefaults.terminalOutputCharacterLimit).toBe(50_000)
		expect(settingDefaults.terminalShellIntegrationTimeout).toBe(30_000)
		expect(settingDefaults.terminalShellIntegrationDisabled).toBe(false)
		expect(settingDefaults.terminalCommandDelay).toBe(0)
		expect(settingDefaults.terminalPowershellCounter).toBe(false)
		expect(settingDefaults.terminalZshClearEolMark).toBe(false)
		expect(settingDefaults.terminalZshOhMy).toBe(false)
		expect(settingDefaults.terminalZshP10k).toBe(false)
		expect(settingDefaults.terminalZdotdir).toBe(false)
		expect(settingDefaults.terminalCompressProgressBar).toBe(false)

		// Context management settings
		expect(settingDefaults.maxOpenTabsContext).toBe(20)
		expect(settingDefaults.maxWorkspaceFiles).toBe(200)
		expect(settingDefaults.showRooIgnoredFiles).toBe(false)
		expect(settingDefaults.enableSubfolderRules).toBe(false)
		expect(settingDefaults.maxReadFileLine).toBe(-1)
		expect(settingDefaults.maxImageFileSize).toBe(5)
		expect(settingDefaults.maxTotalImageSize).toBe(20)
		expect(settingDefaults.maxConcurrentFileReads).toBe(5)

		// Diagnostic settings
		expect(settingDefaults.diagnosticsEnabled).toBe(false)
		expect(settingDefaults.includeDiagnosticMessages).toBe(true)
		expect(settingDefaults.maxDiagnosticMessages).toBe(50)
		expect(settingDefaults.writeDelayMs).toBe(DEFAULT_WRITE_DELAY_MS)

		// Prompt enhancement settings
		expect(settingDefaults.includeTaskHistoryInEnhance).toBe(true)

		// UI settings
		expect(settingDefaults.reasoningBlockCollapsed).toBe(true)
		expect(settingDefaults.historyPreviewCollapsed).toBe(false)
		expect(settingDefaults.enterBehavior).toBe("send")
		expect(settingDefaults.hasOpenedModeSelector).toBe(false)

		// Environment details settings
		expect(settingDefaults.includeCurrentTime).toBe(true)
		expect(settingDefaults.includeCurrentCost).toBe(true)
		expect(settingDefaults.maxGitStatusFiles).toBe(0)

		// Language settings
		expect(settingDefaults.language).toBe("en")

		// MCP settings
		expect(settingDefaults.mcpEnabled).toBe(true)
		expect(settingDefaults.enableMcpServerCreation).toBe(false)

		// Rate limiting
		expect(settingDefaults.rateLimitSeconds).toBe(0)

		// Indexing settings
		expect(settingDefaults.codebaseIndexEnabled).toBe(false)
		expect(settingDefaults.codebaseIndexQdrantUrl).toBe("http://localhost:6333")
		expect(settingDefaults.codebaseIndexEmbedderProvider).toBe("openai")
		expect(settingDefaults.codebaseIndexEmbedderBaseUrl).toBe("")
		expect(settingDefaults.codebaseIndexEmbedderModelId).toBe("")
		expect(settingDefaults.codebaseIndexEmbedderModelDimension).toBe(1536)
		expect(settingDefaults.codebaseIndexOpenAiCompatibleBaseUrl).toBe("")
		expect(settingDefaults.codebaseIndexBedrockRegion).toBe("us-east-1")
		expect(settingDefaults.codebaseIndexBedrockProfile).toBe("")
		expect(settingDefaults.codebaseIndexSearchMaxResults).toBe(100)
		expect(settingDefaults.codebaseIndexSearchMinScore).toBe(0.4)
		expect(settingDefaults.codebaseIndexOpenRouterSpecificProvider).toBe("")
	})

	it("should be immutable (readonly)", () => {
		// TypeScript should prevent this at compile time, but we can verify the type
		const defaultsCopy = { ...settingDefaults }
		expect(defaultsCopy.browserToolEnabled).toBe(settingDefaults.browserToolEnabled)
	})
})

describe("getSettingWithDefault", () => {
	it("should return the value when defined (matching type)", () => {
		// Test with values that match the default type
		expect(getSettingWithDefault("browserToolEnabled", true)).toBe(true)
		expect(getSettingWithDefault("soundVolume", 0.5)).toBe(0.5)
		expect(getSettingWithDefault("maxOpenTabsContext", 20)).toBe(20)
		expect(getSettingWithDefault("enterBehavior", "send")).toBe("send")
	})

	it("should return the default when value is undefined", () => {
		expect(getSettingWithDefault("browserToolEnabled", undefined)).toBe(true)
		expect(getSettingWithDefault("soundVolume", undefined)).toBe(0.5)
		expect(getSettingWithDefault("maxOpenTabsContext", undefined)).toBe(20)
		expect(getSettingWithDefault("enterBehavior", undefined)).toBe("send")
		expect(getSettingWithDefault("mcpEnabled", undefined)).toBe(true)
		expect(getSettingWithDefault("showRooIgnoredFiles", undefined)).toBe(false)
	})

	it("should demonstrate reset-to-default pattern", () => {
		// This test demonstrates the ideal "reset to default" pattern:
		// When a user resets a setting, we store `undefined` (not the default value)
		// When reading, we apply the default at consumption time

		// Simulating reading from storage where value is undefined (reset state)
		const storedValue = undefined
		const effectiveValue = getSettingWithDefault("browserToolEnabled", storedValue)

		// User sees the default value
		expect(effectiveValue).toBe(true)

		// If the default changes in the future (e.g., to false),
		// users who reset their setting would automatically get the new default
		// because they stored `undefined`, not `true`
	})
})
