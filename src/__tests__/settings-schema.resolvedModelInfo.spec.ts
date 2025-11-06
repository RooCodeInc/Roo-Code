import { providerSettingsSchema, type ProviderSettings, type ModelInfo, PROVIDER_SETTINGS_KEYS } from "@roo-code/types"

describe("ProviderSettings schema resolvedModelInfo", () => {
	it("accepts and preserves resolvedModelInfo", () => {
		const resolved: ModelInfo = {
			contextWindow: 16384,
			supportsPromptCache: true,
			maxTokens: 8192,
		}

		const input: ProviderSettings = {
			apiProvider: "openrouter",
			openRouterModelId: "openrouter/some-model",
			resolvedModelInfo: resolved,
		}

		const parsed = providerSettingsSchema.parse(input)
		expect(parsed.resolvedModelInfo).toEqual(resolved)
	})

	it("includes resolvedModelInfo in PROVIDER_SETTINGS_KEYS", () => {
		expect(PROVIDER_SETTINGS_KEYS).toContain("resolvedModelInfo")
	})
})
