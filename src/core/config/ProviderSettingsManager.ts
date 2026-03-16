import { ExtensionContext } from "vscode"
import { z, ZodError } from "zod"
import deepEqual from "fast-deep-equal"

import {
	type ProviderSettingsWithId,
	providerSettingsWithIdSchema,
	discriminatedProviderSettingsWithIdSchema,
	isSecretStateKey,
	ProviderSettingsEntry,
	DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
} from "@siid-code/types"
import { TelemetryService } from "@siid-code/telemetry"

import { Mode, modes } from "../../shared/modes"
import { logger } from "../../utils/logging"

export interface SyncCloudProfilesResult {
	hasChanges: boolean
	activeProfileChanged: boolean
	activeProfileId: string
}

export const providerProfilesSchema = z.object({
	currentApiConfigName: z.string(),
	apiConfigs: z.record(z.string(), providerSettingsWithIdSchema),
	cloudProfileIds: z.array(z.string()).optional(),
	migrations: z
		.object({
			rateLimitSecondsMigrated: z.boolean().optional(),
			diffSettingsMigrated: z.boolean().optional(),
			openAiHeadersMigrated: z.boolean().optional(),
			consecutiveMistakeLimitMigrated: z.boolean().optional(),
			todoListEnabledMigrated: z.boolean().optional(),
			useFreeModelsMigrated: z.boolean().optional(),
			twoConfigStructureMigrated: z.boolean().optional(),
		})
		.optional(),
})

export type ProviderProfiles = z.infer<typeof providerProfilesSchema>

export class ProviderSettingsManager {
	private static readonly SCOPE_PREFIX = "roo_cline_config_"
	private readonly defaultConfigId = "default-config-id"
	private readonly paidApiConfigId = "paid-config-id"

	private readonly defaultProviderProfiles: ProviderProfiles = {
		currentApiConfigName: "default",
		apiConfigs: {
			default: {
				id: this.defaultConfigId,
				apiProvider: "openrouter",
				openRouterModelId: "z-ai/glm-4.5-air:free",
				// openRouterApiKey will be set from Firebase
				rateLimitSeconds: 0,
				diffEnabled: true,
				fuzzyMatchThreshold: 1.0,
				consecutiveMistakeLimit: 3,
				todoListEnabled: true,
			},
			paidApiConfig: {
				id: this.paidApiConfigId,
				apiProvider: "openrouter",
				openRouterModelId: "z-ai/glm-4.6",
				// openRouterApiKey will be set from Firebase
				rateLimitSeconds: 0,
				diffEnabled: true,
				fuzzyMatchThreshold: 1.0,
				consecutiveMistakeLimit: 3,
				todoListEnabled: true,
			},
		},
		migrations: {
			rateLimitSecondsMigrated: true, // Mark as migrated on fresh installs
			diffSettingsMigrated: true, // Mark as migrated on fresh installs
			openAiHeadersMigrated: true, // Mark as migrated on fresh installs
			consecutiveMistakeLimitMigrated: true, // Mark as migrated on fresh installs
			todoListEnabledMigrated: true, // Mark as migrated on fresh installs
			useFreeModelsMigrated: true, // Mark as migrated on fresh installs
		},
	}

	private readonly context: ExtensionContext

	constructor(context: ExtensionContext) {
		this.context = context

		// TODO: We really shouldn't have async methods in the constructor.
		this.initialize().catch(console.error)
	}

	public generateId() {
		return Math.random().toString(36).substring(2, 15)
	}

	// Synchronize readConfig/writeConfig operations to avoid data loss.
	private _lock = Promise.resolve()
	private lock<T>(cb: () => Promise<T>) {
		const next = this._lock.then(cb)
		this._lock = next.catch(() => {}) as Promise<void>
		return next
	}

