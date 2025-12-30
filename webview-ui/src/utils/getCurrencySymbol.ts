import type { ProviderSettings } from "@roo-code/types"

/**
 * Default currency symbol used across the application.
 */
export const DEFAULT_CURRENCY_SYMBOL = "$"

/**
 * Gets the appropriate currency symbol based on the provider settings.
 * When LiteLLM is the active provider and a custom currency symbol is configured,
 * returns that custom symbol. Otherwise, returns the default currency symbol ($).
 *
 * @param apiConfiguration - The current provider settings
 * @returns The currency symbol to use for cost display
 */
export function getCurrencySymbol(apiConfiguration?: ProviderSettings): string {
	if (
		apiConfiguration?.apiProvider === "litellm" &&
		apiConfiguration.litellmCurrencySymbol !== undefined &&
		apiConfiguration.litellmCurrencySymbol !== ""
	) {
		return apiConfiguration.litellmCurrencySymbol
	}
	return DEFAULT_CURRENCY_SYMBOL
}
