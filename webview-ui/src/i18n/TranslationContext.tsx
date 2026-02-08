import React, { createContext, useContext, ReactNode, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import i18next, { loadTranslations } from "./setup"
import { useExtensionState } from "@/context/ExtensionStateContext"

// Create context for translations
export const TranslationContext = createContext<{
	t: (key: string, options?: Record<string, any>) => string
	i18n: typeof i18next
}>({
	t: (key: string) => key,
	i18n: i18next,
})

// Translation provider component
export const TranslationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	// Initialize with default configuration
	const { i18n } = useTranslation()
	// Get the extension state directly - it already contains all state properties
	const extensionState = useExtensionState()

	// Load translations once when the component mounts
	useEffect(() => {
		try {
			loadTranslations()
		} catch (error) {
			console.error("Failed to load translations:", error)
		}
	}, [])

	useEffect(() => {
		i18n.changeLanguage(extensionState.language)
	}, [i18n, extensionState.language])

	// Memoize the translation function to prevent unnecessary re-renders
	const translate = useCallback(
		(key: string, options?: Record<string, any>) => {
			const result = i18n.t(key, options)
			// Safeguard: ensure we always return a string, not an object
			// This handles cases where plural objects might not be resolved correctly
			if (typeof result === "object" && result !== null) {
				// Type guard for plural object
				const pluralResult = result as Record<string, any>
				// If it's a plural object and we have a count, try to resolve it
				if (options?.count !== undefined && "one" in pluralResult && "other" in pluralResult) {
					const count = options.count
					// Use i18next's pluralization logic
					if (count === 1 && typeof pluralResult.one === "string") {
						return pluralResult.one
					}
					if (typeof pluralResult.other === "string") {
						return pluralResult.other
					}
				}
				// Fallback: return the key if we can't resolve it
				console.warn(`Translation key "${key}" returned an object instead of string:`, result)
				return key
			}
			return result as string
		},
		[i18n],
	)

	return (
		<TranslationContext.Provider
			value={{
				t: translate,
				i18n,
			}}>
			{children}
		</TranslationContext.Provider>
	)
}

// Custom hook for easy translations
export const useAppTranslation = () => useContext(TranslationContext)

export default TranslationProvider
