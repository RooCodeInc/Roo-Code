import {
	runSettingsMigrations,
	migrations,
	CURRENT_MIGRATION_VERSION,
	clearDefaultSettings,
	runStartupSettingsMaintenance,
} from "../settingsMigrations"
import type { ContextProxy } from "../../core/config/ContextProxy"
import type { GlobalState } from "@roo-code/types"
import { settingDefaults } from "@roo-code/types"

// Mock the logger
vi.mock("../logging", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

describe("settingsMigrations", () => {
	let mockContextProxy: {
		getGlobalState: ReturnType<typeof vi.fn>
		updateGlobalState: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		vi.clearAllMocks()

		mockContextProxy = {
			getGlobalState: vi.fn(),
			updateGlobalState: vi.fn().mockResolvedValue(undefined),
		}
	})

	describe("runSettingsMigrations", () => {
		it("should clear values matching historical defaults", async () => {
			// Setup: user has hardcoded default from old version
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 0
				if (key === "browserToolEnabled") return true // matches historical default
				if (key === "soundEnabled") return true // matches historical default
				if (key === "maxWorkspaceFiles") return 200 // matches historical default
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// browserToolEnabled should be cleared (matched historical default)
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("browserToolEnabled", undefined)

			// soundEnabled should be cleared (matched historical default)
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("soundEnabled", undefined)

			// maxWorkspaceFiles should be cleared (matched historical default)
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("maxWorkspaceFiles", undefined)

			// Migration version should be updated
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith(
				"settingsMigrationVersion",
				CURRENT_MIGRATION_VERSION,
			)
		})

		it("should preserve custom values that don't match defaults", async () => {
			// Setup: user has custom values that don't match historical defaults
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 0
				if (key === "browserToolEnabled") return false // user customized to false
				if (key === "maxWorkspaceFiles") return 300 // user customized to 300
				if (key === "soundVolume") return 0.8 // user customized to 0.8
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// browserToolEnabled should NOT be cleared (user had custom value false != true)
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalledWith("browserToolEnabled", undefined)

			// maxWorkspaceFiles should NOT be cleared (user had custom value 300 != 200)
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalledWith("maxWorkspaceFiles", undefined)

			// soundVolume should NOT be cleared (user had custom value 0.8 != 0.5)
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalledWith("soundVolume", undefined)

			// Migration version should still be updated
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith(
				"settingsMigrationVersion",
				CURRENT_MIGRATION_VERSION,
			)
		})

		it("should skip already-completed migrations", async () => {
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return CURRENT_MIGRATION_VERSION
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// No state updates should occur (already migrated)
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalled()
		})

		it("should handle missing/undefined migration version as version 0", async () => {
			// Setup: no migration version set (undefined)
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return undefined
				if (key === "browserToolEnabled") return true // matches historical default
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// browserToolEnabled should be cleared
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("browserToolEnabled", undefined)

			// Migration version should be updated
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith(
				"settingsMigrationVersion",
				CURRENT_MIGRATION_VERSION,
			)
		})

		it("should only clear settings that exist in migration historicalDefaults", async () => {
			// Setup: user has various settings, but only some are in the migration
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 0
				if (key === "customInstructions") return "my custom instructions" // not in migration
				if (key === "browserToolEnabled") return true // in migration, matches default
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// customInstructions should NOT be touched (not in migration historicalDefaults)
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalledWith("customInstructions", undefined)

			// browserToolEnabled should be cleared
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("browserToolEnabled", undefined)
		})

		it("should handle string settings correctly (enterBehavior)", async () => {
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 0
				if (key === "enterBehavior") return "send" // matches historical default
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// enterBehavior should be cleared (matched historical default of "send")
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("enterBehavior", undefined)
		})

		it("should not clear enterBehavior if user has a custom value", async () => {
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 0
				if (key === "enterBehavior") return "newline" // user customized
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// enterBehavior should NOT be cleared
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalledWith("enterBehavior", undefined)
		})

		it("should run migrations in order from currentVersion+1 to CURRENT_MIGRATION_VERSION", async () => {
			// If user is at version 0 and we have version 1, it should run version 1
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 0
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// Should end up at CURRENT_MIGRATION_VERSION
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith(
				"settingsMigrationVersion",
				CURRENT_MIGRATION_VERSION,
			)
		})
	})

	describe("migrations registry", () => {
		it("should have migration version 1 defined", () => {
			expect(migrations[1]).toBeDefined()
			expect(migrations[1].description).toContain("hardcoded defaults")
		})

		it("should have expected historical defaults in version 1", () => {
			const v1 = migrations[1]
			expect("historicalDefaults" in v1).toBe(true)
			const v1Defaults = (v1 as { historicalDefaults: Partial<GlobalState> }).historicalDefaults

			// Check a sample of expected defaults
			expect(v1Defaults.browserToolEnabled).toBe(true)
			expect(v1Defaults.soundEnabled).toBe(true)
			expect(v1Defaults.soundVolume).toBe(0.5)
			expect(v1Defaults.enableCheckpoints).toBe(false)
			expect(v1Defaults.checkpointTimeout).toBe(30)
			expect(v1Defaults.browserViewportSize).toBe("900x600")
			expect(v1Defaults.maxWorkspaceFiles).toBe(200)
			expect(v1Defaults.language).toBe("en")
			expect(v1Defaults.mcpEnabled).toBe(true)
			expect(v1Defaults.enterBehavior).toBe("send")
		})

		it("should have migration version 2 defined with customMigration", () => {
			expect(migrations[2]).toBeDefined()
			expect(migrations[2].description).toContain("Flatten codebaseIndexConfig")
			expect("customMigration" in migrations[2]).toBe(true)
		})

		it("should have migration version 3 defined with customMigration", () => {
			expect(migrations[3]).toBeDefined()
			expect(migrations[3].description).toContain("codebaseIndexModels")
			expect("customMigration" in migrations[3]).toBe(true)
		})

		it("CURRENT_MIGRATION_VERSION should be the max key in migrations", () => {
			const maxVersion = Math.max(...Object.keys(migrations).map(Number))
			expect(CURRENT_MIGRATION_VERSION).toBe(maxVersion)
		})
	})

	describe("migration v2 - flatten codebaseIndexConfig", () => {
		it("should migrate nested codebaseIndexConfig to flat keys", async () => {
			const nestedConfig = {
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://custom:6333",
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexSearchMaxResults: 50,
				codebaseIndexSearchMinScore: 0.6,
			}

			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 1 // Already completed v1
				if (key === "codebaseIndexConfig") return nestedConfig
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// Should have copied each nested key to top-level
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("codebaseIndexEnabled", true)
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith(
				"codebaseIndexQdrantUrl",
				"http://custom:6333",
			)
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("codebaseIndexEmbedderProvider", "openai")
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("codebaseIndexSearchMaxResults", 50)
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("codebaseIndexSearchMinScore", 0.6)

			// Should have removed the nested object
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("codebaseIndexConfig", undefined)

			// Migration version should be updated
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith(
				"settingsMigrationVersion",
				CURRENT_MIGRATION_VERSION,
			)
		})

		it("should skip migration if no codebaseIndexConfig exists", async () => {
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 1 // Already completed v1
				if (key === "codebaseIndexConfig") return undefined
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// Should NOT have called updateGlobalState for any indexing keys
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalledWith(
				"codebaseIndexEnabled",
				expect.anything(),
			)

			// Should still update migration version
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith(
				"settingsMigrationVersion",
				CURRENT_MIGRATION_VERSION,
			)
		})

		it("should only migrate keys that have values", async () => {
			const nestedConfig = {
				codebaseIndexEnabled: false, // has a value
				codebaseIndexQdrantUrl: undefined, // undefined, should not migrate
			}

			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 1
				if (key === "codebaseIndexConfig") return nestedConfig
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// Should migrate keys with values
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("codebaseIndexEnabled", false)

			// Should NOT migrate undefined keys
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalledWith("codebaseIndexQdrantUrl", undefined)

			// Should still remove the nested object
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("codebaseIndexConfig", undefined)
		})
	})

	describe("migration v3 - remove codebaseIndexModels from globalState", () => {
		it("should remove codebaseIndexModels if it exists", async () => {
			const mockModels = { openai: { model: "text-embedding-3-small" } }

			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 2 // Already completed v1 and v2
				if (key === "codebaseIndexModels") return mockModels
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// Should have removed codebaseIndexModels
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("codebaseIndexModels", undefined)

			// Migration version should be updated
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith(
				"settingsMigrationVersion",
				CURRENT_MIGRATION_VERSION,
			)
		})

		it("should skip migration if codebaseIndexModels does not exist", async () => {
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 2 // Already completed v1 and v2
				if (key === "codebaseIndexModels") return undefined
				return undefined
			})

			await runSettingsMigrations(mockContextProxy as unknown as ContextProxy)

			// Should NOT have called updateGlobalState for codebaseIndexModels
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalledWith("codebaseIndexModels", undefined)

			// Should still update migration version
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith(
				"settingsMigrationVersion",
				CURRENT_MIGRATION_VERSION,
			)
		})
	})

	describe("clearDefaultSettings", () => {
		it("should clear settings that match current defaults", async () => {
			// Setup: user has settings that match current defaults
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "browserToolEnabled") return settingDefaults.browserToolEnabled
				if (key === "soundVolume") return settingDefaults.soundVolume
				if (key === "maxWorkspaceFiles") return settingDefaults.maxWorkspaceFiles
				return undefined
			})

			const clearedCount = await clearDefaultSettings(mockContextProxy as unknown as ContextProxy)

			// All matching defaults should be cleared
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("browserToolEnabled", undefined)
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("soundVolume", undefined)
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("maxWorkspaceFiles", undefined)
			expect(clearedCount).toBe(3)
		})

		it("should preserve custom values that don't match defaults", async () => {
			// Setup: user has custom values that don't match defaults
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "browserToolEnabled") return false // default is true
				if (key === "soundVolume") return 0.8 // default is 0.5
				if (key === "maxWorkspaceFiles") return 500 // default is 200
				return undefined
			})

			const clearedCount = await clearDefaultSettings(mockContextProxy as unknown as ContextProxy)

			// No settings should be cleared
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalled()
			expect(clearedCount).toBe(0)
		})

		it("should not clear already undefined values", async () => {
			// Setup: all settings are undefined
			mockContextProxy.getGlobalState.mockReturnValue(undefined)

			const clearedCount = await clearDefaultSettings(mockContextProxy as unknown as ContextProxy)

			// No settings should be cleared (already undefined)
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalled()
			expect(clearedCount).toBe(0)
		})

		it("should only clear settings in settingDefaults", async () => {
			// Setup: user has settings - some in defaults, some not
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "browserToolEnabled") return settingDefaults.browserToolEnabled
				if (key === "customInstructions") return "my instructions" // not in settingDefaults
				return undefined
			})

			await clearDefaultSettings(mockContextProxy as unknown as ContextProxy)

			// browserToolEnabled should be cleared
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("browserToolEnabled", undefined)

			// customInstructions should NOT be touched (not in settingDefaults)
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalledWith("customInstructions", undefined)
		})

		it("should handle string settings correctly", async () => {
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "enterBehavior") return "send" // matches default
				if (key === "language") return "en" // matches default
				return undefined
			})

			await clearDefaultSettings(mockContextProxy as unknown as ContextProxy)

			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("enterBehavior", undefined)
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("language", undefined)
		})

		it("should return the count of cleared settings", async () => {
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "browserToolEnabled") return true // matches default
				if (key === "soundEnabled") return true // matches default
				if (key === "soundVolume") return 0.8 // does NOT match default (0.5)
				return undefined
			})

			const clearedCount = await clearDefaultSettings(mockContextProxy as unknown as ContextProxy)

			expect(clearedCount).toBe(2) // Only browserToolEnabled and soundEnabled match
		})
	})

	describe("runStartupSettingsMaintenance", () => {
		it("should run both migrations and default clearing", async () => {
			// Setup: migration not run, and has a setting matching default
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return 0
				if (key === "browserToolEnabled") return true // matches both historical and current default
				return undefined
			})

			await runStartupSettingsMaintenance(mockContextProxy as unknown as ContextProxy)

			// Should have updated migration version
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith(
				"settingsMigrationVersion",
				CURRENT_MIGRATION_VERSION,
			)

			// browserToolEnabled should be cleared (by migration or clearDefaults)
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("browserToolEnabled", undefined)
		})

		it("should run clearDefaultSettings even after migrations are complete", async () => {
			// Setup: migrations already complete, but has setting matching default
			mockContextProxy.getGlobalState.mockImplementation((key: keyof GlobalState) => {
				if (key === "settingsMigrationVersion") return CURRENT_MIGRATION_VERSION
				if (key === "soundVolume") return 0.5 // matches current default
				return undefined
			})

			await runStartupSettingsMaintenance(mockContextProxy as unknown as ContextProxy)

			// Migration version should NOT be updated (already current)
			expect(mockContextProxy.updateGlobalState).not.toHaveBeenCalledWith(
				"settingsMigrationVersion",
				expect.anything(),
			)

			// soundVolume should be cleared by clearDefaultSettings
			expect(mockContextProxy.updateGlobalState).toHaveBeenCalledWith("soundVolume", undefined)
		})
	})
})
