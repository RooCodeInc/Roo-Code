import { modelCapabilityPresets } from "../providers/all-model-capabilities.js"
import type { ModelCapabilityPreset } from "../providers/all-model-capabilities.js"

describe("modelCapabilityPresets", () => {
	it("should be a non-empty array", () => {
		expect(Array.isArray(modelCapabilityPresets)).toBe(true)
		expect(modelCapabilityPresets.length).toBeGreaterThan(0)
	})

	it("every preset should have a provider, modelId, and info with required fields", () => {
		for (const preset of modelCapabilityPresets) {
			expect(typeof preset.provider).toBe("string")
			expect(preset.provider.length).toBeGreaterThan(0)

			expect(typeof preset.modelId).toBe("string")
			expect(preset.modelId.length).toBeGreaterThan(0)

			expect(preset.info).toBeDefined()
			expect(typeof preset.info.contextWindow).toBe("number")
			expect(preset.info.contextWindow).toBeGreaterThan(0)
			// supportsPromptCache is a required field in ModelInfo
			expect(typeof preset.info.supportsPromptCache).toBe("boolean")
		}
	})

	it("should include models from multiple providers", () => {
		const providers = new Set(modelCapabilityPresets.map((p: ModelCapabilityPreset) => p.provider))
		expect(providers.size).toBeGreaterThan(5)
	})

	it("should include well-known models", () => {
		const modelIds = modelCapabilityPresets.map((p: ModelCapabilityPreset) => p.modelId)

		// Check for some well-known models
		expect(modelIds.some((id: string) => id.includes("claude"))).toBe(true)
		expect(modelIds.some((id: string) => id.includes("gpt"))).toBe(true)
		expect(modelIds.some((id: string) => id.includes("deepseek"))).toBe(true)
		expect(modelIds.some((id: string) => id.includes("gemini"))).toBe(true)
	})

	it("should have unique provider/modelId combinations", () => {
		const keys = modelCapabilityPresets.map((p: ModelCapabilityPreset) => `${p.provider}/${p.modelId}`)
		const uniqueKeys = new Set(keys)
		expect(uniqueKeys.size).toBe(keys.length)
	})

	it("each preset should include known providers", () => {
		const knownProviders = [
			"Anthropic",
			"OpenAI",
			"DeepSeek",
			"Gemini",
			"MiniMax",
			"Mistral",
			"Moonshot (Kimi)",
			"Qwen",
			"SambaNova",
			"xAI",
			"ZAi (GLM)",
		]

		const providers = new Set(modelCapabilityPresets.map((p: ModelCapabilityPreset) => p.provider))

		for (const known of knownProviders) {
			expect(providers.has(known)).toBe(true)
		}
	})
})
