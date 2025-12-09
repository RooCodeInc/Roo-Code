import type { ProviderSettings, OrganizationAllowList } from "@roo-code/types"

import { RouterModels } from "@roo/api"

import { getModelValidationError, validateApiConfigurationExcludingModelErrors } from "../validate"

// Mock i18next
vi.mock("i18next", () => ({
	default: {
		t: vi.fn((key: string, options?: any) => {
			// Return the key as-is for testing (this matches what the actual code expects)
			if (options?.modelId) {
				return key // For validation.modelAvailability, just return the key
			}
			return key
		}),
		language: "en",
	},
}))

describe("Model Validation Functions", () => {
	const mockRouterModels: RouterModels = {
		openrouter: {
			"valid-model": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: false,
				inputPrice: 3.0,
				outputPrice: 15.0,
			},
			"another-valid-model": {
				maxTokens: 4096,
				contextWindow: 100000,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 1.0,
				outputPrice: 5.0,
			},
		},
		glama: {
			"valid-model": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: false,
				inputPrice: 3.0,
				outputPrice: 15.0,
			},
		},
		requesty: {},
		unbound: {},
		litellm: {},
		ollama: {},
		lmstudio: {},
		deepinfra: {},
		"io-intelligence": {},
		"vercel-ai-gateway": {},
		huggingface: {},
		roo: {},
		chutes: {},
	}

	// Mock router models with many models (>10) to trigger validation
	const mockRouterModelsWithManyModels: RouterModels = {
		...mockRouterModels,
		openrouter: {
			...mockRouterModels.openrouter,
			"model-1": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
			"model-2": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
			"model-3": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
			"model-4": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
			"model-5": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
			"model-6": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
			"model-7": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
			"model-8": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
			"model-9": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
			"model-10": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
			"model-11": { maxTokens: 1000, contextWindow: 10000, supportsImages: false, supportsPromptCache: false },
		},
	}

	const allowAllOrganization: OrganizationAllowList = {
		allowAll: true,
		providers: {},
	}

	const restrictiveOrganization: OrganizationAllowList = {
		allowAll: false,
		providers: {
			openrouter: {
				allowAll: false,
				models: ["valid-model"],
			},
		},
	}

	describe("getModelValidationError", () => {
		it("returns undefined for valid OpenRouter model", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "valid-model",
			}

			const result = getModelValidationError(config, mockRouterModels, allowAllOrganization)
			expect(result).toBeUndefined()
		})

		it("returns error for invalid OpenRouter model when model list has many models", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "invalid-model",
			}

			// Should return error when we have many models (>10) in cache
			const result = getModelValidationError(config, mockRouterModelsWithManyModels, allowAllOrganization)
			expect(result).toBe("settings:validation.modelAvailability")
		})

		it("allows newer OpenRouter models like gpt-5.1 even when not in cache", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "openai/gpt-5.1",
			}

			// Should allow gpt-5.1 even when not in the model list
			const result = getModelValidationError(config, mockRouterModelsWithManyModels, allowAllOrganization)
			expect(result).toBeUndefined()
		})

		it("allows newer OpenRouter models like gemini-3-pro-preview even when not in cache", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "google/gemini-3-pro-preview",
			}

			// Should allow gemini-3 models even when not in the model list
			const result = getModelValidationError(config, mockRouterModelsWithManyModels, allowAllOrganization)
			expect(result).toBeUndefined()
		})

		it("allows newer OpenRouter models like grok-4.1-fast:free even when not in cache", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "x-ai/grok-4.1-fast:free",
			}

			// Should allow grok-4 models even when not in the model list
			const result = getModelValidationError(config, mockRouterModelsWithManyModels, allowAllOrganization)
			expect(result).toBeUndefined()
		})

		it("allows known pattern models for OpenRouter even when not in cache", () => {
			const testCases = [
				"openai/gpt-5",
				"openai/gpt-5.2",
				"google/gemini-4",
				"x-ai/grok-5",
				"anthropic/claude-4-opus",
				"meta-llama/llama-4",
				"mistralai/mistral-large-2",
			]

			testCases.forEach((modelId) => {
				const config: ProviderSettings = {
					apiProvider: "openrouter",
					openRouterModelId: modelId,
				}

				const result = getModelValidationError(config, mockRouterModelsWithManyModels, allowAllOrganization)
				expect(result).toBeUndefined()
			})
		})

		it("still validates unknown pattern models for OpenRouter", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "unknown-provider/unknown-model",
			}

			// Should still validate models that don't match known patterns
			const result = getModelValidationError(config, mockRouterModelsWithManyModels, allowAllOrganization)
			expect(result).toBe("settings:validation.modelAvailability")
		})

		it("does not validate when model list is small (<=10 models)", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "any-model-id",
			}

			// Should not validate when we have few models in cache (initial state)
			const result = getModelValidationError(config, mockRouterModels, allowAllOrganization)
			expect(result).toBeUndefined()
		})

		it("returns error for model not allowed by organization", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "another-valid-model",
			}

			const result = getModelValidationError(config, mockRouterModels, restrictiveOrganization)
			expect(result).toContain("model")
		})

		it("returns undefined for valid Glama model", () => {
			const config: ProviderSettings = {
				apiProvider: "glama",
				glamaModelId: "valid-model",
			}

			const result = getModelValidationError(config, mockRouterModels, allowAllOrganization)
			expect(result).toBeUndefined()
		})

		it("returns error for invalid Glama model", () => {
			const config: ProviderSettings = {
				apiProvider: "glama",
				glamaModelId: "invalid-model",
			}

			const result = getModelValidationError(config, mockRouterModels, allowAllOrganization)
			expect(result).toBeUndefined()
		})

		it("returns undefined for OpenAI models when no router models provided", () => {
			const config: ProviderSettings = {
				apiProvider: "openai",
				openAiModelId: "gpt-4",
			}

			const result = getModelValidationError(config, undefined, allowAllOrganization)
			expect(result).toBeUndefined()
		})

		it("handles empty model IDs gracefully", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "",
			}

			const result = getModelValidationError(config, mockRouterModels, allowAllOrganization)
			expect(result).toBe("settings:validation.modelId")
		})

		it("handles undefined model IDs gracefully", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				// openRouterModelId is undefined
			}

			const result = getModelValidationError(config, mockRouterModels, allowAllOrganization)
			expect(result).toBe("settings:validation.modelId")
		})
	})

	describe("validateApiConfigurationExcludingModelErrors", () => {
		it("returns undefined when configuration is valid", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterApiKey: "valid-key",
				openRouterModelId: "valid-model",
			}

			const result = validateApiConfigurationExcludingModelErrors(config, mockRouterModels, allowAllOrganization)
			expect(result).toBeUndefined()
		})

		it("returns error for missing API key", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "valid-model",
				// Missing openRouterApiKey
			}

			const result = validateApiConfigurationExcludingModelErrors(config, mockRouterModels, allowAllOrganization)
			expect(result).toBe("settings:validation.apiKey")
		})

		it("excludes model-specific errors", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterApiKey: "valid-key",
				openRouterModelId: "invalid-model", // This should be ignored
			}

			const result = validateApiConfigurationExcludingModelErrors(config, mockRouterModels, allowAllOrganization)
			expect(result).toBeUndefined() // Should not return model validation error
		})

		it("excludes model-specific organization errors", () => {
			const config: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterApiKey: "valid-key",
				openRouterModelId: "another-valid-model", // Not allowed by restrictive org
			}

			const result = validateApiConfigurationExcludingModelErrors(
				config,
				mockRouterModels,
				restrictiveOrganization,
			)
			expect(result).toBeUndefined() // Should exclude model-specific org errors
		})

		it("returns undefined for valid IO Intelligence model", () => {
			const config: ProviderSettings = {
				apiProvider: "io-intelligence",
				ioIntelligenceModelId: "valid-model",
			}

			const result = getModelValidationError(config, mockRouterModels, allowAllOrganization)
			expect(result).toBeUndefined()
		})

		it("returns error for invalid IO Intelligence model", () => {
			const config: ProviderSettings = {
				apiProvider: "io-intelligence",
				ioIntelligenceModelId: "invalid-model",
			}

			const result = getModelValidationError(config, mockRouterModels, allowAllOrganization)
			expect(result).toBeUndefined()
		})
	})
})
