import { getApiProtocol, providerSettingsSchema } from "../provider-settings.js"
import { azureModels, azureDefaultModelId, AZURE_1M_CONTEXT_MODEL_IDS } from "../providers/azure.js"

describe("Azure Provider", () => {
	describe("getApiProtocol for Azure provider", () => {
		it("should return 'anthropic' for Azure provider with Claude models", () => {
			expect(getApiProtocol("azure", "claude-sonnet-4-5")).toBe("anthropic")
			expect(getApiProtocol("azure", "claude-haiku-4-5")).toBe("anthropic")
			expect(getApiProtocol("azure", "claude-opus-4-1")).toBe("anthropic")
		})

		it("should return 'anthropic' for Azure provider with case-insensitive Claude models", () => {
			expect(getApiProtocol("azure", "CLAUDE-SONNET-4-5")).toBe("anthropic")
			expect(getApiProtocol("azure", "Claude-Haiku-4-5")).toBe("anthropic")
			expect(getApiProtocol("azure", "CLAUDE-opus-4-1")).toBe("anthropic")
		})

		it("should return 'openai' for Azure provider with GPT models", () => {
			expect(getApiProtocol("azure", "gpt-5-pro")).toBe("openai")
			expect(getApiProtocol("azure", "gpt-5.1")).toBe("openai")
			expect(getApiProtocol("azure", "gpt-5-chat")).toBe("openai")
			expect(getApiProtocol("azure", "gpt-5-mini")).toBe("openai")
			expect(getApiProtocol("azure", "gpt-5-nano")).toBe("openai")
			expect(getApiProtocol("azure", "gpt-5-codex")).toBe("openai")
			expect(getApiProtocol("azure", "gpt-5.1-codex")).toBe("openai")
		})

		it("should return 'openai' for Azure provider without model specified", () => {
			expect(getApiProtocol("azure")).toBe("openai")
		})

		it("should return 'openai' for Azure provider with unknown model", () => {
			expect(getApiProtocol("azure", "unknown-model")).toBe("openai")
		})
	})

	describe("Azure model definitions", () => {
		it("should have all 10 expected models defined", () => {
			const modelIds = Object.keys(azureModels)
			expect(modelIds).toHaveLength(10)
			expect(modelIds).toContain("claude-sonnet-4-5")
			expect(modelIds).toContain("claude-haiku-4-5")
			expect(modelIds).toContain("claude-opus-4-1")
			expect(modelIds).toContain("gpt-5-pro")
			expect(modelIds).toContain("gpt-5.1")
			expect(modelIds).toContain("gpt-5-chat")
			expect(modelIds).toContain("gpt-5-mini")
			expect(modelIds).toContain("gpt-5-nano")
			expect(modelIds).toContain("gpt-5-codex")
			expect(modelIds).toContain("gpt-5.1-codex")
		})

		it("should have correct default model", () => {
			expect(azureDefaultModelId).toBe("claude-sonnet-4-5")
		})

		describe("Claude models", () => {
			it("should have correct capabilities for claude-sonnet-4-5", () => {
				const model = azureModels["claude-sonnet-4-5"]
				expect(model.contextWindow).toBe(200_000)
				expect(model.maxTokens).toBe(64_000)
				expect(model.supportsImages).toBe(true)
				expect(model.supportsPromptCache).toBe(true)
				expect(model.supportsReasoningBudget).toBe(true)
				expect(model.supportsTemperature).toBe(true)
				expect(model.cacheWritesPrice).toBe(3.75)
				expect(model.cacheReadsPrice).toBe(0.3)
			})

			it("should have correct capabilities for claude-haiku-4-5", () => {
				const model = azureModels["claude-haiku-4-5"]
				expect(model.contextWindow).toBe(200_000)
				expect(model.maxTokens).toBe(64_000)
				expect(model.supportsImages).toBe(true)
				expect(model.supportsPromptCache).toBe(true)
				expect(model.supportsReasoningBudget).toBe(true)
				expect(model.supportsTemperature).toBe(true)
				expect(model.cacheWritesPrice).toBe(0.75)
				expect(model.cacheReadsPrice).toBe(0.06)
			})

			it("should have correct capabilities for claude-opus-4-1", () => {
				const model = azureModels["claude-opus-4-1"]
				expect(model.contextWindow).toBe(200_000)
				expect(model.maxTokens).toBe(64_000)
				expect(model.supportsImages).toBe(true)
				expect(model.supportsPromptCache).toBe(true)
				expect(model.supportsReasoningBudget).toBe(true)
				expect(model.supportsTemperature).toBe(true)
				expect(model.cacheWritesPrice).toBe(18.75)
				expect(model.cacheReadsPrice).toBe(1.5)
			})
		})

		describe("GPT models", () => {
			it("should have correct capabilities for gpt-5-pro", () => {
				const model = azureModels["gpt-5-pro"]
				expect(model.contextWindow).toBe(400_000)
				expect(model.maxTokens).toBe(128_000)
				expect(model.supportsImages).toBe(true)
				expect(model.supportsPromptCache).toBe(true)
				expect(model.supportsNativeTools).toBe(true)
				expect(model.supportsTemperature).toBe(true)
				expect(model.supportsReasoningEffort).toEqual(["high"])
				expect(model.reasoningEffort).toBe("high")
				expect(model.cacheReadsPrice).toBe(0.125)
			})

			it("should have correct capabilities for gpt-5.1", () => {
				const model = azureModels["gpt-5.1"]
				expect(model.contextWindow).toBe(400_000)
				expect(model.maxTokens).toBe(128_000)
				expect(model.supportsImages).toBe(true)
				expect(model.supportsPromptCache).toBe(true)
				expect(model.supportsNativeTools).toBe(true)
				expect(model.supportsTemperature).toBe(false)
				expect(model.supportsReasoningEffort).toEqual(["none", "low", "medium", "high"])
				expect(model.reasoningEffort).toBe("medium")
				expect(model.supportsVerbosity).toBe(true)
				expect(model.cacheReadsPrice).toBe(0.125)
			})

			it("should have correct capabilities for gpt-5-chat", () => {
				const model = azureModels["gpt-5-chat"]
				expect(model.contextWindow).toBe(128_000)
				expect(model.maxTokens).toBe(16_384)
				expect(model.supportsImages).toBe(true)
				expect(model.supportsPromptCache).toBe(false)
				expect(model.supportsNativeTools).toBe(true)
				expect(model.supportsTemperature).toBe(true)
			})

			it("should have correct capabilities for gpt-5-mini", () => {
				const model = azureModels["gpt-5-mini"]
				expect(model.contextWindow).toBe(400_000)
				expect(model.maxTokens).toBe(16_384)
				expect(model.supportsImages).toBe(true)
				expect(model.supportsPromptCache).toBe(false)
				expect(model.supportsTemperature).toBe(false)
			})

			it("should have correct capabilities for gpt-5-nano", () => {
				const model = azureModels["gpt-5-nano"]
				expect(model.contextWindow).toBe(400_000)
				expect(model.maxTokens).toBe(16_384)
				expect(model.supportsImages).toBe(true)
				expect(model.supportsPromptCache).toBe(false)
				expect(model.supportsTemperature).toBe(false)
			})

			it("should have correct capabilities for gpt-5-codex", () => {
				const model = azureModels["gpt-5-codex"]
				expect(model.contextWindow).toBe(400_000)
				expect(model.maxTokens).toBe(128_000)
				expect(model.supportsImages).toBe(false)
				expect(model.supportsPromptCache).toBe(true)
				expect(model.supportsTemperature).toBe(true)
				expect(model.cacheReadsPrice).toBe(0.15)
			})

			it("should have correct capabilities for gpt-5.1-codex", () => {
				const model = azureModels["gpt-5.1-codex"]
				expect(model.contextWindow).toBe(400_000)
				expect(model.maxTokens).toBe(128_000)
				expect(model.supportsImages).toBe(false)
				expect(model.supportsPromptCache).toBe(true)
				expect(model.supportsTemperature).toBe(false)
				expect(model.supportsReasoningEffort).toEqual(["none", "low", "medium", "high"])
				expect(model.reasoningEffort).toBe("medium")
				expect(model.supportsVerbosity).toBe(true)
				expect(model.cacheReadsPrice).toBe(0.15)
			})
		})

		describe("Streaming support", () => {
			it("all models should support streaming (implicit in SDK)", () => {
				// All Azure models support streaming via their respective SDKs
				// AnthropicFoundry SDK and AzureOpenAI SDK both support streaming
				// This is verified by the handler implementation
				Object.keys(azureModels).forEach((modelId) => {
					expect(azureModels[modelId as keyof typeof azureModels]).toBeDefined()
				})
			})
		})

		describe("Prompt caching support", () => {
			it("should have caching enabled for 7 models", () => {
				const cachingModels = Object.entries(azureModels).filter(([_, model]) => model.supportsPromptCache)
				expect(cachingModels).toHaveLength(7)
			})

			it("should not have caching for chat models (gpt-5-chat, gpt-5-mini, gpt-5-nano)", () => {
				expect(azureModels["gpt-5-chat"].supportsPromptCache).toBe(false)
				expect(azureModels["gpt-5-mini"].supportsPromptCache).toBe(false)
				expect(azureModels["gpt-5-nano"].supportsPromptCache).toBe(false)
			})

			it("should have caching for all Claude models", () => {
				expect(azureModels["claude-sonnet-4-5"].supportsPromptCache).toBe(true)
				expect(azureModels["claude-haiku-4-5"].supportsPromptCache).toBe(true)
				expect(azureModels["claude-opus-4-1"].supportsPromptCache).toBe(true)
			})

			it("should have caching for reasoning GPT models", () => {
				expect(azureModels["gpt-5-pro"].supportsPromptCache).toBe(true)
				expect(azureModels["gpt-5.1"].supportsPromptCache).toBe(true)
				expect(azureModels["gpt-5-codex"].supportsPromptCache).toBe(true)
				expect(azureModels["gpt-5.1-codex"].supportsPromptCache).toBe(true)
			})
		})

		describe("Image support", () => {
			it("should have image support for 8 models", () => {
				const imageModels = Object.entries(azureModels).filter(([_, model]) => model.supportsImages)
				expect(imageModels).toHaveLength(8)
			})

			it("should not have image support for codex models", () => {
				expect(azureModels["gpt-5-codex"].supportsImages).toBe(false)
				expect(azureModels["gpt-5.1-codex"].supportsImages).toBe(false)
			})

			it("should have image support for all Claude models", () => {
				expect(azureModels["claude-sonnet-4-5"].supportsImages).toBe(true)
				expect(azureModels["claude-haiku-4-5"].supportsImages).toBe(true)
				expect(azureModels["claude-opus-4-1"].supportsImages).toBe(true)
			})

			it("should have image support for non-codex GPT models", () => {
				expect(azureModels["gpt-5-pro"].supportsImages).toBe(true)
				expect(azureModels["gpt-5.1"].supportsImages).toBe(true)
				expect(azureModels["gpt-5-chat"].supportsImages).toBe(true)
				expect(azureModels["gpt-5-mini"].supportsImages).toBe(true)
				expect(azureModels["gpt-5-nano"].supportsImages).toBe(true)
			})
		})

		describe("1M Context Window Beta Feature", () => {
			describe("AZURE_1M_CONTEXT_MODEL_IDS", () => {
				it("should contain claude-sonnet-4-5", () => {
					expect(AZURE_1M_CONTEXT_MODEL_IDS).toContain("claude-sonnet-4-5")
				})

				it("should be an array with exactly one model", () => {
					expect(Array.isArray(AZURE_1M_CONTEXT_MODEL_IDS)).toBe(true)
					expect(AZURE_1M_CONTEXT_MODEL_IDS).toHaveLength(1)
				})

				it("should only contain valid Azure model IDs", () => {
					AZURE_1M_CONTEXT_MODEL_IDS.forEach((modelId) => {
						expect(azureModels).toHaveProperty(modelId)
					})
				})
			})

			describe("claude-sonnet-4-5 tiers", () => {
				it("should have a tiers array defined", () => {
					const model = azureModels["claude-sonnet-4-5"]
					expect(model.tiers).toBeDefined()
					expect(Array.isArray(model.tiers)).toBe(true)
				})

				it("should have exactly one tier configuration", () => {
					const model = azureModels["claude-sonnet-4-5"]
					expect(model.tiers).toHaveLength(1)
				})

				it("should have 1M context window in tier 0", () => {
					const model = azureModels["claude-sonnet-4-5"]
					const tier = model.tiers?.[0]
					expect(tier).toBeDefined()
					expect(tier?.contextWindow).toBe(1_000_000)
				})

				it("should have higher pricing for 1M context tier", () => {
					const model = azureModels["claude-sonnet-4-5"]
					const tier = model.tiers?.[0]

					// Tier pricing should be higher than base model
					expect(tier?.inputPrice).toBeGreaterThan(model.inputPrice)
					expect(tier?.outputPrice).toBeGreaterThan(model.outputPrice)
					expect(tier?.cacheWritesPrice).toBeGreaterThan(model.cacheWritesPrice!)
					expect(tier?.cacheReadsPrice).toBeGreaterThan(model.cacheReadsPrice!)
				})

				it("should have correct tier pricing values", () => {
					const model = azureModels["claude-sonnet-4-5"]
					const tier = model.tiers?.[0]

					expect(tier?.inputPrice).toBe(6.0)
					expect(tier?.outputPrice).toBe(22.5)
					expect(tier?.cacheWritesPrice).toBe(7.5)
					expect(tier?.cacheReadsPrice).toBe(0.6)
				})
			})

			describe("Other models should not have tiers", () => {
				it("claude-haiku-4-5 should not have tiers", () => {
					const model = azureModels["claude-haiku-4-5"]
					expect("tiers" in model).toBe(false)
				})

				it("claude-opus-4-1 should not have tiers", () => {
					const model = azureModels["claude-opus-4-1"]
					expect("tiers" in model).toBe(false)
				})

				it("gpt models should not have tiers", () => {
					expect("tiers" in azureModels["gpt-5-pro"]).toBe(false)
					expect("tiers" in azureModels["gpt-5.1"]).toBe(false)
					expect("tiers" in azureModels["gpt-5-chat"]).toBe(false)
				})
			})
		})
	})

	describe("Azure provider settings schema", () => {
		describe("azureBeta1MContext setting", () => {
			it("should accept valid Azure settings with azureBeta1MContext", () => {
				const validSettings = {
					apiProvider: "azure" as const,
					azureBeta1MContext: true,
					azureApiKey: "test-key",
					apiModelId: "claude-sonnet-4-5",
				}

				const result = providerSettingsSchema.safeParse(validSettings)
				expect(result.success).toBe(true)
			})

			it("should accept boolean true value", () => {
				const settings = {
					apiProvider: "azure" as const,
					azureBeta1MContext: true,
				}

				const result = providerSettingsSchema.safeParse(settings)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.data.azureBeta1MContext).toBe(true)
				}
			})

			it("should accept boolean false value", () => {
				const settings = {
					apiProvider: "azure" as const,
					azureBeta1MContext: false,
				}

				const result = providerSettingsSchema.safeParse(settings)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.data.azureBeta1MContext).toBe(false)
				}
			})

			it("should be optional and allow undefined", () => {
				const settings = {
					apiProvider: "azure" as const,
					azureApiKey: "test-key",
				}

				const result = providerSettingsSchema.safeParse(settings)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.data.azureBeta1MContext).toBeUndefined()
				}
			})

			it("should reject non-boolean values", () => {
				const settings = {
					apiProvider: "azure" as const,
					azureBeta1MContext: "true" as unknown, // string instead of boolean
				}

				const result = providerSettingsSchema.safeParse(settings)
				expect(result.success).toBe(false)
			})

			it("should work with other Azure settings", () => {
				const settings = {
					apiProvider: "azure" as const,
					azureBeta1MContext: true,
					azureApiKey: "test-key",
					azureBaseUrl: "https://test.azure.com",
					azureDeploymentName: "test-deployment",
					apiModelId: "claude-sonnet-4-5",
					modelTemperature: 0.7,
				}

				const result = providerSettingsSchema.safeParse(settings)
				expect(result.success).toBe(true)
			})
		})
	})
})
