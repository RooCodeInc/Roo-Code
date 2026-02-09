// npx vitest run src/api/transform/__tests__/caching.spec.ts

import type { ModelMessage } from "ai"
import { buildCachedSystemMessage, applyCacheBreakpoints } from "../caching"

describe("caching.ts", () => {
	// ── buildCachedSystemMessage ─────────────────────────────────

	describe("buildCachedSystemMessage", () => {
		it("should wrap system prompt with anthropic cache control", () => {
			const result = buildCachedSystemMessage("You are a helpful assistant", "anthropic")

			expect(result).toEqual({
				role: "system",
				content: "You are a helpful assistant",
				providerOptions: {
					anthropic: { cacheControl: { type: "ephemeral" } },
				},
			})
		})

		it("should wrap system prompt with openrouter cache control", () => {
			const result = buildCachedSystemMessage("System prompt", "openrouter")

			expect(result).toEqual({
				role: "system",
				content: "System prompt",
				providerOptions: {
					openrouter: { cacheControl: { type: "ephemeral" } },
				},
			})
		})

		it("should work with any arbitrary provider key", () => {
			const result = buildCachedSystemMessage("Prompt", "custom-provider")

			expect(result.providerOptions).toEqual({
				"custom-provider": { cacheControl: { type: "ephemeral" } },
			})
		})

		it("should preserve empty system prompt", () => {
			const result = buildCachedSystemMessage("", "anthropic")

			expect(result.content).toBe("")
			expect(result.role).toBe("system")
		})
	})

	// ── applyCacheBreakpoints — last-n strategy ─────────────────

	describe("applyCacheBreakpoints (last-n strategy)", () => {
		function makeUserMessage(text: string): ModelMessage {
			return {
				role: "user",
				content: [{ type: "text", text }],
			} as ModelMessage
		}

		function makeAssistantMessage(text: string): ModelMessage {
			return {
				role: "assistant",
				content: [{ type: "text", text }],
			} as ModelMessage
		}

		it("should mark last 2 user messages by default", () => {
			const messages: ModelMessage[] = [
				makeUserMessage("first"),
				makeAssistantMessage("reply1"),
				makeUserMessage("second"),
				makeAssistantMessage("reply2"),
				makeUserMessage("third"),
			]

			applyCacheBreakpoints(messages, "anthropic")

			// First user message should NOT have cache control
			expect((messages[0].content as any[])[0].providerOptions).toBeUndefined()

			// Second user message (index 2) SHOULD have cache control
			expect((messages[2].content as any[])[0].providerOptions).toEqual({
				anthropic: { cacheControl: { type: "ephemeral" } },
			})

			// Third user message (index 4) SHOULD have cache control
			expect((messages[4].content as any[])[0].providerOptions).toEqual({
				anthropic: { cacheControl: { type: "ephemeral" } },
			})
		})

		it("should handle a single user message", () => {
			const messages: ModelMessage[] = [makeUserMessage("only one")]

			applyCacheBreakpoints(messages, "anthropic")

			expect((messages[0].content as any[])[0].providerOptions).toEqual({
				anthropic: { cacheControl: { type: "ephemeral" } },
			})
		})

		it("should handle no user messages", () => {
			const messages: ModelMessage[] = [makeAssistantMessage("assistant only")]

			applyCacheBreakpoints(messages, "anthropic")

			// Should not throw; assistant message should be untouched
			expect((messages[0].content as any[])[0].providerOptions).toBeUndefined()
		})

		it("should use openrouter provider key", () => {
			const messages: ModelMessage[] = [
				makeUserMessage("first"),
				makeAssistantMessage("reply"),
				makeUserMessage("second"),
			]

			applyCacheBreakpoints(messages, "openrouter")

			expect((messages[0].content as any[])[0].providerOptions).toEqual({
				openrouter: { cacheControl: { type: "ephemeral" } },
			})
			expect((messages[2].content as any[])[0].providerOptions).toEqual({
				openrouter: { cacheControl: { type: "ephemeral" } },
			})
		})

		it("should support custom count via options", () => {
			const messages: ModelMessage[] = [
				makeUserMessage("first"),
				makeAssistantMessage("reply1"),
				makeUserMessage("second"),
				makeAssistantMessage("reply2"),
				makeUserMessage("third"),
				makeAssistantMessage("reply3"),
				makeUserMessage("fourth"),
			]

			applyCacheBreakpoints(messages, "anthropic", { count: 3 })

			// first user message should NOT have cache control
			expect((messages[0].content as any[])[0].providerOptions).toBeUndefined()

			// second, third, fourth user messages should have cache control
			expect((messages[2].content as any[])[0].providerOptions).toBeDefined()
			expect((messages[4].content as any[])[0].providerOptions).toBeDefined()
			expect((messages[6].content as any[])[0].providerOptions).toBeDefined()
		})

		it("should handle string content by wrapping in array", () => {
			const messages: ModelMessage[] = [{ role: "user", content: "plain string" } as ModelMessage]

			applyCacheBreakpoints(messages, "anthropic")

			// Should have been converted to array with text part
			expect(messages[0].content).toEqual([
				{
					type: "text",
					text: "plain string",
					providerOptions: {
						anthropic: { cacheControl: { type: "ephemeral" } },
					},
				},
			])
		})

		it("should apply providerOptions to last text part in multi-part content", () => {
			const messages: ModelMessage[] = [
				{
					role: "user",
					content: [
						{ type: "image", image: new Uint8Array() },
						{ type: "text", text: "first text" },
						{ type: "text", text: "second text" },
					],
				} as ModelMessage,
			]

			applyCacheBreakpoints(messages, "anthropic")

			// First text part should NOT have providerOptions
			expect((messages[0].content as any[])[1].providerOptions).toBeUndefined()

			// Last text part should have providerOptions
			expect((messages[0].content as any[])[2].providerOptions).toEqual({
				anthropic: { cacheControl: { type: "ephemeral" } },
			})
		})

		it("should not modify assistant messages even if they have text parts", () => {
			const messages: ModelMessage[] = [makeAssistantMessage("I'm an assistant"), makeUserMessage("user message")]

			applyCacheBreakpoints(messages, "anthropic")

			expect((messages[0].content as any[])[0].providerOptions).toBeUndefined()
		})
	})

	// ── applyCacheBreakpoints — every-nth strategy ──────────────

	describe("applyCacheBreakpoints (every-nth strategy)", () => {
		function makeUserMessage(text: string): ModelMessage {
			return {
				role: "user",
				content: [{ type: "text", text }],
			} as ModelMessage
		}

		function makeAssistantMessage(text: string): ModelMessage {
			return {
				role: "assistant",
				content: [{ type: "text", text }],
			} as ModelMessage
		}

		it("should mark every 10th user message by default (0-indexed, marks index 9, 19, ...)", () => {
			// Create 12 user messages interleaved with assistant messages
			const messages: ModelMessage[] = []
			for (let i = 0; i < 12; i++) {
				messages.push(makeUserMessage(`user-${i}`))
				messages.push(makeAssistantMessage(`reply-${i}`))
			}

			applyCacheBreakpoints(messages, "openrouter", { style: "every-nth" })

			// Only the 10th user message (0-indexed: 9) should be marked.
			// In the messages array, user messages are at even indices: 0, 2, 4, ..., 22
			// The 10th user message (index 9) is at array position 18
			for (let i = 0; i < 12; i++) {
				const userMsgIdx = i * 2
				const hasCacheControl = (messages[userMsgIdx].content as any[])[0].providerOptions !== undefined
				if (i === 9) {
					expect(hasCacheControl).toBe(true)
				} else {
					expect(hasCacheControl).toBe(false)
				}
			}
		})

		it("should mark every Nth user message with custom frequency", () => {
			// Create 8 user messages
			const messages: ModelMessage[] = []
			for (let i = 0; i < 8; i++) {
				messages.push(makeUserMessage(`user-${i}`))
				messages.push(makeAssistantMessage(`reply-${i}`))
			}

			applyCacheBreakpoints(messages, "openrouter", { style: "every-nth", frequency: 3 })

			// With frequency=3, marks user indices 2, 5 (i.e., count % 3 === 2)
			for (let i = 0; i < 8; i++) {
				const userMsgIdx = i * 2
				const hasCacheControl = (messages[userMsgIdx].content as any[])[0].providerOptions !== undefined
				if (i === 2 || i === 5) {
					expect(hasCacheControl).toBe(true)
				} else {
					expect(hasCacheControl).toBe(false)
				}
			}
		})

		it("should not mark any messages if fewer than frequency", () => {
			const messages: ModelMessage[] = [
				makeUserMessage("first"),
				makeAssistantMessage("reply"),
				makeUserMessage("second"),
			]

			applyCacheBreakpoints(messages, "openrouter", { style: "every-nth", frequency: 10 })

			// Only 2 user messages, less than frequency 10: none should be marked
			expect((messages[0].content as any[])[0].providerOptions).toBeUndefined()
			expect((messages[2].content as any[])[0].providerOptions).toBeUndefined()
		})
	})
})