	/**
	 * Initialize config if it doesn't exist and run migrations.
	 */
	public async initialize() {
		try {
			return await this.lock(async () => {
				logger.info(`[ProviderSettingsManager.initialize] Starting initialization...`)

				// Check if configs exist in storage before loading
				const content = await this.context.secrets.get(this.secretsKey)
				const isFirstTime = !content

				if (isFirstTime) {
					console.log("[ProviderSettingsManager.initialize] First-time setup detected (no saved configs)")
					logger.info(`[ProviderSettingsManager.initialize] First-time setup detected (no saved configs)`)
				}

				const providerProfiles = await this.load()

				console.log(
					`[ProviderSettingsManager.initialize] Loaded providerProfiles, currentApiConfigName='${providerProfiles.currentApiConfigName}', configs=${Object.keys(providerProfiles.apiConfigs).join(", ")}`,
				)
				logger.info(
					`[ProviderSettingsManager.initialize] Loaded providerProfiles, currentApiConfigName='${providerProfiles.currentApiConfigName}', configs=${Object.keys(providerProfiles.apiConfigs).join(", ")}`,
				)

				// Log API configuration details on first-time setup
				if (isFirstTime) {
					for (const [name, config] of Object.entries(providerProfiles.apiConfigs)) {
						console.log(`[ProviderSettingsManager.initialize] First-time config '${name}':`, {
							id: config.id,
							apiProvider: config.apiProvider,
							openRouterModelId: config.openRouterModelId,
							apiModelId: config.apiModelId,
							openRouterApiKey: config.openRouterApiKey ? "[SET]" : "[NOT SET]",
						})
					}
				}

				let isDirty = isFirstTime // Mark as dirty if first time to ensure defaults are stored

				// Ensure all configs have IDs.
				for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
					if (!apiConfig.id) {
						apiConfig.id = this.generateId()
						isDirty = true
					}
				}

				// Ensure migrations field exists
				if (!providerProfiles.migrations) {
					providerProfiles.migrations = {
						rateLimitSecondsMigrated: false,
						diffSettingsMigrated: false,
						openAiHeadersMigrated: false,
						consecutiveMistakeLimitMigrated: false,
						todoListEnabledMigrated: false,
					} // Initialize with default values
					isDirty = true
				}

				if (!providerProfiles.migrations.rateLimitSecondsMigrated) {
					await this.migrateRateLimitSeconds(providerProfiles)
					providerProfiles.migrations.rateLimitSecondsMigrated = true
					isDirty = true
				}

				if (!providerProfiles.migrations.diffSettingsMigrated) {
					await this.migrateDiffSettings(providerProfiles)
					providerProfiles.migrations.diffSettingsMigrated = true
					isDirty = true
				}

				if (!providerProfiles.migrations.openAiHeadersMigrated) {
					await this.migrateOpenAiHeaders(providerProfiles)
					providerProfiles.migrations.openAiHeadersMigrated = true
					isDirty = true
				}

				if (!providerProfiles.migrations.consecutiveMistakeLimitMigrated) {
					await this.migrateConsecutiveMistakeLimit(providerProfiles)
					providerProfiles.migrations.consecutiveMistakeLimitMigrated = true
					isDirty = true
				}

				if (!providerProfiles.migrations.todoListEnabledMigrated) {
					await this.migrateTodoListEnabled(providerProfiles)
					providerProfiles.migrations.todoListEnabledMigrated = true
					isDirty = true
				}

				if (!providerProfiles.migrations.useFreeModelsMigrated) {
					await this.migrateUseFreeModels(providerProfiles)
					providerProfiles.migrations.useFreeModelsMigrated = true
					isDirty = true
				}

				// Migrate to 2-config structure with fixed IDs
				if (!providerProfiles.migrations.twoConfigStructureMigrated) {
					console.log("[ProviderSettingsManager.initialize] Running 2-config structure migration...")
					logger.info("[ProviderSettingsManager.initialize] Running 2-config structure migration...")
					await this.migrateTo2ConfigStructure(providerProfiles)
					providerProfiles.migrations.twoConfigStructureMigrated = true
					isDirty = true
					console.log("[ProviderSettingsManager.initialize] 2-config migration completed")
					logger.info("[ProviderSettingsManager.initialize] 2-config migration completed")
				} else {
					console.log("[ProviderSettingsManager.initialize] 2-config migration already completed, skipping")
				}

				if (isDirty) {
					await this.store(providerProfiles)
				}

				// Fetch and update API keys from Firebase
				await this.updateApiKeysFromFirebase()
			})
		} catch (error) {
			throw new Error(`Failed to initialize config: ${error}`)
		}
	}

	/**
	 * Fetch API keys from Firebase for free and paid tiers.
	 * Retrieves user API key from users/{uid} document (openRouterApiKey field).
	 *
	 * Structure: One API key per user (used for both free and paid tier configs)
	 */
	private async fetchApiKeysFromFirebase(): Promise<{
		freeApiKey: string | undefined // Single API key for free tier
		paidApiKey: string | undefined // Single API key for paid tier
	}> {
		try {
			logger.info("[ProviderSettingsManager] Fetching API keys from Firebase...")

			// Check for dev bypass API key first (for development/testing)
			const devBypassKey = this.context.globalState.get<string>("devBypassApiKey")
			if (devBypassKey) {
				logger.info("[ProviderSettingsManager] Using dev bypass API key")
				return {
					freeApiKey: devBypassKey,
					paidApiKey: devBypassKey,
				}
			}

			// Get the Firebase API to check authentication
			const { isAuthenticated, getUserProperties } = await import("../../utils/firebaseHelper")

			// Check if user is authenticated
			const authenticated = await isAuthenticated()
			if (!authenticated) {
				logger.warn("[ProviderSettingsManager] User not authenticated, skipping API key fetch")
				return {
					freeApiKey: undefined,
					paidApiKey: undefined,
				}
			}

			// Get user API key from user properties (users/{uid}/openRouterApiKey)
			const userProps = await getUserProperties(["openRouterApiKey"])
			const userApiKey = userProps?.openRouterApiKey

			if (!userApiKey) {
				logger.warn("[ProviderSettingsManager] No OpenRouter API key found in user properties")
				return {
					freeApiKey: undefined,
					paidApiKey: undefined,
				}
			}

			logger.info("[ProviderSettingsManager] Successfully fetched user API key from Firebase", {
				hasKey: !!userApiKey,
			})

			// Use the same key for both free and paid tiers
			// The free tier models are rate-limited by OpenRouter's :free suffix
			// The paid tier uses the same key but accesses non-free models
			return {
				freeApiKey: userApiKey,
				paidApiKey: userApiKey,
			}
		} catch (error) {
			logger.error(`[ProviderSettingsManager] Failed to fetch API keys from Firebase: ${error}`)
			return {
				freeApiKey: undefined,
				paidApiKey: undefined,
			}
		}
	}

	/**
	 * Update API configs with Firebase API keys.
	 * Free configs get the free tier key, paid configs get the paid tier key.
	 * Call this method when toggling useFreeModels or during initialization.
	 */
	public async updateApiKeysFromFirebase() {
		try {
			console.log("[ProviderSettingsManager.updateApiKeysFromFirebase] Fetching API keys from Firebase...")
			logger.info(`[ProviderSettingsManager.updateApiKeysFromFirebase] Fetching API keys...`)
			const { freeApiKey, paidApiKey } = await this.fetchApiKeysFromFirebase()
			console.log(
				`[ProviderSettingsManager.updateApiKeysFromFirebase] Got keys - freeApiKey=${!!freeApiKey}, paidApiKey=${!!paidApiKey}`,
			)
			logger.info(
				`[ProviderSettingsManager.updateApiKeysFromFirebase] Got keys - freeApiKey=${!!freeApiKey}, paidApiKey=${!!paidApiKey}`,
			)

			const providerProfiles = await this.load()
			if (!providerProfiles) {
				logger.warn("[ProviderSettingsManager.updateApiKeysFromFirebase] No provider profiles found")
				return
			}

			logger.info(
				`[ProviderSettingsManager.updateApiKeysFromFirebase] Looking for configs - defaultConfigId='${this.defaultConfigId}', paidApiConfigId='${this.paidApiConfigId}'`,
			)
			logger.info(
				`[ProviderSettingsManager.updateApiKeysFromFirebase] Available configs: ${Object.entries(
					providerProfiles.apiConfigs,
				)
					.map(([name, cfg]) => `${name}(id=${cfg.id})`)
					.join(", ")}`,
			)

			let isDirty = false

			// Update default config with API key (uses free models)
			// Fall back to profile name for robustness with pre-migration/legacy IDs.
			const defaultConfig =
				Object.values(providerProfiles.apiConfigs).find((config) => config.id === this.defaultConfigId) ??
				providerProfiles.apiConfigs["default"]
			logger.info(`[ProviderSettingsManager.updateApiKeysFromFirebase] Found default config: ${!!defaultConfig}`)
			if (defaultConfig && (freeApiKey || paidApiKey)) {
				const apiKey = freeApiKey || paidApiKey
				defaultConfig.openRouterApiKey = apiKey
				// Show first 4 and last 4 characters for verification
				const maskedKey = apiKey
					? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
					: "[NOT SET]"
				console.log(`[ProviderSettingsManager.updateApiKeysFromFirebase] ✓ Updated 'default' config:`, {
					id: defaultConfig.id,
					apiProvider: defaultConfig.apiProvider,
					openRouterModelId: defaultConfig.openRouterModelId,
					openRouterApiKey: maskedKey,
					fullKeyLength: apiKey?.length || 0,
				})
				logger.info(`[ProviderSettingsManager.updateApiKeysFromFirebase] Updated default config with API key`)
				isDirty = true
			}

			// Update paidApiConfig with API key (uses paid models)
			// Fall back to profile name for robustness with pre-migration/legacy IDs.
			const paidConfig =
				Object.values(providerProfiles.apiConfigs).find((config) => config.id === this.paidApiConfigId) ??
				providerProfiles.apiConfigs["paidApiConfig"]
			logger.info(`[ProviderSettingsManager.updateApiKeysFromFirebase] Found paidApiConfig: ${!!paidConfig}`)
			if (paidConfig && paidApiKey) {
				paidConfig.openRouterApiKey = paidApiKey
				// Show first 4 and last 4 characters for verification
				const maskedKey = paidApiKey
					? `${paidApiKey.substring(0, 4)}...${paidApiKey.substring(paidApiKey.length - 4)}`
					: "[NOT SET]"
				console.log(`[ProviderSettingsManager.updateApiKeysFromFirebase] ✓ Updated 'paidApiConfig':`, {
					id: paidConfig.id,
					apiProvider: paidConfig.apiProvider,
					openRouterModelId: paidConfig.openRouterModelId,
					openRouterApiKey: maskedKey,
					fullKeyLength: paidApiKey?.length || 0,
				})
				logger.info(`[ProviderSettingsManager.updateApiKeysFromFirebase] Updated paidApiConfig with API key`)
				isDirty = true
			}

			if (isDirty) {
				logger.info(
					`[ProviderSettingsManager.updateApiKeysFromFirebase] Changes detected, storing updated profiles`,
				)
				await this.store(providerProfiles)
				console.log(
					"[ProviderSettingsManager.updateApiKeysFromFirebase] ✓ Successfully stored configs with API keys",
				)
				logger.info(
					"[ProviderSettingsManager.updateApiKeysFromFirebase] Successfully updated and stored API configs with Firebase keys",
				)
			} else if (!freeApiKey && !paidApiKey) {
				console.log(
					"[ProviderSettingsManager.updateApiKeysFromFirebase] ⚠ No API keys fetched from Firebase (user not authenticated or no key set)",
				)
				logger.info(
					"[ProviderSettingsManager.updateApiKeysFromFirebase] No API keys fetched from Firebase (using placeholders)",
				)
			} else {
				logger.info(
					"[ProviderSettingsManager.updateApiKeysFromFirebase] No changes needed, configs already have keys",
				)
			}
		} catch (error) {
			console.error(`[ProviderSettingsManager.updateApiKeysFromFirebase] ✗ Failed to update API keys:`, error)
			logger.error(`[ProviderSettingsManager.updateApiKeysFromFirebase] Failed to update API keys: ${error}`)
		}
	}

	private async migrateRateLimitSeconds(providerProfiles: ProviderProfiles) {
		try {
			let rateLimitSeconds: number | undefined

			try {
				rateLimitSeconds = await this.context.globalState.get<number>("rateLimitSeconds")
			} catch (error) {
				console.error("[MigrateRateLimitSeconds] Error getting global rate limit:", error)
			}

			if (rateLimitSeconds === undefined) {
				// Failed to get the existing value, use the default.
				rateLimitSeconds = 0
			}

			for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
				if (apiConfig.rateLimitSeconds === undefined) {
					apiConfig.rateLimitSeconds = rateLimitSeconds
				}
			}
		} catch (error) {
			console.error(`[MigrateRateLimitSeconds] Failed to migrate rate limit settings:`, error)
		}
	}

	private async migrateDiffSettings(providerProfiles: ProviderProfiles) {
		try {
			let diffEnabled: boolean | undefined
			let fuzzyMatchThreshold: number | undefined

			try {
				diffEnabled = await this.context.globalState.get<boolean>("diffEnabled")
				fuzzyMatchThreshold = await this.context.globalState.get<number>("fuzzyMatchThreshold")
			} catch (error) {
				console.error("[MigrateDiffSettings] Error getting global diff settings:", error)
			}

			if (diffEnabled === undefined) {
				// Failed to get the existing value, use the default.
				diffEnabled = true
			}

			if (fuzzyMatchThreshold === undefined) {
				// Failed to get the existing value, use the default.
				fuzzyMatchThreshold = 1.0
			}

			for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
				if (apiConfig.diffEnabled === undefined) {
					apiConfig.diffEnabled = diffEnabled
				}
				if (apiConfig.fuzzyMatchThreshold === undefined) {
					apiConfig.fuzzyMatchThreshold = fuzzyMatchThreshold
				}
			}
		} catch (error) {
			console.error(`[MigrateDiffSettings] Failed to migrate diff settings:`, error)
		}
	}

	private async migrateOpenAiHeaders(providerProfiles: ProviderProfiles) {
		try {
			for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
				// Use type assertion to access the deprecated property safely
				const configAny = apiConfig as any

				// Check if openAiHostHeader exists but openAiHeaders doesn't
				if (
					configAny.openAiHostHeader &&
					(!apiConfig.openAiHeaders || Object.keys(apiConfig.openAiHeaders || {}).length === 0)
				) {
					// Create the headers object with the Host value
					apiConfig.openAiHeaders = { Host: configAny.openAiHostHeader }

					// Delete the old property to prevent re-migration
					// This prevents the header from reappearing after deletion
					configAny.openAiHostHeader = undefined
				}
			}
		} catch (error) {
			console.error(`[MigrateOpenAiHeaders] Failed to migrate OpenAI headers:`, error)
		}
	}

	private async migrateConsecutiveMistakeLimit(providerProfiles: ProviderProfiles) {
		try {
			for (const [name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
				if (apiConfig.consecutiveMistakeLimit == null) {
					apiConfig.consecutiveMistakeLimit = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
				}
			}
		} catch (error) {
			console.error(`[MigrateConsecutiveMistakeLimit] Failed to migrate consecutive mistake limit:`, error)
		}
	}

	private async migrateTodoListEnabled(providerProfiles: ProviderProfiles) {
		try {
			for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
				if (apiConfig.todoListEnabled === undefined) {
					apiConfig.todoListEnabled = true
				}
			}
		} catch (error) {
			console.error(`[MigrateTodoListEnabled] Failed to migrate todo list enabled setting:`, error)
		}
	}

	private async migrateUseFreeModels(providerProfiles: ProviderProfiles) {
		try {
			// Check if user has existing configs (indicating existing user)
			const hasExistingConfigs = Object.keys(providerProfiles.apiConfigs).length > 1 // More than just 'default'

			// Get current global setting
			let useFreeModels: boolean | undefined
			try {
				useFreeModels = await this.context.globalState.get<boolean>("useFreeModels")
			} catch (error) {
				console.error("[MigrateUseFreeModels] Error getting global useFreeModels setting:", error)
			}

			// Only set default if not already set
			if (useFreeModels === undefined) {
				// Existing users: keep paid models (false)
				// New users: default to free models (true)
				useFreeModels = !hasExistingConfigs
				await this.context.globalState.update("useFreeModels", useFreeModels)
				logger.info(
					`[MigrateUseFreeModels] Set useFreeModels=${useFreeModels} for ${hasExistingConfigs ? "existing" : "new"} user`,
				)
			}
		} catch (error) {
			console.error(`[MigrateUseFreeModels] Failed to migrate useFreeModels setting:`, error)
		}
	}

	private async migrateTo2ConfigStructure(providerProfiles: ProviderProfiles) {
		try {
			logger.info("[Migrate2Config] Checking if migration to 2-config structure is needed...")

			// Check if we already have the correct structure
			const hasDefaultWithCorrectId = providerProfiles.apiConfigs["default"]?.id === this.defaultConfigId
			const hasPaidWithCorrectId = providerProfiles.apiConfigs["paidApiConfig"]?.id === this.paidApiConfigId

			if (hasDefaultWithCorrectId && hasPaidWithCorrectId) {
				logger.info("[Migrate2Config] Already using 2-config structure with correct IDs, skipping migration")
				return
			}

			logger.info("[Migrate2Config] Migrating to 2-config structure...")

			// Find any existing config with API keys to preserve them
			const existingConfigWithKeys = Object.values(providerProfiles.apiConfigs).find((config) => {
				return (
					(config as any).openRouterApiKey || (config as any).anthropicApiKey || (config as any).openAIApiKey
				)
			})

			// Create new default config
			const newDefaultConfig = {
				...this.defaultProviderProfiles.apiConfigs["default"],
				id: this.defaultConfigId,
			}

			// Create new paidApiConfig
			const newPaidConfig = {
				...this.defaultProviderProfiles.apiConfigs["paidApiConfig"],
				id: this.paidApiConfigId,
			}

			// Copy API keys from existing config if found
			if (existingConfigWithKeys) {
				logger.info("[Migrate2Config] Copying API keys from existing config")
				const keysToCopy = ["openRouterApiKey", "anthropicApiKey", "openAIApiKey"]
				keysToCopy.forEach((key) => {
					if ((existingConfigWithKeys as any)[key]) {
						;(newDefaultConfig as any)[key] = (existingConfigWithKeys as any)[key]
						;(newPaidConfig as any)[key] = (existingConfigWithKeys as any)[key]
					}
				})
			}

			// Replace all configs with just the 2 new ones
			providerProfiles.apiConfigs = {
				default: newDefaultConfig,
				paidApiConfig: newPaidConfig,
			}

			// Ensure currentApiConfigName is set to 'default'
			providerProfiles.currentApiConfigName = "default"

			logger.info("[Migrate2Config] Successfully migrated to 2-config structure with fixed IDs")
		} catch (error) {
			console.error(`[Migrate2Config] Failed to migrate to 2-config structure:`, error)
		}
	}

	/**
	 * List all available configs with metadata, including the 'default' config.
	 */
	public async listConfig(): Promise<ProviderSettingsEntry[]> {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()

				const entries = Object.entries(providerProfiles.apiConfigs).map(([name, apiConfig]) => ({
					name,
					id: apiConfig.id || "",
					apiProvider: apiConfig.apiProvider,
				}))

				logger.info(`[ProviderSettingsManager] listConfig returning ${entries.length} entries`)

				return entries
			})
		} catch (error) {
			throw new Error(`Failed to list configs: ${error}`)
		}
	}

	/**
	 * Save a config with the given name.
	 * Preserves the ID from the input 'config' object if it exists,
	 * otherwise generates a new one (for creation scenarios).
	 */
	public async saveConfig(name: string, config: ProviderSettingsWithId): Promise<string> {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				// Preserve the existing ID if this is an update to an existing config.
				const existingId = providerProfiles.apiConfigs[name]?.id
				const id = config.id || existingId || this.generateId()

				// Filter out settings from other providers.
				const filteredConfig = discriminatedProviderSettingsWithIdSchema.parse(config)
				providerProfiles.apiConfigs[name] = { ...filteredConfig, id }
				await this.store(providerProfiles)
				return id
			})
		} catch (error) {
			throw new Error(`Failed to save config: ${error}`)
		}
	}

	public async getProfile(
		params: { name: string } | { id: string },
	): Promise<ProviderSettingsWithId & { name: string }> {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				let name: string
				let providerSettings: ProviderSettingsWithId

				if ("name" in params) {
					name = params.name

					if (!providerProfiles.apiConfigs[name]) {
						throw new Error(`Config with name '${name}' not found`)
					}

					providerSettings = providerProfiles.apiConfigs[name]
				} else {
					const id = params.id

					const entry = Object.entries(providerProfiles.apiConfigs).find(
						([_, apiConfig]) => apiConfig.id === id,
					)

					if (!entry) {
						throw new Error(`Config with ID '${id}' not found`)
					}

					name = entry[0]
					providerSettings = entry[1]
				}

				return { name, ...providerSettings }
			})
		} catch (error) {
			throw new Error(`Failed to get profile: ${error instanceof Error ? error.message : error}`)
		}
	}

	/**
	 * Activate a profile by name or ID.
	 */
	public async activateProfile(
		params: { name: string } | { id: string },
	): Promise<ProviderSettingsWithId & { name: string }> {
		const { name, ...providerSettings } = await this.getProfile(params)

		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				providerProfiles.currentApiConfigName = name
				await this.store(providerProfiles)
				return { name, ...providerSettings }
			})
		} catch (error) {
			throw new Error(`Failed to activate profile: ${error instanceof Error ? error.message : error}`)
		}
	}

	/**
	 * Delete a config by name.
	 */
	public async deleteConfig(name: string) {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()

				if (!providerProfiles.apiConfigs[name]) {
					throw new Error(`Config '${name}' not found`)
				}

				if (Object.keys(providerProfiles.apiConfigs).length === 1) {
					throw new Error(`Cannot delete the last remaining configuration`)
				}

				delete providerProfiles.apiConfigs[name]
				await this.store(providerProfiles)
			})
		} catch (error) {
			throw new Error(`Failed to delete config: ${error}`)
		}
	}

	/**
	 * Check if a config exists by name.
	 */
	public async hasConfig(name: string) {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				return name in providerProfiles.apiConfigs
			})
		} catch (error) {
			throw new Error(`Failed to check config existence: ${error}`)
		}
	}

	public async export() {
		try {
			return await this.lock(async () => {
				const profiles = providerProfilesSchema.parse(await this.load())
				const configs = profiles.apiConfigs
				for (const name in configs) {
					// Avoid leaking properties from other providers.
					configs[name] = discriminatedProviderSettingsWithIdSchema.parse(configs[name])
				}
				return profiles
			})
		} catch (error) {
			throw new Error(`Failed to export provider profiles: ${error}`)
		}
	}

	public async import(providerProfiles: ProviderProfiles) {
		try {
			return await this.lock(() => this.store(providerProfiles))
		} catch (error) {
			throw new Error(`Failed to import provider profiles: ${error}`)
		}
	}

	/**
	 * Reset provider profiles by deleting them from secrets.
	 */
	public async resetAllConfigs() {
		return await this.lock(async () => {
			await this.context.secrets.delete(this.secretsKey)
		})
	}

	private get secretsKey() {
		return `${ProviderSettingsManager.SCOPE_PREFIX}api_config`
	}

	private async load(): Promise<ProviderProfiles> {
		try {
			logger.info(`[ProviderSettingsManager.load] Loading configs from secrets...`)
			const content = await this.context.secrets.get(this.secretsKey)

			if (!content) {
				logger.info(
					"[ProviderSettingsManager.load] No saved configs, returning defaults with currentApiConfigName='default'",
				)
				logger.info(
					"[ProviderSettingsManager.load] NOTE: Defaults will be stored by initialize() if this is first load",
				)
				return { ...this.defaultProviderProfiles }
			}

			const providerProfiles = providerProfilesSchema
				.extend({
					apiConfigs: z.record(z.string(), z.any()),
				})
				.parse(JSON.parse(content))

			const apiConfigs = Object.entries(providerProfiles.apiConfigs).reduce(
				(acc, [key, apiConfig]) => {
					const result = providerSettingsWithIdSchema.safeParse(apiConfig)
					return result.success ? { ...acc, [key]: result.data } : acc
				},
				{} as Record<string, ProviderSettingsWithId>,
			)

			logger.info(`[ProviderSettingsManager] Loaded ${Object.keys(apiConfigs).length} saved configs from secrets`)

			// Migrate old ids to new ids
			const migrations = {
				"anthropic-claude-config-id": "anthropic-claude-config",
				"openai-gpt-config-id": "openai-gpt-config",
				"anthropic-haiku-config-id": "anthropic-haiku",
			}
			for (const [oldId, newId] of Object.entries(migrations)) {
				if (apiConfigs[oldId]) {
					apiConfigs[newId] = { ...apiConfigs[oldId], id: newId }
					delete apiConfigs[oldId]
				}
			}

			// Merge with default predefined configs to ensure they're always available
			const mergedApiConfigs = {
				...this.defaultProviderProfiles.apiConfigs, // Predefined configs first
				...apiConfigs, // User configs override defaults if they have the same name
			}

			logger.info(`[ProviderSettingsManager] After merge: ${Object.keys(mergedApiConfigs).length} total configs`)

			// Ensure default and paidApiConfig always exist
			if (!mergedApiConfigs["default"]) {
				logger.warn("[ProviderSettingsManager] default config missing, using defaults")
				mergedApiConfigs["default"] = this.defaultProviderProfiles.apiConfigs["default"]
			}
			if (!mergedApiConfigs["paidApiConfig"]) {
				logger.warn("[ProviderSettingsManager] paidApiConfig missing, using defaults")
				mergedApiConfigs["paidApiConfig"] = this.defaultProviderProfiles.apiConfigs["paidApiConfig"]
			}

			// Find a config with API keys to populate predefined configs
			const configWithKeys = Object.values(mergedApiConfigs).find((config) => {
				return (
					(config && (config as any).openRouterApiKey) ||
					(config as any).anthropicApiKey ||
					(config as any).openAIApiKey
				)
			})

			if (configWithKeys) {
				const keysToCopy = [
					"openRouterApiKey",
					"anthropicApiKey",
					"openAIApiKey",
					"openRouterModelId",
					"anthropicModelId",
					"openAIModelId",
				]
				keysToCopy.forEach((key) => {
					// Copy keys to default config if not present
					if (
						mergedApiConfigs["default"] &&
						(configWithKeys as any)[key] &&
						!(mergedApiConfigs["default"] as any)[key]
					) {
						;(mergedApiConfigs["default"] as any)[key] = (configWithKeys as any)[key]
						logger.info(`ProviderSettingsManager.load: copied ${key} to default`)
					}
					// Copy keys to paidApiConfig if not present
					if (
						mergedApiConfigs["paidApiConfig"] &&
						(configWithKeys as any)[key] &&
						!(mergedApiConfigs["paidApiConfig"] as any)[key]
					) {
						;(mergedApiConfigs["paidApiConfig"] as any)[key] = (configWithKeys as any)[key]
						logger.info(`ProviderSettingsManager.load: copied ${key} to paidApiConfig`)
					}
				})
			} else {
				logger.info(`ProviderSettingsManager.load: no config with keys found`)
			}

			logger.info(`[ProviderSettingsManager.load] mergedApiConfigs keys: ${Object.keys(mergedApiConfigs)}`)

			// Ensure currentApiConfigName is valid and points to an existing config
			let currentApiConfigName = providerProfiles.currentApiConfigName
			logger.info(`[ProviderSettingsManager.load] Original currentApiConfigName='${currentApiConfigName}'`)

			if (!mergedApiConfigs[currentApiConfigName]) {
				logger.warn(
					`[ProviderSettingsManager.load] currentApiConfigName '${currentApiConfigName}' not found in configs, defaulting to 'default'`,
				)
				currentApiConfigName = "default"
			}

			logger.info(
				`[ProviderSettingsManager.load] Final currentApiConfigName='${currentApiConfigName}', returning profiles`,
			)

			return {
				...providerProfiles,
				currentApiConfigName,
				apiConfigs: mergedApiConfigs,
			}
		} catch (error) {
			if (error instanceof ZodError) {
				TelemetryService.instance.captureSchemaValidationError({
					schemaName: "ProviderProfiles",
					error,
				})
			}

			throw new Error(`Failed to read provider profiles from secrets: ${error}`)
		}
	}

	private async store(providerProfiles: ProviderProfiles) {
		try {
			await this.context.secrets.store(this.secretsKey, JSON.stringify(providerProfiles, null, 2))
		} catch (error) {
			throw new Error(`Failed to write provider profiles to secrets: ${error}`)
		}
	}

	private findUniqueProfileName(baseName: string, existingNames: Set<string>): string {
		if (!existingNames.has(baseName)) {
			return baseName
		}

		// Try _local first
		const localName = `${baseName}_local`
		if (!existingNames.has(localName)) {
			return localName
		}

		// Try _1, _2, etc.
		let counter = 1
		let candidateName: string
		do {
			candidateName = `${baseName}_${counter}`
			counter++
		} while (existingNames.has(candidateName))

		return candidateName
	}

	public async syncCloudProfiles(
		cloudProfiles: Record<string, ProviderSettingsWithId>,
		currentActiveProfileName?: string,
	): Promise<SyncCloudProfilesResult> {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				const changedProfiles: string[] = []
				const existingNames = new Set(Object.keys(providerProfiles.apiConfigs))

				let activeProfileChanged = false
				let activeProfileId = ""

				if (currentActiveProfileName && providerProfiles.apiConfigs[currentActiveProfileName]) {
					activeProfileId = providerProfiles.apiConfigs[currentActiveProfileName].id || ""
				}

				const currentCloudIds = new Set(providerProfiles.cloudProfileIds || [])
				const newCloudIds = new Set(
					Object.values(cloudProfiles)
						.map((p) => p.id)
						.filter((id): id is string => Boolean(id)),
				)

				// Step 1: Delete profiles that are cloud-managed but not in the new cloud profiles
				for (const [name, profile] of Object.entries(providerProfiles.apiConfigs)) {
					if (profile.id && currentCloudIds.has(profile.id) && !newCloudIds.has(profile.id)) {
						// Check if we're deleting the active profile
						if (name === currentActiveProfileName) {
							activeProfileChanged = true
							activeProfileId = "" // Clear the active profile ID since it's being deleted
						}
						delete providerProfiles.apiConfigs[name]
						changedProfiles.push(name)
						existingNames.delete(name)
					}
				}

				// Step 2: Process each cloud profile
				for (const [cloudName, cloudProfile] of Object.entries(cloudProfiles)) {
					if (!cloudProfile.id) {
						continue // Skip profiles without IDs
					}

					// Find existing profile with matching ID
					const existingEntry = Object.entries(providerProfiles.apiConfigs).find(
						([_, profile]) => profile.id === cloudProfile.id,
					)

					if (existingEntry) {
						// Step 3: Update existing profile
						const [existingName, existingProfile] = existingEntry

						// Check if this is the active profile
						const isActiveProfile = existingName === currentActiveProfileName

						// Merge settings, preserving secret keys
						const updatedProfile: ProviderSettingsWithId = { ...cloudProfile }
						for (const [key, value] of Object.entries(existingProfile)) {
							if (isSecretStateKey(key) && value !== undefined) {
								;(updatedProfile as any)[key] = value
							}
						}

						// Check if the profile actually changed using deepEqual
						const profileChanged = !deepEqual(existingProfile, updatedProfile)

						// Handle name change
						if (existingName !== cloudName) {
							// Remove old entry
							delete providerProfiles.apiConfigs[existingName]
							existingNames.delete(existingName)

							// Handle name conflict
							let finalName = cloudName
							if (existingNames.has(cloudName)) {
								// There's a conflict - rename the existing non-cloud profile
								const conflictingProfile = providerProfiles.apiConfigs[cloudName]
								if (conflictingProfile.id !== cloudProfile.id) {
									const newName = this.findUniqueProfileName(cloudName, existingNames)
									providerProfiles.apiConfigs[newName] = conflictingProfile
									existingNames.add(newName)
									changedProfiles.push(newName)
								}
								delete providerProfiles.apiConfigs[cloudName]
								existingNames.delete(cloudName)
							}

							// Add updated profile with new name
							providerProfiles.apiConfigs[finalName] = updatedProfile
							existingNames.add(finalName)
							changedProfiles.push(finalName)
							if (existingName !== finalName) {
								changedProfiles.push(existingName) // Mark old name as changed (deleted)
							}

							// If this was the active profile, mark it as changed
							if (isActiveProfile) {
								activeProfileChanged = true
								activeProfileId = cloudProfile.id || ""
							}
						} else if (profileChanged) {
							// Same name, but profile content changed - update in place
							providerProfiles.apiConfigs[existingName] = updatedProfile
							changedProfiles.push(existingName)

							// If this was the active profile and settings changed, mark it as changed
							if (isActiveProfile) {
								activeProfileChanged = true
								activeProfileId = cloudProfile.id || ""
							}
						}
						// If name is the same and profile hasn't changed, do nothing
					} else {
						// Step 4: Add new cloud profile
						let finalName = cloudName

						// Handle name conflict with existing non-cloud profile
						if (existingNames.has(cloudName)) {
							const existingProfile = providerProfiles.apiConfigs[cloudName]
							if (existingProfile.id !== cloudProfile.id) {
								// Rename the existing profile
								const newName = this.findUniqueProfileName(cloudName, existingNames)
								providerProfiles.apiConfigs[newName] = existingProfile
								existingNames.add(newName)
								changedProfiles.push(newName)

								// Remove the old entry
								delete providerProfiles.apiConfigs[cloudName]
								existingNames.delete(cloudName)
							}
						}

						// Add the new cloud profile (without secret keys)
						const newProfile: ProviderSettingsWithId = { ...cloudProfile }
						// Remove any secret keys from cloud profile
						for (const key of Object.keys(newProfile)) {
							if (isSecretStateKey(key)) {
								delete (newProfile as any)[key]
							}
						}

						providerProfiles.apiConfigs[finalName] = newProfile
						existingNames.add(finalName)
						changedProfiles.push(finalName)
					}
				}

				// Step 5: Handle case where all profiles might be deleted
				if (Object.keys(providerProfiles.apiConfigs).length === 0 && changedProfiles.length > 0) {
					// Create a default profile only if we have changed profiles
					const defaultProfile = { id: this.generateId() }
					providerProfiles.apiConfigs["default"] = defaultProfile
					activeProfileChanged = true
					activeProfileId = defaultProfile.id || ""
					changedProfiles.push("default")
				}

				// Step 6: If active profile was deleted, find a replacement
				if (activeProfileChanged && !activeProfileId) {
					const firstProfile = Object.values(providerProfiles.apiConfigs)[0]
					if (firstProfile?.id) {
						activeProfileId = firstProfile.id
					}
				}

				// Step 7: Update cloudProfileIds
				providerProfiles.cloudProfileIds = Array.from(newCloudIds)

				// Save the updated profiles
				await this.store(providerProfiles)

				return {
					hasChanges: changedProfiles.length > 0,
					activeProfileChanged,
					activeProfileId,
				}
			})
		} catch (error) {
			throw new Error(`Failed to sync cloud profiles: ${error}`)
		}
	}
}
