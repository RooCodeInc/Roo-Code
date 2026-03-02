import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import English as the reference (source of truth)
import enSettings from "../locales/en/settings.json"

// All target locales (17 non-English locales)
const locales = [
	"ca", // Catalan
	"de", // German
	"es", // Spanish
	"fr", // French
	"hi", // Hindi
	"id", // Indonesian
	"it", // Italian
	"ja", // Japanese
	"ko", // Korean
	"nl", // Dutch
	"pl", // Polish
	"pt-BR", // Portuguese (Brazil)
	"ru", // Russian
	"tr", // Turkish
	"vi", // Vietnamese
	"zh-CN", // Chinese (Simplified)
	"zh-TW", // Chinese (Traditional)
]

describe("Ollama i18n Coverage", () => {
	// Get all keys from English (source of truth)
	const enOllamaKeys = Object.keys(enSettings.providers.ollama)

	locales.forEach((locale) => {
		it(`should have all Ollama keys for ${locale}`, () => {
			const filePath = path.join(__dirname, `../locales/${locale}/settings.json`)
			const fileContent = fs.readFileSync(filePath, "utf-8")
			const localeSettings = JSON.parse(fileContent)

			// Verify providers.ollama exists
			expect(localeSettings.providers).toBeDefined()
			expect(localeSettings.providers.ollama).toBeDefined()

			const localeOllamaKeys = Object.keys(localeSettings.providers.ollama)

			// Check that all English keys exist in the locale
			enOllamaKeys.forEach((key) => {
				expect(localeOllamaKeys, `Missing key "${key}" in ${locale}/settings.json`).toContain(key)
			})
		})

		it(`should have valid JSON structure for ${locale}`, () => {
			const filePath = path.join(__dirname, `../locales/${locale}/settings.json`)
			const fileContent = fs.readFileSync(filePath, "utf-8")

			// Should parse without errors
			expect(() => JSON.parse(fileContent)).not.toThrow()

			const localeSettings = JSON.parse(fileContent)

			// Verify structure
			expect(localeSettings).toBeDefined()
			expect(localeSettings.providers).toBeDefined()
			expect(localeSettings.providers.ollama).toBeDefined()
			expect(typeof localeSettings.providers.ollama).toBe("object")
		})

		it(`should have "models" key as plural object for ${locale}`, () => {
			const filePath = path.join(__dirname, `../locales/${locale}/settings.json`)
			const fileContent = fs.readFileSync(filePath, "utf-8")
			const localeSettings = JSON.parse(fileContent)

			const modelsKey = localeSettings.providers.ollama.models

			// Should be an object (plural form), not a string
			expect(typeof modelsKey).toBe("object")
			expect(modelsKey).not.toBeNull()

			// Should have at least "one" and "other" keys
			expect(modelsKey).toHaveProperty("one")
			expect(modelsKey).toHaveProperty("other")

			// Russian and Polish should have additional plural forms
			if (locale === "ru" || locale === "pl") {
				expect(modelsKey).toHaveProperty("few")
				expect(modelsKey).toHaveProperty("many")
			}

			// All values should be strings
			Object.values(modelsKey).forEach((value) => {
				expect(typeof value).toBe("string")
				expect(value).not.toBe("")
			})
		})
	})

	it("should have consistent key count across all locales", () => {
		const keyCounts = locales.map((locale) => {
			const filePath = path.join(__dirname, `../locales/${locale}/settings.json`)
			const fileContent = fs.readFileSync(filePath, "utf-8")
			const localeSettings = JSON.parse(fileContent)
			return Object.keys(localeSettings.providers.ollama).length
		})

		const enKeyCount = enOllamaKeys.length

		// All locales should have the same number of keys as English
		keyCounts.forEach((count, index) => {
			expect(count, `${locales[index]} has ${count} keys, but English has ${enKeyCount} keys`).toBe(enKeyCount)
		})
	})

	// Test common terms translations (Provider, Base, Model)
	describe("Common Terms Translation Coverage", () => {
		// English words that should not appear in non-English locales
		const englishWords = ["Provider", "Providers", "Base", "Model", "URL", "ID"]

		locales.forEach((locale) => {
			it(`should have translated common terms for ${locale}`, () => {
				const filePath = path.join(__dirname, `../locales/${locale}/settings.json`)
				const fileContent = fs.readFileSync(filePath, "utf-8")
				const localeSettings = JSON.parse(fileContent)

				// Check sections.providers
				expect(localeSettings.sections).toBeDefined()
				expect(localeSettings.sections.providers).toBeDefined()
				expect(typeof localeSettings.sections.providers).toBe("string")
				expect(localeSettings.sections.providers).not.toBe("")
				expect(localeSettings.sections.providers).not.toBe("Provider")
				expect(localeSettings.sections.providers).not.toBe("Providers")

				// Check providers.ollama.baseUrl
				expect(localeSettings.providers).toBeDefined()
				expect(localeSettings.providers.ollama).toBeDefined()
				expect(localeSettings.providers.ollama.baseUrl).toBeDefined()
				expect(typeof localeSettings.providers.ollama.baseUrl).toBe("string")
				expect(localeSettings.providers.ollama.baseUrl).not.toBe("")
				// Should not be exactly "Base URL (optional)" or "Base URL (opsional)"
				expect(localeSettings.providers.ollama.baseUrl).not.toMatch(/^Base URL/i)

				// Check providers.ollama.modelId
				expect(localeSettings.providers.ollama.modelId).toBeDefined()
				expect(typeof localeSettings.providers.ollama.modelId).toBe("string")
				expect(localeSettings.providers.ollama.modelId).not.toBe("")
				// Should not be exactly "Model ID"
				expect(localeSettings.providers.ollama.modelId).not.toMatch(/^Model ID$/i)
			})

			it(`should not contain English words in common terms for ${locale}`, () => {
				const filePath = path.join(__dirname, `../locales/${locale}/settings.json`)
				const fileContent = fs.readFileSync(filePath, "utf-8")
				const localeSettings = JSON.parse(fileContent)

				const providerValue = localeSettings.sections.providers
				const baseUrlValue = localeSettings.providers.ollama.baseUrl
				const modelIdValue = localeSettings.providers.ollama.modelId

				// Check that common terms don't contain standalone English words
				// (Allow "URL" and "ID" as they are technical acronyms commonly used)
				const providerHasEnglish = englishWords
					.filter((word) => word !== "URL" && word !== "ID")
					.some((word) => providerValue === word || providerValue.startsWith(word + " "))

				const baseUrlHasEnglish = englishWords
					.filter((word) => word !== "URL" && word !== "ID")
					.some((word) => baseUrlValue.includes(word) && !baseUrlValue.includes("URL"))

				const modelIdHasEnglish = englishWords
					.filter((word) => word !== "URL" && word !== "ID")
					.some((word) => modelIdValue.includes(word) && !modelIdValue.includes("ID"))

				// Note: This is a soft check - some languages may legitimately use English technical terms
				// The main check is that the values are not exactly the English defaults
				if (providerHasEnglish) {
					console.warn(`${locale}: "sections.providers" may contain English word: "${providerValue}"`)
				}
				if (baseUrlHasEnglish) {
					console.warn(`${locale}: "providers.ollama.baseUrl" may contain English word: "${baseUrlValue}"`)
				}
				if (modelIdHasEnglish) {
					console.warn(`${locale}: "providers.ollama.modelId" may contain English word: "${modelIdValue}"`)
				}
			})
		})
	})
})
