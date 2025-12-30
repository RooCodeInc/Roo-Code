import type { ProviderSettings } from "@roo-code/types"
import { getCurrencySymbol, DEFAULT_CURRENCY_SYMBOL } from "../getCurrencySymbol"

describe("getCurrencySymbol", () => {
	it("returns default currency symbol when apiConfiguration is undefined", () => {
		expect(getCurrencySymbol(undefined)).toBe(DEFAULT_CURRENCY_SYMBOL)
	})

	it("returns default currency symbol when apiConfiguration is empty", () => {
		expect(getCurrencySymbol({})).toBe(DEFAULT_CURRENCY_SYMBOL)
	})

	it("returns default currency symbol when provider is not litellm", () => {
		const config: ProviderSettings = {
			apiProvider: "anthropic",
		}
		expect(getCurrencySymbol(config)).toBe(DEFAULT_CURRENCY_SYMBOL)
	})

	it("returns default currency symbol when provider is litellm but no custom symbol is set", () => {
		const config: ProviderSettings = {
			apiProvider: "litellm",
		}
		expect(getCurrencySymbol(config)).toBe(DEFAULT_CURRENCY_SYMBOL)
	})

	it("returns default currency symbol when provider is litellm and symbol is empty string", () => {
		const config: ProviderSettings = {
			apiProvider: "litellm",
			litellmCurrencySymbol: "",
		}
		expect(getCurrencySymbol(config)).toBe(DEFAULT_CURRENCY_SYMBOL)
	})

	it("returns custom currency symbol when provider is litellm and custom symbol is set", () => {
		const config: ProviderSettings = {
			apiProvider: "litellm",
			litellmCurrencySymbol: "€",
		}
		expect(getCurrencySymbol(config)).toBe("€")
	})

	it("returns custom currency symbol for various currency symbols", () => {
		const symbols = ["£", "¥", "₹", "₽", "CHF", "R$"]
		symbols.forEach((symbol) => {
			const config: ProviderSettings = {
				apiProvider: "litellm",
				litellmCurrencySymbol: symbol,
			}
			expect(getCurrencySymbol(config)).toBe(symbol)
		})
	})

	it("returns default currency symbol when litellm is provider but other settings exist without currency", () => {
		const config: ProviderSettings = {
			apiProvider: "litellm",
			litellmBaseUrl: "http://localhost:8000",
			litellmApiKey: "test-key",
			litellmModelId: "test-model",
		}
		expect(getCurrencySymbol(config)).toBe(DEFAULT_CURRENCY_SYMBOL)
	})
})
