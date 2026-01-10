/**
 * Utility for parsing i18n translation structure to extract searchable settings information.
 *
 * This module traverses the nested settings translation object and identifies
 * settings by looking for objects with a 'label' property, extracting the
 * section (first path segment) and full setting path.
 */

/**
 * Valid section names that correspond to tabs in SettingsView.
 * Defined locally to avoid circular dependencies with SettingsView.tsx.
 */
export const sectionNames = [
	"providers",
	"autoApprove",
	"slashCommands",
	"browser",
	"checkpoints",
	"notifications",
	"contextManagement",
	"terminal",
	"modes",
	"mcp",
	"prompts",
	"ui",
	"experimental",
	"language",
	"about",
] as const

export type SectionName = (typeof sectionNames)[number]

/**
 * Represents a parsed setting extracted from i18n translations.
 */
export interface ParsedSetting {
	/** Unique identifier for the setting, e.g., 'browser.enable' */
	id: string
	/** The tab/section this setting belongs to, e.g., 'browser' */
	tab: SectionName
	/** i18n key for the label, e.g., 'settings:browser.enable.label' */
	labelKey: string
	/** i18n key for the description (optional), e.g., 'settings:browser.enable.description' */
	descriptionKey?: string
}

/**
 * Special entries for tabs that don't follow the standard settings:section.setting.label pattern.
 * These entries allow users to search for tab names and navigate directly to those tabs.
 */
const specialTabEntries: ParsedSetting[] = [
	{
		id: "modes",
		tab: "modes",
		labelKey: "settings:sections.modes",
		descriptionKey: undefined,
	},
	{
		id: "mcp",
		tab: "mcp",
		labelKey: "settings:sections.mcp",
		descriptionKey: undefined,
	},
	{
		id: "providers",
		tab: "providers",
		labelKey: "settings:sections.providers",
		descriptionKey: undefined,
	},
	{
		id: "slashCommands",
		tab: "slashCommands",
		labelKey: "settings:sections.slashCommands",
		descriptionKey: undefined,
	},
	{
		id: "about",
		tab: "about",
		labelKey: "settings:sections.about",
		descriptionKey: undefined,
	},
	{
		id: "prompts",
		tab: "prompts",
		labelKey: "settings:sections.prompts",
		descriptionKey: undefined,
	},
	{
		id: "language",
		tab: "language",
		labelKey: "settings:sections.language",
		descriptionKey: undefined,
	},
]

/**
 * Mapping from i18n section names to their corresponding tab names.
 * Most sections map directly, but this provides flexibility for any differences.
 */
const sectionToTabMapping: Record<string, SectionName | undefined> = {
	// Direct mappings - section name matches tab name
	providers: "providers",
	autoApprove: "autoApprove",
	slashCommands: "slashCommands",
	browser: "browser",
	checkpoints: "checkpoints",
	notifications: "notifications",
	contextManagement: "contextManagement",
	terminal: "terminal",
	modes: "modes",
	mcp: "mcp",
	prompts: "prompts",
	ui: "ui",
	experimental: "experimental",
	language: "language",
	about: "about",
	// Additional mappings for nested sections that should map to specific tabs
	advanced: "providers", // advanced settings are part of providers tab
	codeIndex: "experimental", // codebase indexing is in experimental
}

/**
 * Set of section names that are valid tabs.
 */
const validTabs = new Set<string>(sectionNames)

/**
 * Checks if a value is a plain object (not null, not array).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Checks if an object represents a setting (has a 'label' property that is a string).
 */
function isSettingObject(obj: Record<string, unknown>): boolean {
	return typeof obj.label === "string"
}

/**
 * Gets the tab for a given section name.
 */
function getTabForSection(section: string): SectionName | undefined {
	// First check the explicit mapping
	if (sectionToTabMapping[section]) {
		return sectionToTabMapping[section]
	}
	// Fall back to direct match if section is a valid tab name
	if (validTabs.has(section)) {
		return section as SectionName
	}
	return undefined
}

