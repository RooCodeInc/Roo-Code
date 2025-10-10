import { describe, it, expect } from "vitest"
import { calculateMessageImportance, scoreAllMessages } from "../message-importance"
import { ApiMessage } from "../../task-persistence/apiMessages"

describe("Message Importance Scoring", () => {
	describe("calculateMessageImportance", () => {
		it("should give high score to user commands with keywords", () => {
			const message: ApiMessage = {
				role: "user",
				content: "必须使用 PostgreSQL 数据库",
				ts: Date.now(),
			}

			const score = calculateMessageImportance(message, 5, 20, 15)

			expect(score.score).toBeGreaterThan(70)
			expect(score.isUserMessage).toBe(true)
			expect(score.reasons).toContain("User message (+20)")
			expect(score.reasons.some((r) => r.includes("Command keyword"))).toBe(true)
		})

		it("should give high score to first message", () => {
			const message: ApiMessage = {
				role: "user",
				content: "Create a todo application",
				ts: Date.now(),
			}

			const score = calculateMessageImportance(message, 0, 20, 25)

			expect(score.score).toBeGreaterThan(90)
			expect(score.reasons).toContain("First message (+30)")
			expect(score.reasons).toContain("User message (+20)")
		})

		it("should give low score to simple acknowledgments", () => {
			const message: ApiMessage = {
				role: "assistant",
				content: "好的，我明白了",
				ts: Date.now(),
			}

			const score = calculateMessageImportance(message, 10, 20, 8)

			expect(score.score).toBeLessThan(50)
			expect(score.reasons.some((r) => r.includes("Low-value acknowledgment"))).toBe(true)
		})

		it("should prioritize recent messages", () => {
			const message: ApiMessage = {
				role: "user",
				content: "Please continue",
				ts: Date.now(),
			}

			const score = calculateMessageImportance(message, 18, 20, 10)

			expect(score.score).toBeGreaterThan(60)
			expect(score.reasons).toContain("Recent message (+25)")
		})

		it("should detect technical keywords", () => {
			const message: ApiMessage = {
				role: "user",
				content: "Use PostgreSQL database with Redis caching and JWT authentication",
				ts: Date.now(),
			}

			const score = calculateMessageImportance(message, 5, 20, 30)

			expect(score.score).toBeGreaterThan(75)
			expect(score.reasons.some((r) => r.includes("Technical decisions"))).toBe(true)
		})

		it("should detect error mentions", () => {
			const message: ApiMessage = {
				role: "user",
				content: "There is an error in the login function",
				ts: Date.now(),
			}

			const score = calculateMessageImportance(message, 8, 20, 20)

			expect(score.reasons.some((r) => r.includes("Error/problem mention"))).toBe(true)
		})

		it("should boost score for code blocks", () => {
			const message: ApiMessage = {
				role: "assistant",
				content: "Here is the code:\n```typescript\nfunction test() {}\n```",
				ts: Date.now(),
			}

			const score = calculateMessageImportance(message, 5, 20, 50)

			expect(score.reasons).toContain("Contains code block (+10)")
		})

		it("should boost score for short user commands", () => {
			const message: ApiMessage = {
				role: "user",
				content: "Change port to 3001",
				ts: Date.now(),
			}

			const score = calculateMessageImportance(message, 8, 20, 15)

			expect(score.score).toBeGreaterThan(70)
			expect(score.reasons).toContain("Short user command (+15)")
		})

		it("should reduce score for very long messages", () => {
			const message: ApiMessage = {
				role: "assistant",
				content: "A".repeat(20000), // Very long content
				ts: Date.now(),
			}

			const score = calculateMessageImportance(message, 10, 20, 6000)

			expect(score.reasons).toContain("Very long message (-10)")
		})

		it("should boost score for summary messages", () => {
			const message: ApiMessage = {
				role: "assistant",
				content: "Summary of the conversation so far...",
				ts: Date.now(),
				isSummary: true,
			}

			const score = calculateMessageImportance(message, 5, 20, 100)

			expect(score.reasons).toContain("Summary message (+25)")
		})

		it("should keep score within 0-100 range", () => {
			// Test with maximum positive factors
			const highScoreMessage: ApiMessage = {
				role: "user",
				content: "必须使用 PostgreSQL with Redis and all APIs need authentication",
				ts: Date.now(),
				isSummary: true,
			}

			const highScore = calculateMessageImportance(highScoreMessage, 0, 20, 10)
			expect(highScore.score).toBeLessThanOrEqual(100)
			expect(highScore.score).toBeGreaterThanOrEqual(0)

			// Test with maximum negative factors
			const lowScoreMessage: ApiMessage = {
				role: "assistant",
				content: "ok",
				ts: Date.now(),
			}

			const lowScore = calculateMessageImportance(lowScoreMessage, 10, 20, 10000)
			expect(lowScore.score).toBeLessThanOrEqual(100)
			expect(lowScore.score).toBeGreaterThanOrEqual(0)
		})
	})

	describe("scoreAllMessages", () => {
		it("should score all messages in a conversation", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Create a blog app", ts: Date.now() },
				{ role: "assistant", content: "I'll create a blog application...", ts: Date.now() },
				{ role: "user", content: "使用 MongoDB 数据库", ts: Date.now() },
				{ role: "assistant", content: "好的，我会使用 MongoDB", ts: Date.now() },
			]

			const mockCountTokens = async (content: any) => {
				const text = Array.isArray(content)
					? content.map((block) => (block.type === "text" ? block.text : "")).join(" ")
					: content
				return text.length / 4 // Simple estimation
			}

			const scores = await scoreAllMessages(messages, mockCountTokens)

			expect(scores).toHaveLength(4)
			expect(scores[0].score).toBeGreaterThan(scores[1].score) // First message should score highest
			expect(scores[2].isUserMessage).toBe(true) // Third message is user message
		})

		it("should handle empty message array", async () => {
			const messages: ApiMessage[] = []
			const mockCountTokens = async () => 0

			const scores = await scoreAllMessages(messages, mockCountTokens)

			expect(scores).toHaveLength(0)
		})

		it("should handle messages with array content", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "Check this code" },
						{ type: "text", text: "and fix errors" },
					],
					ts: Date.now(),
				},
			]

			const mockCountTokens = async (content: any) => {
				const text = Array.isArray(content)
					? content.map((block: any) => (block.type === "text" ? block.text : "")).join(" ")
					: content
				return text.length / 4
			}

			const scores = await scoreAllMessages(messages, mockCountTokens)

			expect(scores).toHaveLength(1)
			expect(scores[0].score).toBeGreaterThan(0)
		})
	})
})
