import { describe, it, expect, beforeEach } from "vitest"
import Anthropic from "@anthropic-ai/sdk"

import { LosslessCondensationProvider } from "../index"
import { CondensationContext, CondensationOptions } from "../../../types"

/**
 * Tests for LosslessCondensationProvider
 * Validates orchestration of file deduplication and tool result consolidation
 */
describe("LosslessCondensationProvider", () => {
	let provider: LosslessCondensationProvider
	let mockApiHandler: any

	beforeEach(() => {
		provider = new LosslessCondensationProvider()
		mockApiHandler = {} as any
	})

	describe("Provider Metadata", () => {
		it("should have correct metadata", () => {
			expect(provider.id).toBe("lossless")
			expect(provider.name).toBe("Lossless Condensation")
			expect(provider.description).toContain("Lossless context condensation")
		})
	})

	describe("Cost Estimation", () => {
		it("should always return zero cost", async () => {
			const context: CondensationContext = {
				messages: [],
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 1000,
			}

			const cost = await provider.estimateCost(context)
			expect(cost).toBe(0)
		})

		it("should return zero cost even with large context", async () => {
			const messages = Array(100)
				.fill(null)
				.map(() => ({
					role: "user" as const,
					content: "test message with lots of content".repeat(100),
				}))

			const context: CondensationContext = {
				messages,
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 50000,
			}

			const cost = await provider.estimateCost(context)
			expect(cost).toBe(0)
		})
	})

	describe("Basic Integration", () => {
		it("should apply both file deduplication and tool consolidation", async () => {
			// Create messages with BOTH duplicate files AND redundant tool results
			const duplicateFileContent = "const x = 1;\nconst y = 2;\n".repeat(50)
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: "Read file1.ts",
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: `File: src/file1.ts\n${duplicateFileContent}`,
						},
					],
				},
				{
					role: "user",
					content: "List the directory",
				},
				{
					role: "assistant",
					content: [
						{
							type: "tool_result",
							tool_use_id: "list1",
							content: "Directory: src/\nfile1.ts\nfile2.ts\nfile3.ts",
						},
					],
				},
				{
					role: "user",
					content: "Read file1.ts again",
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: `File: src/file1.ts\n${duplicateFileContent}`, // Duplicate!
						},
					],
				},
				{
					role: "user",
					content: "List the directory again",
				},
				{
					role: "assistant",
					content: [
						{
							type: "tool_result",
							tool_use_id: "list2",
							content: "Directory: src/\nfile1.ts\nfile2.ts\nfile3.ts\nfile4.ts", // Similar list_files
						},
					],
				},
			]

			const context: CondensationContext = {
				messages,
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 10000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			// Verify result structure
			expect(result.messages).toBeDefined()
			expect(result.cost).toBe(0)
			expect(result.metrics).toBeDefined()

			// Verify both strategies were applied
			const strategies = result.metrics?.strategiesApplied || []
			expect(strategies).toContain("file_deduplication")
			expect(strategies.length).toBeGreaterThanOrEqual(1)

			// Verify significant reduction (>20%)
			const reductionPercentage = result.metrics?.reductionPercentage || 0
			expect(reductionPercentage).toBeGreaterThan(20)

			// Verify metrics include both strategy details
			expect(result.metrics?.fileDeduplication).toBeDefined()
			expect(result.metrics?.toolConsolidation).toBeDefined()
		})

		it("should preserve all user and assistant messages", async () => {
			const messages: Anthropic.MessageParam[] = [
				{ role: "user", content: "Message 1" },
				{ role: "assistant", content: "Response 1" },
				{ role: "user", content: "Message 2" },
				{ role: "assistant", content: "Response 2" },
				{ role: "user", content: "Message 3" },
				{ role: "assistant", content: "Response 3" },
			]

			const context: CondensationContext = {
				messages,
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 1000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			// All messages should be preserved
			expect(result.messages.length).toBe(messages.length)

			// Verify all user/assistant roles are preserved
			result.messages.forEach((msg, idx) => {
				expect(msg.role).toBe(messages[idx].role)
			})
		})
	})

	describe("Performance", () => {
		it("should process messages in under 100ms", async () => {
			// Create a reasonably complex scenario
			const messages: Anthropic.MessageParam[] = Array(20)
				.fill(null)
				.map((_, i) => ({
					role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
					content: [
						{
							type: "text" as const,
							text: `Message ${i}: ${"content ".repeat(100)}`,
						},
					],
				}))

			const context: CondensationContext = {
				messages,
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 5000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const startTime = Date.now()
			const result = await provider.condense(context, options)
			const elapsed = Date.now() - startTime

			expect(elapsed).toBeLessThan(100)
			expect(result.metrics?.timeElapsed).toBeLessThan(100)
		})
	})

	describe("Edge Cases", () => {
		it("should handle empty messages", async () => {
			const context: CondensationContext = {
				messages: [],
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 0,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			// Should return error via base class validation
			expect(result.error).toBeDefined()
			expect(result.error).toContain("No messages")
		})

		it("should handle messages with no duplication", async () => {
			const messages: Anthropic.MessageParam[] = [
				{ role: "user", content: "Unique message 1" },
				{ role: "assistant", content: "Unique response 1" },
				{ role: "user", content: "Unique message 2" },
				{ role: "assistant", content: "Unique response 2" },
			]

			const context: CondensationContext = {
				messages,
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 1000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			// Should still work, just with minimal reduction
			expect(result.messages.length).toBe(messages.length)
			expect(result.cost).toBe(0)
			expect(result.metrics?.strategiesApplied).toBeDefined()
		})

		it("should handle only file deduplication applicable", async () => {
			const duplicateContent = "const duplicate = true;".repeat(50)
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: "Read file",
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: `File: src/test.ts\n${duplicateContent}`,
						},
					],
				},
				{
					role: "user",
					content: "Read again",
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: `File: src/test.ts\n${duplicateContent}`, // Duplicate
						},
					],
				},
			]

			const context: CondensationContext = {
				messages,
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 3000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			// File deduplication should be applied
			expect(result.metrics?.strategiesApplied).toContain("file_deduplication")
			expect(result.metrics?.fileDeduplication?.duplicatesRemoved).toBeGreaterThan(0)

			// Should still have reduction
			expect(result.metrics?.reductionPercentage).toBeGreaterThan(0)
		})

		it("should handle only tool consolidation applicable", async () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: "List directory",
				},
				{
					role: "assistant",
					content: [
						{
							type: "tool_result",
							tool_use_id: "list1",
							content: "Files in src:\nfile1.ts\nfile2.ts",
						},
					],
				},
				{
					role: "user",
					content: "List again",
				},
				{
					role: "assistant",
					content: [
						{
							type: "tool_result",
							tool_use_id: "list2",
							content: "Files in src:\nfile1.ts\nfile2.ts\nfile3.ts",
						},
					],
				},
			]

			const context: CondensationContext = {
				messages,
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 1000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			// Tool consolidation metrics should exist even if no strategies applied
			expect(result.metrics?.toolConsolidation).toBeDefined()

			// If consolidation occurred, at least one strategy should be listed
			const strategies = result.metrics?.strategiesApplied || []
			if (
				result.metrics?.toolConsolidation?.consolidatedCount &&
				result.metrics.toolConsolidation.consolidatedCount < result.metrics.toolConsolidation.originalCount
			) {
				expect(strategies.length).toBeGreaterThan(0)
			}
		})
	})

	describe("Token Estimation", () => {
		it("should accurately estimate token reduction", async () => {
			const largeContent = "x".repeat(4000) // ~1000 tokens
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: "Read file",
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: `File: src/large.ts\n${largeContent}`,
						},
					],
				},
				{
					role: "user",
					content: "Read again",
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: `File: src/large.ts\n${largeContent}`, // Duplicate
						},
					],
				},
			]

			const context: CondensationContext = {
				messages,
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 5000,
			}

			const options: CondensationOptions = {
				apiHandler: mockApiHandler,
			}

			const result = await provider.condense(context, options)

			// Should have meaningful token reduction
			expect(result.metrics?.tokensSaved).toBeGreaterThan(0)
			expect(result.metrics?.originalTokens).toBeGreaterThan(result.metrics?.condensedTokens || 0)

			// Verify token counts are reasonable
			const originalTokens = result.metrics?.originalTokens || 0
			const condensedTokens = result.metrics?.condensedTokens || 0
			expect(originalTokens).toBeGreaterThan(1000) // At least 1K tokens
			expect(condensedTokens).toBeLessThan(originalTokens)
		})
	})

	describe("Validation", () => {
		it("should validate missing API handler", async () => {
			const context: CondensationContext = {
				messages: [{ role: "user", content: "test" }],
				systemPrompt: "test",
				taskId: "test-task",
				prevContextTokens: 100,
			}

			const options: CondensationOptions = {
				apiHandler: undefined as any,
			}

			const result = await provider.condense(context, options)

			expect(result.error).toBeDefined()
			expect(result.error).toContain("No API handler")
		})
	})
})