/**
 * Recursively traverses the translation object to find settings.
 *
 * @param obj - The current object being traversed
 * @param path - Array of keys representing the current path
 * @param namespace - The i18n namespace (e.g., 'settings')
 * @param results - Array to collect parsed settings
 * @param rootSection - The root section name (first path segment)
 */
function traverseTranslations(
	obj: Record<string, unknown>,
	path: string[],
	namespace: string,
	results: ParsedSetting[],
	rootSection?: string,
): void {
	// Determine the root section from the first path segment
	const currentRootSection = rootSection ?? path[0]

	// If this object has a 'label' property, it's a setting
	if (isSettingObject(obj)) {
		const tab = getTabForSection(currentRootSection)

		// Skip if we can't map to a valid tab
		if (!tab) {
			return
		}

		// Build the setting ID from the path (excluding the 'label' part)
		const settingId = path.join(".")

		// Build the i18n keys
		const labelKey = `${namespace}:${settingId}.label`
		const descriptionKey = typeof obj.description === "string" ? `${namespace}:${settingId}.description` : undefined

		results.push({
			id: settingId,
			tab,
			labelKey,
			descriptionKey,
		})
	}

	// Continue traversing nested objects
	for (const [key, value] of Object.entries(obj)) {
		// Skip non-object values and special keys that are not settings
		if (!isPlainObject(value)) {
			continue
		}

		// Skip the 'label' and 'description' keys themselves as they are not nested settings
		if (key === "label" || key === "description") {
			continue
		}

		// Recurse into nested objects
		traverseTranslations(value, [...path, key], namespace, results, currentRootSection)
	}
}

/**
 * Parses the i18n translation structure to extract searchable settings information.
 *
 * @param translations - The translations object (e.g., the content of settings.json)
 * @param namespace - The i18n namespace, defaults to 'settings'
 * @returns Array of parsed settings with their IDs, tabs, and i18n keys
 *
 * @example
 * ```typescript
 * import settingsTranslations from '@/i18n/locales/en/settings.json'
 *
 * const parsedSettings = parseSettingsI18nKeys(settingsTranslations)
 * // Returns:
 * // [
 * //   { id: 'browser.enable', tab: 'browser', labelKey: 'settings:browser.enable.label', descriptionKey: 'settings:browser.enable.description' },
 * //   { id: 'browser.viewport', tab: 'browser', labelKey: 'settings:browser.viewport.label', descriptionKey: 'settings:browser.viewport.description' },
 * //   ...
 * // ]
 * ```
 */
export function parseSettingsI18nKeys(
	translations: Record<string, unknown>,
	namespace: string = "settings",
): ParsedSetting[] {
	const results: ParsedSetting[] = []

	// Traverse each top-level section
	for (const [sectionKey, sectionValue] of Object.entries(translations)) {
		// Skip non-object sections (like 'common', etc. that don't contain settings)
		if (!isPlainObject(sectionValue)) {
			continue
		}

		// Skip sections that are clearly not settings containers
		// These are sections that have simple string values, not nested setting objects
		const skipSections = [
			"common",
			"header",
			"unsavedChangesDialog",
			"sections",
			"validation",
			"placeholders",
			"defaults",
			"labels",
			"search",
		]
		if (skipSections.includes(sectionKey)) {
			continue
		}

		// Traverse the section
		traverseTranslations(sectionValue, [sectionKey], namespace, results, sectionKey)
	}

	// Collect tabs that already have settings from parsing
	const tabsWithSettings = new Set(results.map((r) => r.tab))

	// Add special tab entries for tabs that don't have any parsed settings
	// This ensures users can search for tab names like "Modes" or "MCP" and navigate to those tabs
	for (const entry of specialTabEntries) {
		if (!tabsWithSettings.has(entry.tab)) {
			results.push(entry)
		}
	}

	return results
}
