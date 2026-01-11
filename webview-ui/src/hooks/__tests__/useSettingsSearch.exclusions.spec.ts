// npx vitest run src/hooks/__tests__/useSettingsSearch.exclusions.spec.ts

import { renderHook } from "@testing-library/react"

import { useSettingsSearch } from "../useSettingsSearch"

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock settings data to include excluded paths and normal settings
vi.mock("@/i18n/locales/en/settings.json", () => ({
	default: {
		modelInfo: {
			inputPrice: "Input price",
			outputPrice: "Output price",
		},
		validation: {
			apiKey: "You must provide a valid API key",
		},
		browser: {
			enable: {
				label: "Enable browser tool",
				description: "Allows Roo to use a browser",
			},
		},
	},
}))

describe("useSettingsSearch - exclusions", () => {
	it("does not return excluded modelInfo entries", () => {
		const { result } = renderHook(() => useSettingsSearch("price"))

		const modelInfoResults = result.current.filter((r) => r.id.startsWith("modelInfo."))
		expect(modelInfoResults).toHaveLength(0)
	})

	it("does not return excluded validation entries", () => {
		const { result } = renderHook(() => useSettingsSearch("api key"))

		const validationResults = result.current.filter((r) => r.id.startsWith("validation."))
		expect(validationResults).toHaveLength(0)
	})

	it("still returns actionable settings", () => {
		const { result } = renderHook(() => useSettingsSearch("browser"))

		const browserResult = result.current.find((r) => r.id === "browser.enable")
		expect(browserResult).toBeDefined()
	})
})
