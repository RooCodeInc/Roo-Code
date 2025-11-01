import { describe, expect, it } from "vitest"
import { parseApiPrice, calculateApiCostAnthropic, calculateApiCostOpenAI } from "../cost"
import type { ModelInfo } from "@roo-code/types"

describe("parseApiPrice", () => {
	it("should handle zero as a number", () => {
		expect(parseApiPrice(0)).toBe(0)
	})

	it("should handle zero as a string", () => {
		expect(parseApiPrice("0")).toBe(0)
	})

	it("should handle positive numbers", () => {
		expect(parseApiPrice(0.0002)).toBe(200)
		expect(parseApiPrice(0.00002)).toBe(20)
	})

	it("should handle positive number strings", () => {
		expect(parseApiPrice("0.0002")).toBe(200)
		expect(parseApiPrice("0.00002")).toBe(20)
	})

	it("should return undefined for null", () => {
		expect(parseApiPrice(null)).toBeUndefined()
	})

	it("should return undefined for undefined", () => {
		expect(parseApiPrice(undefined)).toBeUndefined()
	})

	it("should return undefined for empty string", () => {
		expect(parseApiPrice("")).toBeUndefined()
	})
})

describe("calculateApiCostAnthropic", () => {
	const modelInfo: ModelInfo = {
		maxTokens: 4096,
		contextWindow: 200000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 300,
		outputPrice: 1500,
		cacheWritesPrice: 375,
		cacheReadsPrice: 30,
	}

	it("should calculate cost without caching", () => {
		const cost = calculateApiCostAnthropic(modelInfo, 1000, 500)
		expect(cost).toBeCloseTo(0.3 + 0.75, 10)
	})

	it("should calculate cost with cache creation", () => {
		const cost = calculateApiCostAnthropic(modelInfo, 1000, 500, 2000)
		expect(cost).toBeCloseTo(0.3 + 0.75 + 0.75, 10)
	})

	it("should calculate cost with cache reads", () => {
		const cost = calculateApiCostAnthropic(modelInfo, 1000, 500, 0, 3000)
		expect(cost).toBeCloseTo(0.3 + 0.75 + 0.09, 10)
	})

	it("should handle zero cost for free models", () => {
		const freeModel: ModelInfo = {
			maxTokens: 4096,
			contextWindow: 200000,
			supportsImages: false,
			supportsPromptCache: false,
			inputPrice: 0,
			outputPrice: 0,
		}
		const cost = calculateApiCostAnthropic(freeModel, 1000, 500)
		expect(cost).toBe(0)
	})
})

describe("calculateApiCostOpenAI", () => {
	const modelInfo: ModelInfo = {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 150,
		outputPrice: 600,
		cacheWritesPrice: 187.5,
		cacheReadsPrice: 15,
	}

	it("should calculate cost without caching", () => {
		const cost = calculateApiCostOpenAI(modelInfo, 1000, 500)
		expect(cost).toBeCloseTo(0.15 + 0.3, 10)
	})

	it("should subtract cached tokens from input tokens", () => {
		const cost = calculateApiCostOpenAI(modelInfo, 5000, 500, 2000, 1000)
		// 5000 total - 2000 cache creation - 1000 cache read = 2000 non-cached
		// Cost: (2000 * 0.00015) + (2000 * 0.0001875) + (1000 * 0.000015) + (500 * 0.0006)
		expect(cost).toBeCloseTo(0.3 + 0.375 + 0.015 + 0.3, 10)
	})

	it("should handle zero cost for free models", () => {
		const freeModel: ModelInfo = {
			maxTokens: 4096,
			contextWindow: 128000,
			supportsImages: false,
			supportsPromptCache: false,
			inputPrice: 0,
			outputPrice: 0,
		}
		const cost = calculateApiCostOpenAI(freeModel, 1000, 500)
		expect(cost).toBe(0)
	})
})
