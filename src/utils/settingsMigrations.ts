/**
 * Settings migrations for version-gated migration of hardcoded defaults.
 *
 * This module tracks which migrations have been applied and runs any pending
 * migrations when the extension starts. Each migration targets specific
 * historical default values that were being hardcoded in storage before
 * the "reset to default" pattern fix.
 *
 * See plans/reset-to-default-ideal-pattern.md for the full design.
 */

import type { ContextProxy } from "../core/config/ContextProxy"
import type { GlobalState, CodebaseIndexConfig } from "@roo-code/types"

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
