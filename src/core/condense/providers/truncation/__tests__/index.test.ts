import { describe, it, expect, beforeEach, vi } from "vitest"
import { TruncationCondensationProvider } from "../index"
import { CondensationContext, CondensationOptions } from "../../../types"
import { ApiMessage } from "../../../../task-persistence/apiMessages"
import { ApiHandler } from "../../../../../api"

// Mock API handler
const createMockApiHandler = (): ApiHandler => {
	return {
		countTokens: vi.fn().mockResolvedValue(1000),
	} as unknown as ApiHandler
}

describe("TruncationCondensationProvider", () => {
	let provider: TruncationCondensationProvider
	let mockApiHandler: ApiHandler

	beforeEach(() => {
		provider = new TruncationCondensationProvider()
		mockApiHandler = createMockApiHandler()
	})

	describe("Provider metadata", () => {
		it("should have correct id", () => {
			expect(provider.id).toBe("truncation")
		})

		it("should have descriptive name", () => {
			expect(provider.name).toBe("Truncation (Simple)")
		})

		it("should have clear description", () => {
			expect(provider.description).toContain("Fast, free")
		})
	})

	describe("condense", () => {
		it("should condense messages successfully", async () => {
			const messages: ApiMessage[] = []
			for (let i = 0; i < 20; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content:
						`Message ${i} with some longer content to ensure we have enough tokens to actually need truncation `.repeat(
							3,
						),
				})
			}

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test prompt",
				taskId: "test-task",
				prevContextTokens: 5000,
				targetTokens: 1000, // More aggressive target
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			expect(result.error).toBeUndefined()
			expect(result.messages.length).toBeLessThan(messages.length)
			expect(result.cost).toBe(0) // Free!
			expect(result.newContextTokens).toBeDefined()
			expect(result.metrics).toBeDefined()
		})

		it("should preserve first message", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "First important message" },
				{ role: "assistant", content: "Second" },
				{ role: "user", content: "Third" },
				{ role: "assistant", content: "Fourth" },
				{ role: "user", content: "Fifth" },
			]

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 1000,
				targetTokens: 100,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			expect(result.messages[0]).toEqual(messages[0])
		})

		it("should preserve recent messages", async () => {
			const messages: ApiMessage[] = []
			for (let i = 0; i < 30; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
				})
			}

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 3000,
				targetTokens: 500,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			// Last 10 messages should be preserved (default preserveRecent)
			const lastMessages = result.messages.slice(-10)
			expect(lastMessages).toEqual(messages.slice(-10))
		})

		it("should be fast (<10ms)", async () => {
			const messages: ApiMessage[] = []
			for (let i = 0; i < 100; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i} with realistic content`,
				})
			}

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 10000,
				targetTokens: 5000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const startTime = performance.now()
			await provider.condense(context, options)
			const duration = performance.now() - startTime

			expect(duration).toBeLessThan(10)
		})

		it("should handle messages with tool results", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Start" },
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
				{ role: "assistant", content: "Analysis complete" },
			]

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 5000,
				targetTokens: 500,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			expect(result.error).toBeUndefined()
			expect(result.metrics?.removalStats).toBeDefined()
		})

		it("should provide detailed metrics", async () => {
			const messages: ApiMessage[] = []
			// Create 50 messages so there are many removable ones between first and last 10
			for (let i = 0; i < 50; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content:
						`Message ${i} with longer content that ensures we have enough tokens for truncation `.repeat(5),
				})
			}

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 10000,
				targetTokens: 1000, // Aggressive target to ensure reduction
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			expect(result.metrics).toBeDefined()
			expect(result.metrics?.providerId).toBe("truncation")
			expect(result.metrics?.timeElapsed).toBeGreaterThanOrEqual(0)
			expect(result.metrics?.tokensSaved).toBeGreaterThan(0) // Should have saved tokens
			expect(result.metrics?.originalTokens).toBeDefined()
			expect(result.metrics?.condensedTokens).toBeDefined()
			expect(result.metrics?.reductionPercentage).toBeGreaterThan(0) // Should have some reduction
		})

		it("should generate informative summary", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Start" },
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
				{ role: "assistant", content: "Done" },
			]

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 2000,
				targetTokens: 500,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			expect(result.summary).toBeDefined()
			expect(result.summary).toContain("Truncation applied")
		})

		it("should use default target when not specified", async () => {
			const messages: ApiMessage[] = []
			for (let i = 0; i < 20; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
				})
			}

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 2000,
				// No targetTokens specified - should default to 50% reduction
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			expect(result.error).toBeUndefined()
			expect(result.newContextTokens).toBeLessThan(context.prevContextTokens)
		})

		it("should return original messages if already under target", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Short" },
				{ role: "assistant", content: "Short response" },
			]

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 100,
				targetTokens: 10000, // Well above current
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			expect(result.messages).toEqual(messages)
			expect(result.metrics?.tokensSaved).toBe(0)
		})
	})

	describe("estimateCost", () => {
		it("should always return zero cost", async () => {
			const context: CondensationContext = {
				messages: [{ role: "user", content: "Test" }],
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 1000,
			}

			const cost = await provider.estimateCost(context)

			expect(cost).toBe(0)
		})
	})

	describe("validate", () => {
		it("should validate successfully with valid inputs", async () => {
			const context: CondensationContext = {
				messages: [
					{ role: "user", content: "First" },
					{ role: "assistant", content: "Second" },
				],
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 1000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const validation = await provider.validate(context, options)

			expect(validation.valid).toBe(true)
			expect(validation.error).toBeUndefined()
		})

		it("should reject empty messages", async () => {
			const context: CondensationContext = {
				messages: [],
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 0,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const validation = await provider.validate(context, options)

			expect(validation.valid).toBe(false)
			expect(validation.error).toBeDefined()
		})

		it("should reject single message (need at least 2)", async () => {
			const context: CondensationContext = {
				messages: [{ role: "user", content: "Only one" }],
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 100,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const validation = await provider.validate(context, options)

			expect(validation.valid).toBe(false)
			expect(validation.error).toContain("at least 2 messages")
		})

		it("should reject missing API handler", async () => {
			const context: CondensationContext = {
				messages: [
					{ role: "user", content: "First" },
					{ role: "assistant", content: "Second" },
				],
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 1000,
			}

			const options: CondensationOptions = {
				apiHandler: null as any,
			}

			const validation = await provider.validate(context, options)

			expect(validation.valid).toBe(false)
			expect(validation.error).toBeDefined()
		})
	})

	describe("Custom configuration", () => {
		it("should respect custom preserveFirst", async () => {
			const customProvider = new TruncationCondensationProvider({
				preserveFirst: 3, // Preserve first 3 messages
				preserveRecent: 5,
			})

			const messages: ApiMessage[] = []
			for (let i = 0; i < 20; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
				})
			}

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 2000,
				targetTokens: 500,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await customProvider.condense(context, options)

			// First 3 messages should be preserved
			expect(result.messages.slice(0, 3)).toEqual(messages.slice(0, 3))
		})

		it("should respect custom preserveRecent", async () => {
			const customProvider = new TruncationCondensationProvider({
				preserveFirst: 1,
				preserveRecent: 3, // Only keep last 3
			})

			const messages: ApiMessage[] = []
			for (let i = 0; i < 20; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
				})
			}

			const context: CondensationContext = {
				messages,
				systemPrompt: "Test",
				taskId: "test-task",
				prevContextTokens: 2000,
				targetTokens: 500,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await customProvider.condense(context, options)

			// Last 3 messages should be preserved
			const lastMessages = result.messages.slice(-3)
			expect(lastMessages).toEqual(messages.slice(-3))
		})
	})
})
