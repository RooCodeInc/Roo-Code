// npx vitest run src/api/transform/caching/__tests__/ai-sdk-anthropic.spec.ts

import type { ModelMessage } from "ai"

import { addAiSdkAnthropicCacheBreakpoints } from "../ai-sdk-anthropic"

const CACHE_CONTROL = { anthropic: { cacheControl: { type: "ephemeral" } } }

describe("addAiSdkAnthropicCacheBreakpoints", () => {
	it("should return messages unchanged when there are no user messages", () => {
		const messages: ModelMessage[] = [{ role: "assistant", content: [{ type: "text", text: "Hello" }] }]

		const result = addAiSdkAnthropicCacheBreakpoints(messages)
		expect(result).toEqual(messages)
	})

	it("should add cache breakpoint to a single user message with string content", () => {
		const messages: ModelMessage[] = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: [{ type: "text", text: "Hi" }] },
		]

		const result = addAiSdkAnthropicCacheBreakpoints(messages)

		expect(result[0]).toEqual({
			role: "user",
			content: [{ type: "text", text: "Hello", providerOptions: CACHE_CONTROL }],
		})
	})

	it("should add cache breakpoints to the last two user messages", () => {
		const messages: ModelMessage[] = [
			{ role: "user", content: "First" },
			{ role: "assistant", content: [{ type: "text", text: "Response 1" }] },
			{ role: "user", content: "Second" },
			{ role: "assistant", content: [{ type: "text", text: "Response 2" }] },
			{ role: "user", content: "Third" },
		]

		const result = addAiSdkAnthropicCacheBreakpoints(messages)

		// First user message should NOT have cache control
		expect(result[0]).toEqual({ role: "user", content: "First" })

		// Second user message should have cache control
		expect(result[2]).toEqual({
			role: "user",
			content: [{ type: "text", text: "Second", providerOptions: CACHE_CONTROL }],
		})

		// Third user message should have cache control
		expect(result[4]).toEqual({
			role: "user",
			content: [{ type: "text", text: "Third", providerOptions: CACHE_CONTROL }],
		})
	})

	it("should add cache breakpoint to the last text part of array content", () => {
		const messages: ModelMessage[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "First part" },
					{ type: "image", image: "data:image/png;base64,..." },
					{ type: "text", text: "Last text part" },
				],
			},
		]

		const result = addAiSdkAnthropicCacheBreakpoints(messages)

		expect((result[0] as any).content).toEqual([
			{ type: "text", text: "First part" },
			{ type: "image", image: "data:image/png;base64,..." },
			{ type: "text", text: "Last text part", providerOptions: CACHE_CONTROL },
		])
	})

	it("should add placeholder text part when no text parts exist in array content", () => {
		const messages: ModelMessage[] = [
			{
				role: "user",
				content: [{ type: "image", image: "data:image/png;base64,..." }],
			},
		]

		const result = addAiSdkAnthropicCacheBreakpoints(messages)

		expect((result[0] as any).content).toEqual([
			{ type: "image", image: "data:image/png;base64,..." },
			{ type: "text", text: "...", providerOptions: CACHE_CONTROL },
		])
	})

	it("should not mutate the original messages", () => {
		const messages: ModelMessage[] = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: [{ type: "text", text: "Hi" }] },
		]

		const original = JSON.parse(JSON.stringify(messages))
		addAiSdkAnthropicCacheBreakpoints(messages)

		expect(messages).toEqual(original)
	})

	it("should handle both user messages when only two exist", () => {
		const messages: ModelMessage[] = [
			{ role: "user", content: "First" },
			{ role: "assistant", content: [{ type: "text", text: "Response" }] },
			{ role: "user", content: "Second" },
		]

		const result = addAiSdkAnthropicCacheBreakpoints(messages)

		expect(result[0]).toEqual({
			role: "user",
			content: [{ type: "text", text: "First", providerOptions: CACHE_CONTROL }],
		})
		expect(result[2]).toEqual({
			role: "user",
			content: [{ type: "text", text: "Second", providerOptions: CACHE_CONTROL }],
		})
	})

	it("should not modify assistant or tool messages", () => {
		const assistantMsg: ModelMessage = { role: "assistant", content: [{ type: "text", text: "Response" }] }
		const toolMsg: ModelMessage = {
			role: "tool",
			content: [
				{
					type: "tool-result",
					toolCallId: "call1",
					toolName: "test",
					output: { type: "text", value: "result" },
				},
			],
		} as ModelMessage

		const messages: ModelMessage[] = [
			{ role: "user", content: "Hello" },
			assistantMsg,
			toolMsg,
			{ role: "user", content: "Continue" },
		]

		const result = addAiSdkAnthropicCacheBreakpoints(messages)

		expect(result[1]).toEqual(assistantMsg)
		expect(result[2]).toEqual(toolMsg)
	})
})
