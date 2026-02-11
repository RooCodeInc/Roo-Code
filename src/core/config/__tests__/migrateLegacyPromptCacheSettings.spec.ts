import { migrateLegacyPromptCacheSettings } from "../migrateLegacyPromptCacheSettings"

describe("migrateLegacyPromptCacheSettings", () => {
	it("maps legacy false toggles to provider overrides and removes legacy keys", () => {
		const input = {
			apiProvider: "bedrock",
			awsUsePromptCache: false,
			litellmUsePromptCache: false,
		}

		const result = migrateLegacyPromptCacheSettings(input)

		expect(result.changed).toBe(true)
		expect(result.config).toEqual({
			apiProvider: "bedrock",
			promptCachingProviderOverrides: {
				bedrock: false,
				litellm: false,
			},
		})
	})

	it("does not create overrides for legacy true toggles and still removes legacy keys", () => {
		const input = {
			apiProvider: "bedrock",
			awsUsePromptCache: true,
			litellmUsePromptCache: true,
		}

		const result = migrateLegacyPromptCacheSettings(input)

		expect(result.changed).toBe(true)
		expect(result.config).toEqual({
			apiProvider: "bedrock",
		})
	})

	it("does not overwrite explicit new-format overrides", () => {
		const input = {
			awsUsePromptCache: false,
			promptCachingProviderOverrides: {
				bedrock: true,
			},
		}

		const result = migrateLegacyPromptCacheSettings(input)

		expect(result.changed).toBe(true)
		expect(result.config).toEqual({
			promptCachingProviderOverrides: {
				bedrock: true,
			},
		})
	})

	it("returns unchanged when no legacy keys exist", () => {
		const input = {
			apiProvider: "anthropic",
			promptCachingEnabled: true,
		}

		const result = migrateLegacyPromptCacheSettings(input)

		expect(result.changed).toBe(false)
		expect(result.config).toEqual(input)
	})
})
