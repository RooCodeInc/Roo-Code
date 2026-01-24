import { runSettingsMigrations, migrations, CURRENT_MIGRATION_VERSION } from "../settingsMigrations"
import type { ContextProxy } from "../../core/config/ContextProxy"
import type { GlobalState } from "@roo-code/types"

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
})
