import * as vscode from "vscode"
import { type ModeConfig } from "@roo-code/types"
import { logger } from "../../utils/logging"
import { t } from "../../i18n"

/**
 * Interface for mode validation result
 */
export interface ModeValidationResult {
	valid: string[]
	invalid: string[]
	missing: string[]
	warnings: string[]
}

/**
 * Interface for family conflict resolution options
 */
export interface ConflictResolutionOptions {
	removeInvalidModes?: boolean
	addMissingModes?: boolean
	strategy: 'strict' | 'lenient' | 'warn-only'
}

/**
 * Interface for a mode family configuration
 */
export interface ModeFamily {
	id: string
	name: string
	description?: string
	enabledModeSlugs: string[]
	isDefault?: boolean
	createdAt: number
	updatedAt: number
}

/**
 * Interface for the complete mode families configuration
 */
export interface ModeFamiliesConfig {
	activeFamilyId?: string
	families: Record<string, ModeFamily>
	lastUpdated: number
}

/**
 * Manager class for handling mode families functionality
 * Allows users to organize custom modes into groups and control which modes are active
 */
export class ModeFamiliesManager {
	private static readonly STORAGE_KEY = "modeFamilies"
	private static readonly CACHE_TTL = 10_000 // 10 seconds

	private cachedConfig: ModeFamiliesConfig | null = null
	private cachedAt: number = 0
	private disposables: vscode.Disposable[] = []

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly onUpdate: () => Promise<void>,
	) {
		// Initialize with comprehensive family setup for new installations
		this.initializeFamilies().catch((error) => {
			logger.error("Failed to initialize mode families", { error })
		})
	}

	/**
	 * Comprehensive initialization for both new and existing installations
	 * Creates default family if none exist, validates existing families, and handles migrations
	 */
	private async initializeFamilies(): Promise<void> {
		try {
			let config = await this.loadConfigFromStorage()

			// If no families exist, create comprehensive default family
			if (!config.families || Object.keys(config.families).length === 0) {
				await this.createDefaultAllModesFamily()
				return
			}

			// Validate existing families for conflicts and missing modes
			const validationResults = await this.validateAllFamilies(config)

			if (validationResults.hasConflicts) {
				logger.warn("Found mode conflicts in existing families", {
					invalidModes: validationResults.invalidModes,
					missingModes: validationResults.missingModes
				})

				// Apply conflict resolution based on strategy
				config = await this.resolveFamilyConflicts(config, {
					removeInvalidModes: true,
					addMissingModes: false,
					strategy: 'lenient'
				})
			}

			// Ensure default family exists and is up to date
			await this.ensureDefaultFamily(config)

			// Update configuration if changes were made
			if (validationResults.hasConflicts || await this.needsDefaultFamilyUpdate(config)) {
				await this.saveConfigToStorage(config)
				logger.info("Updated mode families during initialization")
			}

		} catch (error) {
			logger.error("Error during family initialization", { error })
		}
	}

	/**
	 * Create the default "All Modes" family with all available modes
	 */
	private async createDefaultAllModesFamily(): Promise<void> {
		try {
			const allModes = await this.getAllAvailableModes()
			const modeSlugs = allModes.map(mode => mode.slug)

			const defaultFamily: ModeFamily = {
				id: "default-all-modes",
				name: "All Modes",
				description: "All available modes are enabled",
				enabledModeSlugs: [], // Empty array means all modes are enabled
				isDefault: true,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			const config: ModeFamiliesConfig = {
				activeFamilyId: defaultFamily.id,
				families: {
					[defaultFamily.id]: defaultFamily,
				},
				lastUpdated: Date.now(),
			}

			await this.saveConfigToStorage(config)
			logger.info("Created comprehensive default mode family", {
				totalModes: modeSlugs.length,
				modeSlugs
			})
		} catch (error) {
			logger.error("Error creating default family", { error })
		}
	}

	/**
	 * Enhanced mode validation with detailed feedback
	 */
	public async validateFamilyModes(family: ModeFamily): Promise<ModeValidationResult> {
		try {
			const allModes = await this.getAllAvailableModes()
			const availableSlugs = new Set(allModes.map(mode => mode.slug))
			const familySlugs = new Set(family.enabledModeSlugs)

			const valid: string[] = []
			const invalid: string[] = []
			const missing: string[] = []
			const warnings: string[] = []

			// Check each mode in the family
			for (const slug of familySlugs) {
				if (availableSlugs.has(slug)) {
					valid.push(slug)
				} else {
					invalid.push(slug)
				}
			}

			// Check for missing modes that could be added
			for (const mode of allModes) {
				if (!familySlugs.has(mode.slug)) {
					missing.push(mode.slug)
				}
			}

			// Generate warnings for potential issues
			if (invalid.length > 0) {
				warnings.push(`${invalid.length} mode(s) in family no longer exist: ${invalid.join(', ')}`)
			}

			if (missing.length > 0 && familySlugs.size > 0) {
				warnings.push(`${missing.length} available mode(s) not included in family: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`)
			}

			return { valid, invalid, missing, warnings }
		} catch (error) {
			logger.error("Error validating family modes", { familyId: family.id, error })
			return {
				valid: [],
				invalid: family.enabledModeSlugs,
				missing: [],
				warnings: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
			}
		}
	}

	/**
	 * Validate all families for conflicts and issues
	 */
	private async validateAllFamilies(config: ModeFamiliesConfig): Promise<{
		hasConflicts: boolean
		invalidModes: string[]
		missingModes: string[]
	}> {
		const allModes = await this.getAllAvailableModes()
		const availableSlugs = new Set(allModes.map(mode => mode.slug))

		let hasConflicts = false
		const invalidModes: string[] = []
		const missingModes: string[] = []

		for (const family of Object.values(config.families)) {
			const validation = await this.validateFamilyModes(family)

			if (validation.invalid.length > 0) {
				hasConflicts = true
				invalidModes.push(...validation.invalid)
			}

			if (validation.missing.length > 0) {
				missingModes.push(...validation.missing)
			}
		}

		return { hasConflicts, invalidModes: [...new Set(invalidModes)], missingModes: [...new Set(missingModes)] }
	}

	/**
	 * Resolve conflicts in families based on resolution strategy
	 */
	private async resolveFamilyConflicts(
		config: ModeFamiliesConfig,
		options: ConflictResolutionOptions
	): Promise<ModeFamiliesConfig> {
		const updatedConfig = { ...config }
		updatedConfig.families = { ...config.families }

		for (const [familyId, family] of Object.entries(updatedConfig.families)) {
			const validation = await this.validateFamilyModes(family)

			if (validation.invalid.length === 0 && validation.missing.length === 0) {
				continue // No conflicts to resolve
			}

			const updatedFamily = { ...family }

			// Remove invalid modes if requested
			if (options.removeInvalidModes && validation.invalid.length > 0) {
				updatedFamily.enabledModeSlugs = family.enabledModeSlugs.filter(
					slug => !validation.invalid.includes(slug)
				)
				logger.info("Removed invalid modes from family", {
					familyId,
					removedModes: validation.invalid
				})
			}

			// Add missing modes if requested (but not for default family with empty enabledModeSlugs)
			if (options.addMissingModes &&
				validation.missing.length > 0 &&
				!(family.isDefault && family.enabledModeSlugs.length === 0)) {
				updatedFamily.enabledModeSlugs = [
					...new Set([...family.enabledModeSlugs, ...validation.missing])
				]
				logger.info("Added missing modes to family", {
					familyId,
					addedModes: validation.missing
				})
			}

			updatedFamily.updatedAt = Date.now()
			updatedConfig.families[familyId] = updatedFamily
		}

		updatedConfig.lastUpdated = Date.now()
		return updatedConfig
	}

	/**
	 * Check if default family needs updating with new modes
	 */
	private async needsDefaultFamilyUpdate(config: ModeFamiliesConfig): Promise<boolean> {
		const defaultFamily = Object.values(config.families).find(f => f.isDefault)
		if (!defaultFamily || defaultFamily.enabledModeSlugs.length > 0) {
			return false // Only update default family if it has empty enabledModeSlugs (meaning all modes)
		}

		const allModes = await this.getAllAvailableModes()
		const currentModeCount = allModes.length

		// If the number of modes has changed, we might need to update
		// This is a simple heuristic - in a real implementation, you might track mode versions
		return currentModeCount > 0 // For now, always check if there are modes available
	}

	/**
	 * Ensure default family exists and is current
	 */
	private async ensureDefaultFamily(config: ModeFamiliesConfig): Promise<void> {
		const defaultFamily = Object.values(config.families).find(f => f.isDefault)

		if (!defaultFamily) {
			logger.warn("No default family found, creating one")
			await this.createDefaultAllModesFamily()
			return
		}

		// Update default family if it needs it
		if (await this.needsDefaultFamilyUpdate(config)) {
			const allModes = await this.getAllAvailableModes()
			const modeSlugs = allModes.map(mode => mode.slug)

			// Update the default family (keep empty enabledModeSlugs to mean "all modes")
			defaultFamily.updatedAt = Date.now()
			config.lastUpdated = Date.now()

			logger.info("Updated default family", { totalModes: modeSlugs.length })
		}
	}

	/**
	 * Load configuration from VS Code global state storage
	 */
	private async loadConfigFromStorage(): Promise<ModeFamiliesConfig> {
		const stored = this.context.globalState.get<ModeFamiliesConfig>(ModeFamiliesManager.STORAGE_KEY)

		if (!stored) {
			return {
				families: {},
				lastUpdated: Date.now(),
			}
		}

		return stored
	}

	/**
	 * Save configuration to VS Code global state storage
	 */
	private async saveConfigToStorage(config: ModeFamiliesConfig): Promise<void> {
		await this.context.globalState.update(ModeFamiliesManager.STORAGE_KEY, config)
		this.clearCache()
		await this.onUpdate()
	}

	/**
	 * Clear the configuration cache
	 */
	private clearCache(): void {
		this.cachedConfig = null
		this.cachedAt = 0
	}

	/**
	 * Check if the cache is still valid
	 */
	private isCacheValid(): boolean {
		return this.cachedConfig !== null && (Date.now() - this.cachedAt) < ModeFamiliesManager.CACHE_TTL
	}

	/**
	 * Get the current mode families configuration
	 */
	private async getConfig(): Promise<ModeFamiliesConfig> {
		if (this.isCacheValid() && this.cachedConfig) {
			return this.cachedConfig
		}

		const config = await this.loadConfigFromStorage()
		this.cachedConfig = config
		this.cachedAt = Date.now()

		return config
	}

	/**
	 * Generate a unique ID for a new family
	 */
	private generateFamilyId(name: string): string {
		// Create a slug-like ID from the name
		const slug = name
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, "")
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-")
			.trim()

		// Add timestamp to ensure uniqueness
		return `${slug}-${Date.now()}`
	}

	/**
	 * Validate family name uniqueness
	 */
	private async validateFamilyName(name: string, excludeId?: string): Promise<boolean> {
		const config = await this.getConfig()
		return !Object.values(config.families).some(
			(family) => family.name.toLowerCase() === name.toLowerCase() && family.id !== excludeId
		)
	}

	/**
	 * Get all mode families
	 */
	public async getFamilies(): Promise<ModeFamily[]> {
		try {
			const config = await this.getConfig()
			return Object.values(config.families)
		} catch (error) {
			logger.error("Failed to get mode families", { error })
			return []
		}
	}

	/**
	 * Create a new mode family with enhanced validation
	 */
	public async createFamily(
		name: string,
		description?: string,
		enabledModeSlugs: string[] = [],
	): Promise<{ success: boolean; family?: ModeFamily; error?: string }> {
		try {
			// Validate inputs
			if (!name || name.trim().length === 0) {
				return { success: false, error: "Family name is required" }
			}

			// Check for duplicate names
			if (!(await this.validateFamilyName(name))) {
				return { success: false, error: "A family with this name already exists" }
			}

			// Validate mode slugs if provided
			if (enabledModeSlugs.length > 0) {
				const allModes = await this.getAllAvailableModes()
				const availableSlugs = new Set(allModes.map(mode => mode.slug))

				const invalidSlugs = enabledModeSlugs.filter(slug => !availableSlugs.has(slug))
				if (invalidSlugs.length > 0) {
					return {
						success: false,
						error: `The following modes do not exist: ${invalidSlugs.join(', ')}`
					}
				}
			}

			// Create the new family
			const family: ModeFamily = {
				id: this.generateFamilyId(name),
				name: name.trim(),
				description: description?.trim(),
				enabledModeSlugs,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			// Update configuration
			const config = await this.getConfig()
			config.families[family.id] = family
			config.lastUpdated = Date.now()

			await this.saveConfigToStorage(config)

			logger.info("Created new mode family", { familyId: family.id, name })
			return { success: true, family }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to create mode family", { name, error: errorMessage })
			return { success: false, error: `Failed to create family: ${errorMessage}` }
		}
	}

	/**
	 * Update an existing mode family with enhanced validation
	 */
	public async updateFamily(
		id: string,
		updates: Partial<Pick<ModeFamily, "name" | "description" | "enabledModeSlugs">>,
	): Promise<{ success: boolean; family?: ModeFamily; error?: string }> {
		try {
			const config = await this.getConfig()

			if (!config.families[id]) {
				return { success: false, error: "Family not found" }
			}

			// Validate name uniqueness if name is being updated
			if (updates.name && !(await this.validateFamilyName(updates.name, id))) {
				return { success: false, error: "A family with this name already exists" }
			}

			// Validate mode slugs if being updated
			if (updates.enabledModeSlugs) {
				const allModes = await this.getAllAvailableModes()
				const availableSlugs = new Set(allModes.map(mode => mode.slug))

				const invalidSlugs = updates.enabledModeSlugs.filter(slug => !availableSlugs.has(slug))
				if (invalidSlugs.length > 0) {
					return {
						success: false,
						error: `The following modes do not exist: ${invalidSlugs.join(', ')}`
					}
				}
			}

			// Update the family
			const updatedFamily: ModeFamily = {
				...config.families[id],
				...updates,
				updatedAt: Date.now(),
			}

			config.families[id] = updatedFamily
			config.lastUpdated = Date.now()

			await this.saveConfigToStorage(config)

			logger.info("Updated mode family", { familyId: id })
			return { success: true, family: updatedFamily }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to update mode family", { id, error: errorMessage })
			return { success: false, error: `Failed to update family: ${errorMessage}` }
		}
	}

	/**
	 * Delete a mode family
	 */
	public async deleteFamily(id: string): Promise<{ success: boolean; error?: string }> {
		try {
			const config = await this.getConfig()

			if (!config.families[id]) {
				return { success: false, error: "Family not found" }
			}

			// Don't allow deletion of the default family
			if (config.families[id].isDefault) {
				return { success: false, error: "Cannot delete the default family" }
			}

			// If this is the active family, switch to default
			if (config.activeFamilyId === id) {
				const defaultFamily = Object.values(config.families).find(f => f.isDefault)
				if (defaultFamily) {
					config.activeFamilyId = defaultFamily.id
				} else {
					config.activeFamilyId = undefined
				}
			}

			// Delete the family
			delete config.families[id]
			config.lastUpdated = Date.now()

			await this.saveConfigToStorage(config)

			logger.info("Deleted mode family", { familyId: id })
			return { success: true }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to delete mode family", { id, error: errorMessage })
			return { success: false, error: `Failed to delete family: ${errorMessage}` }
		}
	}

	/**
	 * Set the active family
	 */
	public async setActiveFamily(id: string): Promise<{ success: boolean; error?: string }> {
		try {
			const config = await this.getConfig()

			if (!config.families[id]) {
				return { success: false, error: "Family not found" }
			}

			config.activeFamilyId = id
			config.lastUpdated = Date.now()

			await this.saveConfigToStorage(config)

			logger.info("Set active mode family", { familyId: id })
			return { success: true }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to set active family", { id, error: errorMessage })
			return { success: false, error: `Failed to set active family: ${errorMessage}` }
		}
	}

	/**
	 * Get the currently active family
	 */
	public async getActiveFamily(): Promise<ModeFamily | null> {
		try {
			const config = await this.getConfig()

			if (!config.activeFamilyId || !config.families[config.activeFamilyId]) {
				return null
			}

			return config.families[config.activeFamilyId]
		} catch (error) {
			logger.error("Failed to get active family", { error })
			return null
		}
	}

	/**
	 * Get filtered modes based on the active family
	 */
	public async getFilteredModes(allModes: ModeConfig[]): Promise<ModeConfig[]> {
		try {
			const activeFamily = await this.getActiveFamily()

			if (!activeFamily) {
				// No active family, return all modes
				return allModes
			}

			// If the family has no specific enabled modes, return all modes
			if (activeFamily.enabledModeSlugs.length === 0) {
				return allModes
			}

			// Filter modes based on enabled mode slugs
			const enabledSlugs = new Set(activeFamily.enabledModeSlugs)
			return allModes.filter(mode => enabledSlugs.has(mode.slug))
		} catch (error) {
			logger.error("Failed to get filtered modes", { error })
			// Return all modes on error to maintain functionality
			return allModes
		}
	}

	/**
	 * Get all available modes (both built-in and custom)
	 * This is a helper method to get modes from the existing system
	 */
	private async getAllAvailableModes(): Promise<ModeConfig[]> {
		try {
			// Import built-in modes
			const { DEFAULT_MODES } = await import("../../shared/modes")

			// Get custom modes from storage (simplified - in real implementation,
			// this would integrate with CustomModesManager)
			const customModes = this.context.globalState.get<ModeConfig[]>("customModes") || []

			// Combine built-in and custom modes
			return [...DEFAULT_MODES, ...customModes]
		} catch (error) {
			logger.error("Failed to get all available modes", { error })
			// Return empty array as fallback
			return []
		}
	}

	/**
	 * Reset all families to default state with comprehensive setup
	 */
	public async resetFamilies(): Promise<{ success: boolean; error?: string }> {
		try {
			await this.createDefaultAllModesFamily()

			logger.info("Reset mode families to default state")
			return { success: true }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to reset mode families", { error: errorMessage })
			return { success: false, error: `Failed to reset families: ${errorMessage}` }
		}
	}

	/**
	 * Clean up resources
	 */
	public dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
		this.disposables = []
	}
}