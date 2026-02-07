import type { ModelInfo } from "../model.js"
import { azureModels, azureDefaultModelId, azureDefaultModelInfo } from "../providers/azure.js"

// Object.entries loses the per-key literal types from `as const satisfies`,
// so we cast each value back to ModelInfo to access optional properties.
const modelEntries = Object.entries(azureModels) as [string, ModelInfo][]

describe("Azure model definitions", () => {
	it("all models have required ModelInfo fields with valid values", () => {
		for (const [id, info] of modelEntries) {
			expect(info.maxTokens, `${id} maxTokens`).toBeGreaterThan(0)
			expect(info.contextWindow, `${id} contextWindow`).toBeGreaterThan(0)
			expect(typeof info.supportsImages, `${id} supportsImages`).toBe("boolean")
			expect(typeof info.supportsPromptCache, `${id} supportsPromptCache`).toBe("boolean")
			expect(info.inputPrice, `${id} inputPrice`).toBeGreaterThanOrEqual(0)
			expect(info.outputPrice, `${id} outputPrice`).toBeGreaterThanOrEqual(0)
		}
	})

	it("default model ID exists in model map", () => {
		expect(azureModels[azureDefaultModelId]).toBeDefined()
	})

	it("default model info matches the default model ID entry", () => {
		expect(azureDefaultModelInfo).toBe(azureModels[azureDefaultModelId])
	})

	it("models with supportsReasoningEffort have a valid reasoningEffort default", () => {
		for (const [id, info] of modelEntries) {
			if (Array.isArray(info.supportsReasoningEffort)) {
				expect(info.reasoningEffort, `${id} missing reasoningEffort default`).toBeDefined()
				expect(
					info.supportsReasoningEffort,
					`${id} reasoningEffort not in supportsReasoningEffort array`,
				).toContain(info.reasoningEffort)
			}
		}
	})

	it("models claiming prompt cache support have cacheReadsPrice defined", () => {
		for (const [id, info] of modelEntries) {
			if (info.supportsPromptCache) {
				// Azure models with cache support define cacheReadsPrice but not
				// cacheWritesPrice — Azure does not charge separately for cache writes.
				expect(info.cacheReadsPrice, `${id} supports cache but missing cacheReadsPrice`).toBeDefined()
			}
		}
	})

	it("maxTokens never exceeds contextWindow for any model", () => {
		for (const [id, info] of modelEntries) {
			expect(
				info.maxTokens,
				`${id} maxTokens (${info.maxTokens}) exceeds contextWindow (${info.contextWindow})`,
			).toBeLessThanOrEqual(info.contextWindow)
		}
	})
})
