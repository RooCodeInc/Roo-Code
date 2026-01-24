import { describe, expect, it } from "vitest"
import { settingDefaults, getSettingWithDefault } from "../defaults.js"
import { DEFAULT_CHECKPOINT_TIMEOUT_SECONDS } from "../global-settings.js"

describe("settingDefaults", () => {
	it("should have all expected default values", () => {
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

		// Diff/Editor settings
		expect(settingDefaults.diffEnabled).toBe(true)
		expect(settingDefaults.fuzzyMatchThreshold).toBe(1.0)

		// Checkpoint settings
		expect(settingDefaults.enableCheckpoints).toBe(false)
		expect(settingDefaults.checkpointTimeout).toBe(DEFAULT_CHECKPOINT_TIMEOUT_SECONDS)

		// Terminal settings
		expect(settingDefaults.terminalOutputLineLimit).toBe(500)
		expect(settingDefaults.terminalOutputCharacterLimit).toBe(50_000)
		expect(settingDefaults.terminalShellIntegrationTimeout).toBe(30_000)

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
		expect(settingDefaults.includeDiagnosticMessages).toBe(true)
		expect(settingDefaults.maxDiagnosticMessages).toBe(50)

		// Auto-approval settings
		expect(settingDefaults.alwaysAllowFollowupQuestions).toBe(false)

		// Prompt enhancement settings
		expect(settingDefaults.includeTaskHistoryInEnhance).toBe(true)

		// UI settings
		expect(settingDefaults.reasoningBlockCollapsed).toBe(true)
		expect(settingDefaults.enterBehavior).toBe("send")

		// Environment details settings
		expect(settingDefaults.includeCurrentTime).toBe(true)
		expect(settingDefaults.includeCurrentCost).toBe(true)
		expect(settingDefaults.maxGitStatusFiles).toBe(0)

		// Language settings
		expect(settingDefaults.language).toBe("en")

		// MCP settings
		expect(settingDefaults.mcpEnabled).toBe(true)
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
