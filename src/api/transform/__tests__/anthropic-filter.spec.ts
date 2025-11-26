import { Anthropic } from "@anthropic-ai/sdk"

import { filterNonAnthropicBlocks, INVALID_ANTHROPIC_BLOCK_TYPES } from "../anthropic-filter"

describe("anthropic-filter", () => {
	describe("INVALID_ANTHROPIC_BLOCK_TYPES", () => {
		it("should contain reasoning type", () => {
			expect(INVALID_ANTHROPIC_BLOCK_TYPES.has("reasoning")).toBe(true)
		})

		it("should contain thoughtSignature type", () => {
			expect(INVALID_ANTHROPIC_BLOCK_TYPES.has("thoughtSignature")).toBe(true)
		})

		it("should not contain valid Anthropic types", () => {
			expect(INVALID_ANTHROPIC_BLOCK_TYPES.has("text")).toBe(false)
			expect(INVALID_ANTHROPIC_BLOCK_TYPES.has("image")).toBe(false)
			expect(INVALID_ANTHROPIC_BLOCK_TYPES.has("tool_use")).toBe(false)
			expect(INVALID_ANTHROPIC_BLOCK_TYPES.has("tool_result")).toBe(false)
		})
	})

	describe("filterNonAnthropicBlocks", () => {
		it("should pass through messages with string content", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
			]

			const result = filterNonAnthropicBlocks(messages)

			expect(result).toEqual(messages)
		})

		it("should pass through messages with valid Anthropic blocks", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [{ type: "text", text: "Hello" }],
				},
				{
					role: "assistant",
					content: [{ type: "text", text: "Hi there!" }],
				},
			]

			const result = filterNonAnthropicBlocks(messages)

			expect(result).toEqual(messages)
		})

		it("should filter out reasoning blocks from messages", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: [
						{ type: "reasoning" as any, text: "Internal reasoning" },
						{ type: "text", text: "Response" },
					],
				},
			]

			const result = filterNonAnthropicBlocks(messages)

			expect(result).toHaveLength(2)
			expect(result[1].content).toEqual([{ type: "text", text: "Response" }])
		})

		it("should filter out thoughtSignature blocks from messages", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: [
						{ type: "thoughtSignature", thoughtSignature: "encrypted-sig" } as any,
						{ type: "text", text: "Response" },
					],
				},
			]

			const result = filterNonAnthropicBlocks(messages)

			expect(result).toHaveLength(2)
			expect(result[1].content).toEqual([{ type: "text", text: "Response" }])
		})

		it("should remove messages that become empty after filtering", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: [{ type: "reasoning" as any, text: "Only reasoning" }],
				},
				{ role: "user", content: "Continue" },
			]

			const result = filterNonAnthropicBlocks(messages)

			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("Hello")
			expect(result[1].content).toBe("Continue")
		})

		it("should handle mixed content with multiple invalid block types", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{ type: "reasoning", text: "Reasoning" } as any,
						{ type: "text", text: "Text 1" },
						{ type: "thoughtSignature", thoughtSignature: "sig" } as any,
						{ type: "text", text: "Text 2" },
					],
				},
			]

			const result = filterNonAnthropicBlocks(messages)

			expect(result).toHaveLength(1)
			expect(result[0].content).toEqual([
				{ type: "text", text: "Text 1" },
				{ type: "text", text: "Text 2" },
			])
		})
	})
})
