import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ParsedSetting, parseSettingsI18nKeys } from "@/utils/parseSettingsI18nKeys"
import settingsEn from "@/i18n/locales/en/settings.json"

/**
 * Represents a search result for a setting.
 */
export interface SearchResult extends ParsedSetting {
	/** Translated label for the setting */
	translatedLabel: string
	/** Translated description for the setting (if available) */
	translatedDescription?: string
	/** Match score for sorting results (higher = better match) */
	matchScore: number
}

/**
 * Pre-parsed settings index, created once at module load.
 */
const settingsIndex: ParsedSetting[] = parseSettingsI18nKeys(settingsEn)

/**
 * Custom hook that provides search functionality for settings.
 *
 * @param query - The search query string
 * @returns Array of matching settings sorted by relevance (matchScore descending)
 *
 * @example
 * ```typescript
 * const results = useSettingsSearch("browser")
 * // Returns settings where label or description contains "browser"
 * ```
 */
export function useSettingsSearch(query: string): SearchResult[] {
	const { t } = useTranslation()

	return useMemo(() => {
		// Return empty array if query is empty or whitespace
		const trimmedQuery = query.trim()
		if (!trimmedQuery) {
			return []
		}

		// Normalize query to lowercase for case-insensitive matching
		const normalizedQuery = trimmedQuery.toLowerCase()

		// Search through all settings
		const results = settingsIndex
			.map((setting): SearchResult | null => {
				// Get translated label
				const translatedLabel = t(setting.labelKey)
				// Get translated description if it exists
				const translatedDescription = setting.descriptionKey ? t(setting.descriptionKey) : undefined

				// Check for matches (case-insensitive)
				const labelMatch = translatedLabel.toLowerCase().includes(normalizedQuery)
				const descriptionMatch = translatedDescription
					? translatedDescription.toLowerCase().includes(normalizedQuery)
					: false

				// If no match, return null
				if (!labelMatch && !descriptionMatch) {
					return null
				}

				// Calculate match score: +10 for label match, +5 for description match
				let matchScore = 0
				if (labelMatch) {
					matchScore += 10
				}
				if (descriptionMatch) {
					matchScore += 5
				}

				return {
					...setting,
					translatedLabel,
					translatedDescription,
					matchScore,
				}
			})
			.filter((result): result is SearchResult => result !== null)

		// Sort by matchScore descending
		results.sort((a, b) => b.matchScore - a.matchScore)

		return results
	}, [query, t])
}
