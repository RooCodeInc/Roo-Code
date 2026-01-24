/**
 * Settings migrations and defaults cleanup.
 *
 * This module provides two mechanisms for managing settings:
 *
 * 1. **Version-gated migrations**: Run once per version to handle specific
 *    migration scenarios (e.g., flattening nested configs).
 *
 * 2. **Every-startup defaults clearing**: Clears settings that exactly match
 *    their current default values on every startup. This ensures users always
 *    benefit from default value improvements.
 *
 * See plans/reset-to-default-ideal-pattern.md for the full design.
 */

import type { ContextProxy } from "../core/config/ContextProxy"
import type { GlobalState, CodebaseIndexConfig } from "@roo-code/types"
import { settingDefaults, type SettingWithDefault } from "@roo-code/types"

import { logger } from "./logging"

/**
 * Migration definition type - supports either historical defaults matching or custom migration logic.
 */
export type MigrationDefinition = {
	description: string
} & (
	| {
			/**
			 * Historical defaults for clearing values that exactly match.
			 * These are the DEFAULT VALUES that were hardcoded in storage BEFORE this migration.
			 * We only clear values that EXACTLY match these historical defaults.
			 */
			historicalDefaults: Partial<GlobalState>
			customMigration?: never
	  }
	| {
			/**
			 * Custom migration function for complex migrations (e.g., nested to flat).
			 */
			customMigration: (contextProxy: ContextProxy) => Promise<void>
			historicalDefaults?: never
	  }
)

/**
 * Migration registry.
 */
export const migrations: Record<number, MigrationDefinition> = {
	1: {
		description: "Remove hardcoded defaults from reset-to-default pattern change (v3.x)",
		historicalDefaults: {
			// These are the defaults that were being written to storage before this fix
			browserToolEnabled: true,
			soundEnabled: true,
			soundVolume: 0.5,
			enableCheckpoints: false,
			checkpointTimeout: 30,
			browserViewportSize: "900x600",
			remoteBrowserEnabled: false,
			screenshotQuality: 75,
			terminalOutputLineLimit: 500,
			terminalOutputCharacterLimit: 50_000,
			terminalShellIntegrationTimeout: 30_000,
			maxOpenTabsContext: 20,
			maxWorkspaceFiles: 200,
			showRooIgnoredFiles: true,
			enableSubfolderRules: false,
			maxReadFileLine: -1,
			maxImageFileSize: 5,
			maxTotalImageSize: 20,
			maxConcurrentFileReads: 5,
			includeDiagnosticMessages: true,
			maxDiagnosticMessages: 50,
			alwaysAllowFollowupQuestions: false,
			includeTaskHistoryInEnhance: true,
			reasoningBlockCollapsed: true,
			enterBehavior: "send",
			includeCurrentTime: true,
			includeCurrentCost: true,
			maxGitStatusFiles: 0,
			language: "en",
			ttsEnabled: true,
			ttsSpeed: 1.0,
			mcpEnabled: true,
		},
	},
	2: {
		description: "Flatten codebaseIndexConfig to top-level keys",
		customMigration: async (contextProxy: ContextProxy) => {
			// Read the nested codebaseIndexConfig object
			const nested = contextProxy.getGlobalState("codebaseIndexConfig") as CodebaseIndexConfig | undefined
			if (!nested) {
				logger.info("  No codebaseIndexConfig found, skipping migration")
				return
			}

			// Copy each nested key to top-level if it has a value
			const keysToMigrate = [
				"codebaseIndexEnabled",
				"codebaseIndexQdrantUrl",
				"codebaseIndexEmbedderProvider",
				"codebaseIndexEmbedderBaseUrl",
				"codebaseIndexEmbedderModelId",
				"codebaseIndexEmbedderModelDimension",
				"codebaseIndexOpenAiCompatibleBaseUrl",
				"codebaseIndexBedrockRegion",
				"codebaseIndexBedrockProfile",
				"codebaseIndexSearchMaxResults",
				"codebaseIndexSearchMinScore",
				"codebaseIndexOpenRouterSpecificProvider",
			] as const

			for (const key of keysToMigrate) {
				const value = nested[key as keyof CodebaseIndexConfig]
				if (value !== undefined) {
					await contextProxy.updateGlobalState(
						key as keyof GlobalState,
						value as GlobalState[keyof GlobalState],
					)
					logger.info(`  Migrated ${key} = ${JSON.stringify(value)}`)
				}
			}

			// Remove the nested object
			await contextProxy.updateGlobalState("codebaseIndexConfig", undefined)
			logger.info("  Removed nested codebaseIndexConfig object")
		},
	},
	3: {
		description: "Remove codebaseIndexModels from globalState (now passed directly to webview)",
		customMigration: async (contextProxy: ContextProxy) => {
			// codebaseIndexModels was previously storing the static EMBEDDING_MODEL_PROFILES
			// object in globalState, but this is unnecessary - it's reference data that
			// should be passed directly to the webview without persisting.
			const stored = contextProxy.getGlobalState("codebaseIndexModels" as keyof GlobalState)
			if (stored !== undefined) {
				await contextProxy.updateGlobalState("codebaseIndexModels" as keyof GlobalState, undefined)
				logger.info("  Removed codebaseIndexModels from globalState")
			} else {
				logger.info("  codebaseIndexModels not found in globalState, skipping")
			}
		},
	},
}

