import { describe, it, expect, beforeEach } from "vitest"
import {
	RelevanceRanker,
	ContextItem,
	UserContext,
	createRelevanceRanker,
} from "../relevance-ranker"

describe("RelevanceRanker", () => {
	let ranker: RelevanceRanker

	beforeEach(() => {
		ranker = createRelevanceRanker()
	})

	describe("rankContextItems", () => {
		it("should rank items by relevance score", async () => {
			const items: ContextItem[] = [
				{
					type: "code" as any,
					content: "function add(a, b) { return a + b }",
					source: "/test/math.ts",
				},
				{
					type: "code" as any,
					content: "class Calculator { add(a, b) { return a + b } }",
					source: "/test/calculator.ts",
				},
			]

			const userContext: UserContext = {
				currentFile: "/test/math.ts",
			}

			const ranked = await ranker.rankContextItems(items, "add function", userContext)

			expect(ranked.length).toBe(2)
			expect(ranked[0].rank).toBe(1)
			expect(ranked[1].rank).toBe(2)
			expect(ranked[0].totalScore).toBeGreaterThanOrEqual(ranked[1].totalScore)
		})

		it("should include score breakdown", async () => {
			const items: ContextItem[] = [
				{
					type: "code" as any,
					content: "test code",
					source: "/test.ts",
				},
			]

			const userContext: UserContext = {}

			const ranked = await ranker.rankContextItems(items, "test", userContext)

			expect(ranked.length).toBe(1)
			expect(ranked[0].breakdown).toBeDefined()
			expect(typeof ranked[0].breakdown.semantic).toBe("number")
			expect(typeof ranked[0].breakdown.proximity).toBe("number")
			expect(typeof ranked[0].breakdown.recency).toBe("number")
			expect(typeof ranked[0].breakdown.dependency).toBe("number")
			expect(typeof ranked[0].breakdown.historical).toBe("number")
			expect(typeof ranked[0].breakdown.preference).toBe("number")
		})

		it("should handle empty items list", async () => {
			const ranked = await ranker.rankContextItems([], "test", {})

			expect(ranked).toEqual([])
		})

		it("should assign correct ranks", async () => {
			const items: ContextItem[] = [
				{ type: "code" as any, content: "low relevance", source: "/low.ts" },
				{ type: "code" as any, content: "high relevance test", source: "/high.ts" },
				{ type: "code" as any, content: "medium relevance", source: "/medium.ts" },
			]

			const ranked = await ranker.rankContextItems(items, "test", {})

			expect(ranked[0].rank).toBe(1)
			expect(ranked[1].rank).toBe(2)
			expect(ranked[2].rank).toBe(3)
			expect(ranked[0].totalScore).toBeGreaterThanOrEqual(ranked[1].totalScore)
		})
	})

	describe("calculateScores", () => {
		it("should calculate semantic score based on keyword matches", async () => {
			const item: ContextItem = {
				type: "code" as any,
				content: "function handleUserAuthentication",
				source: "/auth.ts",
			}

			const scores = await ranker.calculateScores(item, "authentication user", {})

			expect(scores.semantic).toBeGreaterThan(0)
		})

		it("should give higher proximity score for current file", async () => {
			const currentFileItem: ContextItem = {
				type: "code" as any,
				content: "test code",
				source: "/current.ts",
			}

			const otherFileItem: ContextItem = {
				type: "code" as any,
				content: "test code",
				source: "/other.ts",
			}

			const userContext: UserContext = {
				currentFile: "/current.ts",
			}

			const [currentScores, otherScores] = await Promise.all([
				ranker.calculateScores(currentFileItem, "test", userContext),
				ranker.calculateScores(otherFileItem, "test", userContext),
			])

			expect(currentScores.proximity).toBeGreaterThan(otherScores.proximity)
		})

		it("should boost preference for inferred task type", async () => {
			const codeItem: ContextItem = {
				type: "code" as any,
				content: "function test() {}",
				source: "/test.ts",
			}

			const conversationItem: ContextItem = {
				type: "conversation" as any,
				content: "We discussed testing",
				source: "/conv.md",
			}

			const userContext: UserContext = {
				behavioralContext: {
					inferredTask: "coding",
				},
			}

			const [codeScores, convScores] = await Promise.all([
				ranker.calculateScores(codeItem, "test", userContext),
				ranker.calculateScores(conversationItem, "test", userContext),
			])

			expect(codeScores.preference).toBeGreaterThan(convScores.preference)
		})
	})

	describe("weights", () => {
		it("should have default weights", () => {
			const weights = ranker.getWeights()

			expect(weights.semantic).toBe(0.3)
			expect(weights.proximity).toBe(0.2)
			expect(weights.recency).toBe(0.15)
			expect(weights.dependency).toBe(0.15)
			expect(weights.historical).toBe(0.1)
			expect(weights.preference).toBe(0.1)
		})

		it("should allow custom weights", () => {
			const customRanker = createRelevanceRanker({
				semantic: 0.5,
				proximity: 0.1,
			})

			const weights = customRanker.getWeights()

			expect(weights.semantic).toBe(0.5)
			expect(weights.proximity).toBe(0.1)
			expect(weights.recency).toBe(0.15) // Default
		})

		it("should update weights", () => {
			ranker.setWeights({ semantic: 0.6 })

			const weights = ranker.getWeights()

			expect(weights.semantic).toBe(0.6)
		})
	})

	describe("historical scores", () => {
		it("should update historical score", () => {
			ranker.updateHistoricalScore("/test.ts", "code" as any, 0.9)

			// Should be reflected in calculations
		})

		it("should use cached historical score", async () => {
			ranker.updateHistoricalScore("/test.ts", "code" as any, 0.95)

			const item: ContextItem = {
				type: "code" as any,
				content: "some code",
				source: "/test.ts",
			}

			const scores = await ranker.calculateScores(item, "test", {})

			// Historical score should be high
			expect(scores.historical).toBeCloseTo(0.95, 1)
		})
	})

	describe("user preferences", () => {
		it("should update user preference", () => {
			ranker.updateUserPreference("/test.ts", "code" as any, 0.85)
		})

		it("should use cached user preference", async () => {
			ranker.updateUserPreference("/test.ts", "code" as any, 0.8)

			const item: ContextItem = {
				type: "code" as any,
				content: "some code",
				source: "/test.ts",
			}

			const scores = await ranker.calculateScores(item, "test", {})

			// Preference score should reflect cached value
			expect(scores.preference).toBeGreaterThan(0.5)
		})
	})

	describe("context type handling", () => {
		it("should assign appropriate dependency scores for each type", async () => {
			const types = [
				"code" as any,
				"conversation" as any,
				"pattern" as any,
				"decision" as any,
				"architecture" as any,
				"symbol" as any,
			]

			const scoresList = await Promise.all(
				types.map(async (type) => {
					const item: ContextItem = {
						type,
						content: "test",
						source: "/test.ts",
					}
					return ranker.calculateScores(item, "test", {})
				}),
			)

			// All should have valid dependency scores
			for (const scores of scoresList) {
				expect(scores.dependency).toBeGreaterThanOrEqual(0)
				expect(scores.dependency).toBeLessThanOrEqual(1)
			}
		})
	})

	describe("edge cases", () => {
		it("should handle items with empty content", async () => {
			const items: ContextItem[] = [
				{ type: "code" as any, content: "", source: "/test.ts" },
			]

			const ranked = await ranker.rankContextItems(items, "test", {})

			expect(ranked.length).toBe(1)
			expect(ranked[0].item.content).toBe("")
		})

		it("should handle long queries", async () => {
			const item: ContextItem = {
				type: "code" as any,
				content: "function test() { return true; }",
				source: "/test.ts",
			}

			const longQuery = "this is a very long query with many words to test the system"
			const scores = await ranker.calculateScores(item, longQuery, {})

			expect(scores.semantic).toBeDefined()
			expect(typeof scores.semantic).toBe("number")
		})

		it("should handle special characters in content", async () => {
			const item: ContextItem = {
				type: "code" as any,
				content: "function $special() { return `@${name}`; }",
				source: "/test.ts",
			}

			const scores = await ranker.calculateScores(item, "special function", {})

			expect(scores.semantic).toBeGreaterThanOrEqual(0)
		})
	})

	describe("DEFAULT_WEIGHTS", () => {
		it("should sum to 1.0", () => {
			const weights = ranker.getWeights()
			const total = weights.semantic + weights.proximity + weights.recency + weights.dependency + weights.historical + weights.preference

			expect(total).toBeCloseTo(1.0, 10)
		})
	})
})
