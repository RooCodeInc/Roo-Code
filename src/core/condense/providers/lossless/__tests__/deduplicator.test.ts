import { describe, it, expect, beforeEach } from "vitest"
import Anthropic from "@anthropic-ai/sdk"
import { FileDeduplicator } from "../deduplicator"

describe("FileDeduplicator", () => {
	let deduplicator: FileDeduplicator

	beforeEach(() => {
		deduplicator = new FileDeduplicator()
	})

	describe("analyzeDuplicates", () => {
		it("should detect no duplicates in messages without file content", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: "Hello, how are you?",
				},
				{
					role: "assistant",
					content: "I'm doing well, thank you!",
				},
			]

			const result = deduplicator.analyzeDuplicates(messages)

			expect(result.duplicateCount).toBe(0)
			expect(result.uniqueFiles.size).toBe(0)
			expect(result.reductionPercent).toBe(0)
		})

		it("should detect duplicate file content", () => {
			const fileContent = "const x = 1\nconst y = 2\nconst z = 3"
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: src/test.ts\n${fileContent}`,
						},
					],
				},
				{
					role: "assistant",
					content: "I see the file",
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: src/test.ts\n${fileContent}`,
						},
					],
				},
			]

			const result = deduplicator.analyzeDuplicates(messages)

			expect(result.duplicateCount).toBe(1)
			expect(result.uniqueFiles.size).toBe(1)
			expect(result.uniqueFiles.has("src/test.ts")).toBe(true)
			expect(result.reductionPercent).toBeGreaterThan(0)
		})

		it("should handle tool result format with line numbers", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "File: src/app.ts\n1 | import express from 'express'\n2 | const app = express()\n3 | app.listen(3000)",
						},
					],
				},
				{
					role: "assistant",
					content: "Got it",
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "File: src/app.ts\n1 | import express from 'express'\n2 | const app = express()\n3 | app.listen(3000)",
						},
					],
				},
			]

			const result = deduplicator.analyzeDuplicates(messages)

			expect(result.duplicateCount).toBe(1)
			expect(result.reductionPercent).toBeGreaterThan(20) // Should achieve significant reduction
		})

		it("should calculate correct reduction percentage", () => {
			const longContent = "x".repeat(1000) // Large file content
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: large.txt\n${longContent}`,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: large.txt\n${longContent}`,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: large.txt\n${longContent}`,
						},
					],
				},
			]

			const result = deduplicator.analyzeDuplicates(messages)

			expect(result.duplicateCount).toBe(1)
			expect(result.tokensBeforeDedup).toBeGreaterThan(0)
			expect(result.tokensAfterDedup).toBeLessThan(result.tokensBeforeDedup)
			expect(result.reductionPercent).toBeGreaterThan(50) // 3 copies -> 1 copy + 2 refs = ~66% reduction
		})

		it("should handle different files without treating them as duplicates", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "File: src/a.ts\nconst a = 1",
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "File: src/b.ts\nconst b = 2",
						},
					],
				},
			]

			const result = deduplicator.analyzeDuplicates(messages)

			expect(result.duplicateCount).toBe(0)
			expect(result.uniqueFiles.size).toBe(0)
		})
	})

	describe("deduplicate", () => {
		it("should replace duplicate files with references", () => {
			const fileContent = "const x = 1\nconst y = 2"
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: src/test.ts\n${fileContent}`,
						},
					],
				},
				{
					role: "assistant",
					content: "OK",
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: src/test.ts\n${fileContent}`,
						},
					],
				},
			]

			const result = deduplicator.deduplicate(messages)

			expect(result.deduplicatedMessages.length).toBe(3)

			// Most recent (message index 2) should be kept
			const lastMessage = result.deduplicatedMessages[2]
			if (typeof lastMessage.content !== "string") {
				const textBlock = lastMessage.content[0]
				if (textBlock.type === "text") {
					expect(textBlock.text).toContain(fileContent)
				}
			}

			// Older occurrence (message index 0) should be replaced with reference
			const firstMessage = result.deduplicatedMessages[0]
			if (typeof firstMessage.content !== "string") {
				const textBlock = firstMessage.content[0]
				if (textBlock.type === "text") {
					expect(textBlock.text).toContain("Content identical to message")
					expect(textBlock.text).toContain("src/test.ts")
				}
			}
		})

		it("should preserve non-duplicate content", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: "Regular message",
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: "File: unique.ts\nconst unique = true",
						},
					],
				},
			]

			const result = deduplicator.deduplicate(messages)

			expect(result.deduplicatedMessages).toHaveLength(2)
			expect(result.duplicateCount).toBe(0)

			// Messages should be unchanged
			expect(result.deduplicatedMessages[0].content).toBe("Regular message")
		})

		it("should handle multiple different duplicate groups", () => {
			const contentA = "file A content"
			const contentB = "file B content"
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: a.ts\n${contentA}`,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: b.ts\n${contentB}`,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: a.ts\n${contentA}`,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: b.ts\n${contentB}`,
						},
					],
				},
			]

			const result = deduplicator.deduplicate(messages)

			expect(result.duplicateCount).toBe(2) // Two duplicate groups
			expect(result.uniqueFiles.size).toBe(2)
			expect(result.uniqueFiles.has("a.ts")).toBe(true)
			expect(result.uniqueFiles.has("b.ts")).toBe(true)
		})

		it("should calculate accurate token reduction", () => {
			const longContent = "x".repeat(2000) // ~500 tokens
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: big.txt\n${longContent}`,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: big.txt\n${longContent}`,
						},
					],
				},
			]

			const result = deduplicator.deduplicate(messages)

			expect(result.tokensBeforeDedup).toBeGreaterThan(1000) // ~1000 tokens (2 copies)
			expect(result.tokensAfterDedup).toBeLessThan(600) // ~500 tokens + reference overhead
			expect(result.reductionPercent).toBeGreaterThan(40)
		})

		it("should return original messages when no duplicates found", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: "No files here",
				},
			]

			const result = deduplicator.deduplicate(messages)

			expect(result.deduplicatedMessages).toEqual(messages)
			expect(result.duplicateCount).toBe(0)
			expect(result.reductionPercent).toBe(0)
		})

		it("should handle messages with mixed content blocks", () => {
			const fileContent = "const value = 42"
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Here's the file:",
						},
						{
							type: "text",
							text: `File: code.ts\n${fileContent}`,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Let me show it again:",
						},
						{
							type: "text",
							text: `File: code.ts\n${fileContent}`,
						},
					],
				},
			]

			const result = deduplicator.deduplicate(messages)

			expect(result.duplicateCount).toBe(1)

			// Check that non-file blocks are preserved
			const firstMsg = result.deduplicatedMessages[0]
			if (typeof firstMsg.content !== "string") {
				expect(firstMsg.content.length).toBe(2)
				const firstBlock = firstMsg.content[0]
				if (firstBlock.type === "text") {
					expect(firstBlock.text).toContain("Here's the file")
				}
			}
		})
	})

	describe("edge cases", () => {
		it("should handle empty messages array", () => {
			const messages: Anthropic.MessageParam[] = []
			const result = deduplicator.deduplicate(messages)

			expect(result.deduplicatedMessages).toEqual([])
			expect(result.duplicateCount).toBe(0)
			expect(result.reductionPercent).toBe(0)
		})

		it("should handle messages with only string content", () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: "String message 1",
				},
				{
					role: "assistant",
					content: "String message 2",
				},
			]

			const result = deduplicator.deduplicate(messages)

			expect(result.deduplicatedMessages).toEqual(messages)
			expect(result.duplicateCount).toBe(0)
		})

		it("should handle file content with special characters", () => {
			const specialContent = "const regex = /[a-z]+/; const str = 'hello\\nworld'"
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: regex.ts\n${specialContent}`,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: regex.ts\n${specialContent}`,
						},
					],
				},
			]

			const result = deduplicator.deduplicate(messages)

			expect(result.duplicateCount).toBe(1)
		})

		it("should handle very large files efficiently", () => {
			const largeContent = "line\n".repeat(10000) // 10k lines
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: large.txt\n${largeContent}`,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `File: large.txt\n${largeContent}`,
						},
					],
				},
			]

			const result = deduplicator.deduplicate(messages)

			expect(result.duplicateCount).toBe(1)
			expect(result.reductionPercent).toBeGreaterThan(40)
		})
	})
})
