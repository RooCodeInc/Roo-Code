import i18next from "i18next"
import * as fs from "fs"
import * as path from "path"
import { LanguageResources, TranslationResource } from "./types"
import { ZGSM_LANGUAGES } from "../../shared/language"

// Load translations from directory
const loadTranslationsFromDir = (dirPath: string): LanguageResources => {
	console.log(`Loading CoStrict backend translations from ${dirPath}`)
	const result: LanguageResources = {}

	try {
		if (!fs.existsSync(dirPath)) {
			console.log(`Directory not found: ${dirPath}`)
			return result
		}

		const ALLOW_LANGUAGES = Object.keys(ZGSM_LANGUAGES)
		const languageDirs = fs
			.readdirSync(dirPath, { withFileTypes: true })
			.filter((dirent: { isDirectory: () => boolean }) => dirent.isDirectory())
			.map((dirent: { name: string }) => dirent.name)
			.filter((language: string) => ALLOW_LANGUAGES.includes(language))

		languageDirs.forEach((language: string) => {
			const langPath = path.join(dirPath, language)
			const files = fs.readdirSync(langPath).filter((file: string) => file.endsWith(".json"))

			if (!result[language]) {
				result[language] = {}
			}

			files.forEach((file: string) => {
				const namespace = path.basename(file, ".json")
				const filePath = path.join(langPath, file)

				try {
					const content = fs.readFileSync(filePath, "utf8")
					result[language][namespace] = JSON.parse(content)
				} catch (error) {
					console.error(`Error loading translation file ${filePath}:`, error)
				}
			})
		})
	} catch (error) {
		console.error(`Error loading translations from ${dirPath}:`, error)
	}

	return result
}

// Load zgsm backend translations
export const zgsmTranslations = loadTranslationsFromDir(path.join(__dirname, "i18n", "costrict-i18n", "locales"))
console.log(`Loaded CoStrict backend translations for languages: ${Object.keys(zgsmTranslations).join(", ")}`)

// Initialize i18next
i18next.init({
	lng: "en",
	fallbackLng: "en",
	debug: false,
	resources: zgsmTranslations,
	interpolation: {
		escapeValue: false,
	},
})

// Merge translations function
const mergeTranslations = (base: TranslationResource, override: TranslationResource): TranslationResource => {
	const result = { ...base }
	for (const key in override) {
		if (typeof override[key] === "object" && override[key] !== null && !Array.isArray(override[key])) {
			result[key] = mergeTranslations(result[key] || {}, override[key])
		} else {
			result[key] = override[key]
		}
	}
	return result
}

export const mergeLanguageResources = (
	currentTranslations: LanguageResources,
	zgsmTranslations: LanguageResources,
): LanguageResources => {
	const mergedTranslations: LanguageResources = {}

	// Merge CoStrict translations
	for (const language in zgsmTranslations) {
		if (!mergedTranslations[language]) {
			mergedTranslations[language] = {}
		}

		for (const namespace in zgsmTranslations[language]) {
			const currentContent = currentTranslations[language]?.[namespace] || {}
			const zgsmContent = zgsmTranslations[language][namespace]

			mergedTranslations[language][namespace] = mergeTranslations(currentContent, zgsmContent)
		}
	}

	// Add current translations that don't exist in CoStrict
	for (const language in currentTranslations) {
		if (!mergedTranslations[language]) {
			mergedTranslations[language] = currentTranslations[language]
		} else {
			for (const namespace in currentTranslations[language]) {
				if (!mergedTranslations[language][namespace]) {
					mergedTranslations[language][namespace] = currentTranslations[language][namespace]
				}
			}
		}
	}

	return mergedTranslations
}

// List to store refresh functions
const languageRefreshFuncs: (() => void)[] = []

// Method to register a refresh function when language changes
export const registerRefreshFunction = (fn: () => void) => {
	languageRefreshFuncs.push(fn)
}

// Refresh all registered functions when language changes
export const changeZgsmLanguage = () => {
	// Execute all registered refresh functions
	languageRefreshFuncs.forEach((fn) => fn())
}

export default i18next
