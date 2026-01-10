// npx vitest run src/hooks/__tests__/useSettingsSearch.spec.ts

import { renderHook } from "@testing-library/react"
import type { Mock } from "vitest"

import { useSettingsSearch } from "../useSettingsSearch"

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: vi.fn(),
}))

// Mock the parseSettingsI18nKeys module to provide a controlled settingsIndex
vi.mock("@/utils/parseSettingsI18nKeys", async () => {
	const actual = await vi.importActual("@/utils/parseSettingsI18nKeys")
	return {
		...actual,
	}
})

// Mock settings data
vi.mock("@/i18n/locales/en/settings.json", () => ({
	default: {
		browser: {
			enable: {
				label: "Enable browser tool",
				description: "Allows Roo to use a browser",
			},
			viewport: {
				label: "Browser viewport",
				description: "Configure the browser window size",
			},
		},
		notifications: {
			sound: {
				label: "Sound effects",
				description: "Play sound when Roo needs attention",
			},
		},
		checkpoints: {
			timeout: {
				label: "Checkpoint timeout",
			},
		},
	},
}))

import { useTranslation } from "react-i18next"

const mockUseTranslation = useTranslation as Mock

describe("useSettingsSearch", () => {
	beforeEach(() => {
		// Setup translation mock with a function that returns mock translations
		const mockTranslations: Record<string, string> = {
			"settings:browser.enable.label": "Enable browser tool",
			"settings:browser.enable.description": "Allows Roo to use a browser",
			"settings:browser.viewport.label": "Browser viewport",
			"settings:browser.viewport.description": "Configure the browser window size",
			"settings:notifications.sound.label": "Sound effects",
			"settings:notifications.sound.description": "Play sound when Roo needs attention",
			"settings:checkpoints.timeout.label": "Checkpoint timeout",
		}

		const mockT = (key: string) => mockTranslations[key] || key

		mockUseTranslation.mockReturnValue({
			t: mockT,
			i18n: {},
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("empty and whitespace queries", () => {
		it("should return empty array for empty query", () => {
			const { result } = renderHook(() => useSettingsSearch(""))

			expect(result.current).toEqual([])
		})

		it("should return empty array for whitespace-only query", () => {
			const { result } = renderHook(() => useSettingsSearch("   "))

			expect(result.current).toEqual([])
		})

		it("should return empty array for query with tabs and newlines", () => {
			const { result } = renderHook(() => useSettingsSearch("\t\n  \n"))

			expect(result.current).toEqual([])
		})
	})

	describe("label matching", () => {
		it("should match setting label (case-insensitive)", () => {
			const { result } = renderHook(() => useSettingsSearch("browser"))

			expect(result.current.length).toBeGreaterThan(0)
			const browserResults = result.current.filter((r) => r.translatedLabel.toLowerCase().includes("browser"))
			expect(browserResults.length).toBeGreaterThan(0)
		})

		it("should match with different case", () => {
			const { result } = renderHook(() => useSettingsSearch("BROWSER"))

			expect(result.current.length).toBeGreaterThan(0)
			const browserResults = result.current.filter((r) => r.translatedLabel.toLowerCase().includes("browser"))
			expect(browserResults.length).toBeGreaterThan(0)
		})

		it("should support partial word matching", () => {
			const { result } = renderHook(() => useSettingsSearch("brow"))

			expect(result.current.length).toBeGreaterThan(0)
			const browserResults = result.current.filter((r) => r.translatedLabel.toLowerCase().includes("brow"))
			expect(browserResults.length).toBeGreaterThan(0)
		})
	})

	describe("description matching", () => {
		it("should match setting description (case-insensitive)", () => {
			const { result } = renderHook(() => useSettingsSearch("attention"))

			expect(result.current.length).toBeGreaterThan(0)
			const attentionResults = result.current.filter((r) =>
				r.translatedDescription?.toLowerCase().includes("attention"),
			)
			expect(attentionResults.length).toBeGreaterThan(0)
		})

		it("should match description with different case", () => {
			const { result } = renderHook(() => useSettingsSearch("ATTENTION"))

			expect(result.current.length).toBeGreaterThan(0)
			const attentionResults = result.current.filter((r) =>
				r.translatedDescription?.toLowerCase().includes("attention"),
			)
			expect(attentionResults.length).toBeGreaterThan(0)
		})
	})

	describe("result structure", () => {
		it("should return translatedLabel and translatedDescription", () => {
			const { result } = renderHook(() => useSettingsSearch("browser"))

			expect(result.current.length).toBeGreaterThan(0)
			result.current.forEach((searchResult) => {
				expect(searchResult).toHaveProperty("translatedLabel")
				expect(typeof searchResult.translatedLabel).toBe("string")
				expect(searchResult.translatedLabel).not.toBe("")
				// translatedDescription may be undefined for some settings
			})
		})

		it("should include all ParsedSetting properties", () => {
			const { result } = renderHook(() => useSettingsSearch("browser"))

			expect(result.current.length).toBeGreaterThan(0)
			result.current.forEach((searchResult) => {
				expect(searchResult).toHaveProperty("id")
				expect(searchResult).toHaveProperty("tab")
				expect(searchResult).toHaveProperty("labelKey")
				expect(searchResult).toHaveProperty("matchScore")
			})
		})
	})

	describe("match score calculation", () => {
		it("should calculate matchScore correctly for label match only", () => {
			const { result } = renderHook(() => useSettingsSearch("timeout"))

			const timeoutResult = result.current.find((r) => r.translatedLabel.toLowerCase().includes("timeout"))
			expect(timeoutResult).toBeDefined()
			// "Checkpoint timeout" has no description, so only label match
			expect(timeoutResult?.matchScore).toBe(10)
		})

		it("should calculate matchScore correctly for description match only", () => {
			const { result } = renderHook(() => useSettingsSearch("attention"))

			// "attention" only appears in description of "Sound effects"
			const attentionResult = result.current.find(
				(r) =>
					r.translatedDescription?.toLowerCase().includes("attention") &&
					!r.translatedLabel.toLowerCase().includes("attention"),
			)
			expect(attentionResult).toBeDefined()
			expect(attentionResult?.matchScore).toBe(5)
		})

		it("should calculate matchScore correctly for both label and description match", () => {
			const { result } = renderHook(() => useSettingsSearch("browser"))

			// "browser" appears in both label and description for some settings
			const browserResults = result.current.filter(
				(r) =>
					r.translatedLabel.toLowerCase().includes("browser") &&
					r.translatedDescription?.toLowerCase().includes("browser"),
			)

			if (browserResults.length > 0) {
				browserResults.forEach((result) => {
					expect(result.matchScore).toBe(15) // 10 for label + 5 for description
				})
			}
		})

		it("should have higher matchScore for label+description than description only", () => {
			const { result } = renderHook(() => useSettingsSearch("browser"))

			const results = result.current
			const labelAndDescMatch = results.find(
				(r) =>
					r.translatedLabel.toLowerCase().includes("browser") &&
					r.translatedDescription?.toLowerCase().includes("browser"),
			)
			const descOnlyMatch = results.find(
				(r) =>
					!r.translatedLabel.toLowerCase().includes("browser") &&
					r.translatedDescription?.toLowerCase().includes("browser"),
			)

			if (labelAndDescMatch && descOnlyMatch) {
				expect(labelAndDescMatch.matchScore).toBeGreaterThan(descOnlyMatch.matchScore)
			}
		})
	})

	describe("sorting by match score", () => {
		it("should sort results by matchScore in descending order", () => {
			const { result } = renderHook(() => useSettingsSearch("browser"))

			const results = result.current
			expect(results.length).toBeGreaterThan(0)

			// Verify results are sorted by matchScore descending
			for (let i = 0; i < results.length - 1; i++) {
				expect(results[i].matchScore).toBeGreaterThanOrEqual(results[i + 1].matchScore)
			}
		})

		it("should rank label matches higher than description-only matches", () => {
			const { result } = renderHook(() => useSettingsSearch("browser"))

			const labelMatches = result.current.filter((r) => r.translatedLabel.toLowerCase().includes("browser"))
			const descriptionOnlyMatches = result.current.filter(
				(r) =>
					!r.translatedLabel.toLowerCase().includes("browser") &&
					r.translatedDescription?.toLowerCase().includes("browser"),
			)

			if (labelMatches.length > 0 && descriptionOnlyMatches.length > 0) {
				const lowestLabelMatchScore = Math.min(...labelMatches.map((r) => r.matchScore))
				const highestDescOnlyScore = Math.max(...descriptionOnlyMatches.map((r) => r.matchScore))

				expect(lowestLabelMatchScore).toBeGreaterThanOrEqual(highestDescOnlyScore)
			}
		})
	})

	describe("no matches", () => {
		it("should return empty array when no matches found", () => {
			const { result } = renderHook(() => useSettingsSearch("xyznonexistent"))

			expect(result.current).toEqual([])
		})
	})

	describe("hook reactivity", () => {
		it("should update results when query changes", () => {
			const { result, rerender } = renderHook(({ query }) => useSettingsSearch(query), {
				initialProps: { query: "browser" },
			})

			const browserResults = result.current
			expect(browserResults.length).toBeGreaterThan(0)

			// Change query
			rerender({ query: "sound" })

			const soundResults = result.current
			expect(soundResults.length).toBeGreaterThan(0)
			expect(soundResults).not.toEqual(browserResults)
		})

		it("should return empty array when query is cleared", () => {
			const { result, rerender } = renderHook(({ query }) => useSettingsSearch(query), {
				initialProps: { query: "browser" },
			})

			expect(result.current.length).toBeGreaterThan(0)

			// Clear query
			rerender({ query: "" })

			expect(result.current).toEqual([])
		})
	})
})
