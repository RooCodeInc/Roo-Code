// npx vitest run src/api/providers/__tests__/vertex-tiered-pricing.spec.ts

import { type ModelInfo, vertexModels } from "@roo-code/types"
import { VertexHandler } from "../vertex"

describe("VertexHandler Tiered Pricing", () => {
	let handler: VertexHandler

	beforeEach(() => {
		handler = new VertexHandler({
			apiModelId: "gemini-2.5-pro",
			vertexProjectId: "test-project",
			vertexRegion: "us-central1",
		})
	})

	describe("calculateCost with tiered pricing", () => {
		it("should apply lower tier pricing for tokens under 200K", () => {
			const modelInfo = handler.getModel()
			const inputTokens = 100_000 // Under 200K threshold
			const outputTokens = 50_000

			// According to the tiers in vertex.ts for gemini-2.5-pro:
			// First tier (up to 200K): input $1.25/M, output $10/M
			const expectedInputCost = (inputTokens / 1_000_000) * 1.25
			const expectedOutputCost = (outputTokens / 1_000_000) * 10
			const expectedTotalCost = expectedInputCost + expectedOutputCost

			const cost = handler.calculateCost({
				info: modelInfo.info,
				inputTokens,
				outputTokens,
			})

			expect(cost).toBeCloseTo(expectedTotalCost, 6)
			// Verify it's using tier 1 pricing, not the default higher pricing
			expect(cost).toBeLessThan((inputTokens / 1_000_000) * 2.5 + (outputTokens / 1_000_000) * 15)
		})

		it("should apply higher tier pricing for tokens over 200K", () => {
			const modelInfo = handler.getModel()
			const inputTokens = 300_000 // Over 200K threshold
			const outputTokens = 100_000

			// According to the tiers in vertex.ts for gemini-2.5-pro:
			// Second tier (over 200K): input $2.5/M, output $15/M
			const expectedInputCost = (inputTokens / 1_000_000) * 2.5
			const expectedOutputCost = (outputTokens / 1_000_000) * 15
			const expectedTotalCost = expectedInputCost + expectedOutputCost

			const cost = handler.calculateCost({
				info: modelInfo.info,
				inputTokens,
				outputTokens,
			})

			expect(cost).toBeCloseTo(expectedTotalCost, 6)
		})

		it("should apply cache read pricing based on tier", () => {
			const modelInfo = handler.getModel()
			const inputTokens = 150_000 // Under 200K - should use tier 1
			const outputTokens = 50_000
			const cacheReadTokens = 100_000

			// First tier cache reads: $0.31/M
			const uncachedInputTokens = inputTokens - cacheReadTokens
			const expectedInputCost = (uncachedInputTokens / 1_000_000) * 1.25
			const expectedOutputCost = (outputTokens / 1_000_000) * 10
			const expectedCacheReadCost = (cacheReadTokens / 1_000_000) * 0.31
			const expectedTotalCost = expectedInputCost + expectedOutputCost + expectedCacheReadCost

			const cost = handler.calculateCost({
				info: modelInfo.info,
				inputTokens,
				outputTokens,
				cacheReadTokens,
			})

			expect(cost).toBeCloseTo(expectedTotalCost, 6)
		})

		it("should apply cache read pricing for higher tier", () => {
			const modelInfo = handler.getModel()
			const inputTokens = 400_000 // Over 200K - should use tier 2
			const outputTokens = 100_000
			const cacheReadTokens = 200_000

			// Second tier cache reads: $0.625/M
			const uncachedInputTokens = inputTokens - cacheReadTokens
			const expectedInputCost = (uncachedInputTokens / 1_000_000) * 2.5
			const expectedOutputCost = (outputTokens / 1_000_000) * 15
			const expectedCacheReadCost = (cacheReadTokens / 1_000_000) * 0.625
			const expectedTotalCost = expectedInputCost + expectedOutputCost + expectedCacheReadCost

			const cost = handler.calculateCost({
				info: modelInfo.info,
				inputTokens,
				outputTokens,
				cacheReadTokens,
			})

			expect(cost).toBeCloseTo(expectedTotalCost, 6)
		})

		it("should return model info with tiers property", () => {
			const modelInfo = handler.getModel()

			// Verify the model info has tiers defined
			expect(modelInfo.info.tiers).toBeDefined()
			expect(modelInfo.info.tiers).toHaveLength(2)

			// Verify tier 1 (up to 200K)
			expect(modelInfo.info.tiers![0].contextWindow).toBe(200_000)
			expect(modelInfo.info.tiers![0].inputPrice).toBe(1.25)
			expect(modelInfo.info.tiers![0].outputPrice).toBe(10)
			expect(modelInfo.info.tiers![0].cacheReadsPrice).toBe(0.31)

			// Verify tier 2 (over 200K)
			expect(modelInfo.info.tiers![1].contextWindow).toBe(Infinity)
			expect(modelInfo.info.tiers![1].inputPrice).toBe(2.5)
			expect(modelInfo.info.tiers![1].outputPrice).toBe(15)
			expect(modelInfo.info.tiers![1].cacheReadsPrice).toBe(0.625)
		})
	})

	describe("models without tiered pricing", () => {
		it("should use flat pricing for models without tiers", () => {
			const handlerFlat = new VertexHandler({
				apiModelId: "gemini-2.5-flash",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const modelInfo = handlerFlat.getModel()
			const inputTokens = 100_000
			const outputTokens = 50_000

			// gemini-2.5-flash has flat pricing: input $0.3/M, output $2.5/M
			const expectedInputCost = (inputTokens / 1_000_000) * 0.3
			const expectedOutputCost = (outputTokens / 1_000_000) * 2.5
			const expectedTotalCost = expectedInputCost + expectedOutputCost

			const cost = handlerFlat.calculateCost({
				info: modelInfo.info,
				inputTokens,
				outputTokens,
			})

			expect(cost).toBeCloseTo(expectedTotalCost, 6)
			expect(modelInfo.info.tiers).toBeUndefined()
		})
	})
})