/**
 * The current migration version - the highest version number in the migrations registry.
 */
export const CURRENT_MIGRATION_VERSION = Math.max(...Object.keys(migrations).map(Number))

/**
 * Runs any pending settings migrations.
 *
 * This function checks the stored migration version and runs any migrations
 * that haven't been applied yet. Each migration clears settings that exactly
 * match their historical default values, allowing users to benefit from
 * future default value improvements.
 *
 * @param contextProxy - The ContextProxy instance for reading/writing state
 */
export async function runSettingsMigrations(contextProxy: ContextProxy): Promise<void> {
	const currentVersion = contextProxy.getGlobalState("settingsMigrationVersion") ?? 0

	if (currentVersion >= CURRENT_MIGRATION_VERSION) {
		return // Already up to date
	}

	for (let version = currentVersion + 1; version <= CURRENT_MIGRATION_VERSION; version++) {
		const migration = migrations[version]
		if (!migration) continue

		logger.info(`Running settings migration v${version}: ${migration.description}`)

		// Handle custom migration function
		if ("customMigration" in migration && migration.customMigration) {
			await migration.customMigration(contextProxy)
		}
		// Handle historical defaults migration
		else if ("historicalDefaults" in migration && migration.historicalDefaults) {
			for (const [key, historicalDefault] of Object.entries(migration.historicalDefaults)) {
				const storedValue = contextProxy.getGlobalState(key as keyof GlobalState)

				// Only clear if the stored value EXACTLY matches the historical default
				// This ensures we don't accidentally clear intentional user customizations
				if (storedValue === historicalDefault) {
					await contextProxy.updateGlobalState(key as keyof GlobalState, undefined)
					logger.info(`  Cleared ${key} (was ${JSON.stringify(storedValue)})`)
				}
			}
		}
	}

	// Mark migration complete
	await contextProxy.updateGlobalState("settingsMigrationVersion", CURRENT_MIGRATION_VERSION)
	logger.info(`Settings migration complete. Now at version ${CURRENT_MIGRATION_VERSION}`)
}

/**
 * Clears settings that exactly match their current default values.
 *
 * This function runs on every startup to ensure users always benefit from
 * default value improvements. When a setting's stored value exactly matches
 * the current default, it's cleared (set to undefined) so the default is
 * applied at read time.
 *
 * Note: This approach means users cannot "lock in" a value that happens to
 * match the default. If they explicitly set browserToolEnabled=true (the default),
 * it will be cleared and they'll use whatever the default is in the future.
 *
 * @param contextProxy - The ContextProxy instance for reading/writing state
 * @returns The number of settings that were cleared
 */
export async function clearDefaultSettings(contextProxy: ContextProxy): Promise<number> {
	let clearedCount = 0

	for (const key of Object.keys(settingDefaults) as SettingWithDefault[]) {
		const storedValue = contextProxy.getGlobalState(key as keyof GlobalState)
		const defaultValue = settingDefaults[key]

		// Only clear if stored value exactly matches the current default
		// undefined values are already "default" so skip them
		if (storedValue !== undefined && storedValue === defaultValue) {
			await contextProxy.updateGlobalState(key as keyof GlobalState, undefined)
			logger.info(`Cleared default setting: ${key} (was ${JSON.stringify(storedValue)})`)
			clearedCount++
		}
	}

	if (clearedCount > 0) {
		logger.info(`Cleared ${clearedCount} settings that matched their defaults`)
	}

	return clearedCount
}

/**
 * Runs all startup settings maintenance tasks.
 *
 * This is the main entry point that should be called on extension startup.
 * It runs both migrations (once per version) and defaults clearing (every startup).
 *
 * @param contextProxy - The ContextProxy instance for reading/writing state
 */
export async function runStartupSettingsMaintenance(contextProxy: ContextProxy): Promise<void> {
	// First run any pending migrations
	await runSettingsMigrations(contextProxy)

	// Then clear any settings that match current defaults
	await clearDefaultSettings(contextProxy)
}
