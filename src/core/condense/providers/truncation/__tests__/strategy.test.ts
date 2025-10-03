import { describe, it, expect, beforeEach } from "vitest"
import Anthropic from "@anthropic-ai/sdk"
import { TruncationStrategy, ContentType, TruncationConfig } from "../strategy"
import { ApiMessage } from "../../../../task-persistence/apiMessages"

describe("TruncationStrategy", () => {
	let strategy: TruncationStrategy

	beforeEach(() => {
		strategy = new TruncationStrategy()
	})

	describe("truncate", () => {
		it("should return original messages if already under target", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Short message" },
				{ role: "assistant", content: "Short response" },
			]

			const config: TruncationConfig = {
				targetTokens: 10000, // Well above actual tokens
			}

			const result = strategy.truncate(messages, config)

			expect(result.truncatedMessages).toEqual(messages)
			expect(result.originalTokens).toBe(result.finalTokens)
			expect(result.removedMessages).toHaveLength(0)
		})

		it("should preserve first message (system context)", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "First message - system context" },
				{ role: "assistant", content: "Second message" },
				{ role: "user", content: "Third message" },
				{ role: "assistant", content: "Fourth message" },
			]

			const config: TruncationConfig = {
				targetTokens: 10, // Very low to force truncation
				preserveFirst: 1,
			}

			const result = strategy.truncate(messages, config)

			expect(result.truncatedMessages[0]).toEqual(messages[0])
		})

		it("should preserve recent messages", () => {
			const messages: ApiMessage[] = []
			for (let i = 0; i < 20; i++) {
				messages.push({ role: i % 2 === 0 ? "user" : "assistant", content: `Message ${i}` })
			}

			const config: TruncationConfig = {
				targetTokens: 50, // Low target
				preserveFirst: 1,
				preserveRecent: 5, // Keep last 5
			}

			const result = strategy.truncate(messages, config)

			// Check last 5 messages are preserved
			const lastMessages = result.truncatedMessages.slice(-5)
			expect(lastMessages).toEqual(messages.slice(-5))
		})

		it("should remove tool_results with highest priority", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "First" },
				{
					role: "assistant",
					content: [
						{ type: "text", text: "Using tool" },
						{ type: "tool_use", id: "tool1", name: "read_file", input: { path: "test.ts" } },
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool1",
							content: "Very long file content ".repeat(100),
						},
					],
				},
				{ role: "assistant", content: "Final response" },
			]

			const config: TruncationConfig = {
				targetTokens: 50,
				preserveFirst: 1,
				preserveRecent: 1,
				priorityOrder: [ContentType.TOOL_RESULT, ContentType.TOOL_USE],
			}

			const result = strategy.truncate(messages, config)

			// Should have removed tool_result
			expect(result.removalStats.toolResultsRemoved).toBeGreaterThan(0)
			expect(result.finalTokens).toBeLessThan(result.originalTokens)
		})

		it("should calculate removal stats correctly", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "First" },
				{
					role: "assistant",
					content: [{ type: "tool_use", id: "tool1", name: "read_file", input: { path: "test.ts" } }],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool1",
							content: "Long content ".repeat(50),
						},
					],
				},
				{ role: "assistant", content: "Response" },
			]

			const config: TruncationConfig = {
				targetTokens: 20,
				preserveFirst: 1,
				preserveRecent: 1,
			}

			const result = strategy.truncate(messages, config)

			const stats = result.removalStats
			expect(
				stats.messagesRemoved +
					stats.toolResultsRemoved +
					stats.toolUsesRemoved +
					stats.assistantTextRemoved +
					stats.userTextRemoved,
			).toBeGreaterThan(0)
		})

		it("should handle empty messages array", () => {
			const messages: ApiMessage[] = []

			const config: TruncationConfig = {
				targetTokens: 100,
			}

			const result = strategy.truncate(messages, config)

			expect(result.truncatedMessages).toEqual([])
			expect(result.originalTokens).toBe(0)
			expect(result.finalTokens).toBe(0)
		})

		it("should handle single message", () => {
			const messages: ApiMessage[] = [{ role: "user", content: "Only message" }]

			const config: TruncationConfig = {
				targetTokens: 100,
				preserveFirst: 1,
			}

			const result = strategy.truncate(messages, config)

			expect(result.truncatedMessages).toEqual(messages)
		})

		it("should respect priority order configuration", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "First message with some content" },
				{
					role: "assistant",
					content: [
						{ type: "text", text: "Some text content here" },
						{
							type: "tool_use",
							id: "tool1",
							name: "read_file",
							input: { path: "test.ts", encoding: "utf-8" },
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool1",
							content: "Long result content that takes space ".repeat(10),
						},
					],
				},
				{ role: "assistant", content: "Final response with content" },
			]

			// Custom priority: remove tool_use before tool_result
			const config: TruncationConfig = {
				targetTokens: 30,
				preserveFirst: 1,
				preserveRecent: 1,
				priorityOrder: [ContentType.TOOL_USE, ContentType.TOOL_RESULT],
			}

			const result = strategy.truncate(messages, config)

			// With custom priority and enough content, something should be removed
			expect(result.finalTokens).toBeLessThan(result.originalTokens)
		})

		it("should remove complete messages when content removal is insufficient", () => {
			const messages: ApiMessage[] = []
			for (let i = 0; i < 15; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i} with some content`,
				})
			}

			const config: TruncationConfig = {
				targetTokens: 10, // Very aggressive target
				preserveFirst: 1,
				preserveRecent: 2,
			}

			const result = strategy.truncate(messages, config)

			expect(result.removalStats.messagesRemoved).toBeGreaterThan(0)
			expect(result.truncatedMessages.length).toBeLessThan(messages.length)
		})

		it("should use default configuration when not specified", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1" },
				{ role: "assistant", content: "Message 2" },
				{ role: "user", content: "Message 3" },
			]

			const config: TruncationConfig = {
				targetTokens: 100,
				// No preserveFirst, preserveRecent, or priorityOrder specified
			}

			const result = strategy.truncate(messages, config)

			// Should use defaults (preserveFirst: 1, preserveRecent: 10)
			expect(result.truncatedMessages[0]).toEqual(messages[0])
		})

		it("should achieve significant reduction for complex messages", () => {
			const messages: ApiMessage[] = [{ role: "user", content: "Start" }]

			// Add many tool results (high priority for removal)
			for (let i = 0; i < 10; i++) {
				messages.push({
					role: "assistant",
					content: [{ type: "tool_use", id: `tool${i}`, name: "read_file", input: { path: `file${i}.ts` } }],
				})
				messages.push({
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: `tool${i}`,
							content: "Very long file content that should be removed ".repeat(50),
						},
					],
				})
			}

			messages.push({ role: "assistant", content: "Final response" })

			const config: TruncationConfig = {
				targetTokens: 100,
				preserveFirst: 1,
				preserveRecent: 1,
			}

			const result = strategy.truncate(messages, config)

			const reductionPercent = ((result.originalTokens - result.finalTokens) / result.originalTokens) * 100
			expect(reductionPercent).toBeGreaterThan(50) // At least 50% reduction
		})

		it("should perform quickly (<10ms for typical conversation)", () => {
			const messages: ApiMessage[] = []
			for (let i = 0; i < 100; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i} with some content that makes it realistic`,
				})
			}

			const config: TruncationConfig = {
				targetTokens: 500,
				preserveFirst: 1,
				preserveRecent: 10,
			}

			const startTime = performance.now()
			strategy.truncate(messages, config)
			const duration = performance.now() - startTime

			expect(duration).toBeLessThan(10) // <10ms target
		})
	})
})
