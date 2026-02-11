import type { ModelMessage } from "ai"

import { applyPromptCacheToMessages, resolvePromptCachePolicy } from "../prompt-cache"

describe("prompt-cache", () => {
	describe("resolvePromptCachePolicy", () => {
		it("defaults to enabled with aggressive strategy", () => {
			const policy = resolvePromptCachePolicy({
				overrideKey: "bedrock",
				supportsPromptCache: true,
			})

			expect(policy).toEqual({
				enabled: true,
				strategy: "aggressive",
			})
		})

		it("uses provider override over global setting", () => {
			const disabledByGlobal = resolvePromptCachePolicy({
				overrideKey: "bedrock",
				supportsPromptCache: true,
				settings: {
					promptCachingEnabled: false,
				},
			})

			expect(disabledByGlobal.enabled).toBe(false)

			const enabledByOverride = resolvePromptCachePolicy({
				overrideKey: "bedrock",
				supportsPromptCache: true,
				settings: {
					promptCachingEnabled: false,
					promptCachingProviderOverrides: {
						bedrock: true,
					},
				},
			})

			expect(enabledByOverride.enabled).toBe(true)

			const disabledByOverride = resolvePromptCachePolicy({
				overrideKey: "bedrock",
				supportsPromptCache: true,
				settings: {
					promptCachingEnabled: true,
					promptCachingProviderOverrides: {
						bedrock: false,
					},
				},
			})

			expect(disabledByOverride.enabled).toBe(false)
		})

		it("disables caching for unsupported models", () => {
			const policy = resolvePromptCachePolicy({
				overrideKey: "anthropic",
				supportsPromptCache: false,
				settings: {
					promptCachingEnabled: true,
				},
			})

			expect(policy.enabled).toBe(false)
		})
	})

	describe("applyPromptCacheToMessages", () => {
		function buildMessages(): ModelMessage[] {
			return [
				{
					role: "user",
					content: [{ type: "text", text: "u1" }],
				},
				{
					role: "assistant",
					content: [{ type: "text", text: "a1" }],
				},
				{
					role: "user",
					content: [{ type: "text", text: "u2" }],
				},
				{
					role: "assistant",
					content: [{ type: "text", text: "a2" }],
				},
				{
					role: "user",
					content: [{ type: "text", text: "u3" }],
				},
			]
		}

		it("applies anthropic strategy and system marker", () => {
			const messages = buildMessages()
			const result = applyPromptCacheToMessages({
				adapter: "anthropic",
				overrideKey: "anthropic",
				messages,
				modelInfo: {
					supportsPromptCache: true,
				},
				settings: {
					promptCachingStrategy: "aggressive",
				},
			})

			expect(result.systemProviderOptions).toEqual({
				anthropic: { cacheControl: { type: "ephemeral" } },
			})
			expect((messages[0] as any).providerOptions).toBeUndefined()
			expect((messages[2] as any).providerOptions).toEqual({
				anthropic: { cacheControl: { type: "ephemeral" } },
			})
			expect((messages[4] as any).providerOptions).toEqual({
				anthropic: { cacheControl: { type: "ephemeral" } },
			})
		})

		it("applies bedrock aggressive checkpoints to last three user messages", () => {
			const messages = buildMessages()
			const result = applyPromptCacheToMessages({
				adapter: "bedrock",
				overrideKey: "bedrock",
				messages,
				modelInfo: {
					supportsPromptCache: true,
				},
				settings: {
					promptCachingStrategy: "aggressive",
				},
			})

			expect(result.systemProviderOptions).toEqual({
				bedrock: { cachePoint: { type: "default" } },
			})
			expect((messages[0] as any).providerOptions).toEqual({
				bedrock: { cachePoint: { type: "default" } },
			})
			expect((messages[2] as any).providerOptions).toEqual({
				bedrock: { cachePoint: { type: "default" } },
			})
			expect((messages[4] as any).providerOptions).toEqual({
				bedrock: { cachePoint: { type: "default" } },
			})
		})

		it("applies balanced strategy with fewer checkpoints", () => {
			const messages = buildMessages()
			applyPromptCacheToMessages({
				adapter: "bedrock",
				overrideKey: "bedrock",
				messages,
				modelInfo: {
					supportsPromptCache: true,
				},
				settings: {
					promptCachingStrategy: "balanced",
				},
			})

			expect((messages[0] as any).providerOptions).toBeUndefined()
			expect((messages[2] as any).providerOptions).toEqual({
				bedrock: { cachePoint: { type: "default" } },
			})
			expect((messages[4] as any).providerOptions).toEqual({
				bedrock: { cachePoint: { type: "default" } },
			})
		})

		it("returns openai retention patch when enabled", () => {
			const messages: ModelMessage[] = []
			const result = applyPromptCacheToMessages({
				adapter: "openai-native",
				overrideKey: "openai-native",
				messages,
				modelInfo: {
					supportsPromptCache: true,
					promptCacheRetention: "24h",
				},
			})

			expect(result.providerOptionsPatch).toEqual({
				openai: {
					promptCacheRetention: "24h",
				},
			})
		})

		it("does not return openai retention patch when globally disabled", () => {
			const result = applyPromptCacheToMessages({
				adapter: "openai-native",
				overrideKey: "openai-native",
				messages: [],
				modelInfo: {
					supportsPromptCache: true,
					promptCacheRetention: "24h",
				},
				settings: {
					promptCachingEnabled: false,
				},
			})

			expect(result.enabled).toBe(false)
			expect(result.providerOptionsPatch).toBeUndefined()
		})
	})
})
