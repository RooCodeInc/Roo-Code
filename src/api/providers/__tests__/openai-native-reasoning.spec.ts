import type { RooMessage } from "../../../core/task-persistence/rooMessage"
// npx vitest run api/providers/__tests__/openai-native-reasoning.spec.ts

import type { Anthropic } from "@anthropic-ai/sdk"
import type { ModelMessage } from "ai"

import {
	stripPlainTextReasoningBlocks,
	collectEncryptedReasoningItems,
	injectEncryptedReasoning,
	type EncryptedReasoningItem,
} from "../openai-native"

describe("OpenAI Native reasoning helpers", () => {
	// ───────────────────────────────────────────────────────────
	// stripPlainTextReasoningBlocks
	// ───────────────────────────────────────────────────────────
	describe("stripPlainTextReasoningBlocks", () => {
		it("passes through user messages unchanged", () => {
			const messages: RooMessage[] = [{ role: "user", content: [{ type: "text", text: "Hello" }] }]
			const result = stripPlainTextReasoningBlocks(messages)
			expect(result).toEqual(messages)
		})

		it("passes through assistant messages with only text blocks", () => {
			const messages: RooMessage[] = [{ role: "assistant", content: [{ type: "text", text: "Hi there" }] }]
			const result = stripPlainTextReasoningBlocks(messages)
			expect(result).toEqual(messages)
		})

		it("passes through string-content assistant messages", () => {
			const messages: RooMessage[] = [{ role: "assistant", content: "Hello" }]
			const result = stripPlainTextReasoningBlocks(messages)
			expect(result).toEqual(messages)
		})

		it("strips plain-text reasoning blocks from assistant content", () => {
			const messages: RooMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "reasoning",
							text: "Let me think...",
						} as any,
						{ type: "text", text: "The answer is 42" },
					],
				},
			]
			const result = stripPlainTextReasoningBlocks(messages)
			expect(result).toHaveLength(1)
			expect((result[0] as any).content).toEqual([{ type: "text", text: "The answer is 42" }])
		})

		it("removes assistant messages whose content becomes empty after filtering", () => {
			const messages: RooMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "reasoning",
							text: "Thinking only...",
						} as any,
					],
				},
			]
			const result = stripPlainTextReasoningBlocks(messages)
			expect(result).toHaveLength(0)
		})

		it("preserves tool_use blocks alongside stripped reasoning", () => {
			const messages: RooMessage[] = [
				{
					role: "assistant",
					content: [
						{ type: "reasoning", text: "Thinking..." } as any,
						{ type: "tool_use", id: "call_1", name: "read_file", input: { path: "a.ts" } },
					],
				},
			]
			const result = stripPlainTextReasoningBlocks(messages)
			expect(result).toHaveLength(1)
			expect((result[0] as any).content).toEqual([
				{ type: "tool_use", id: "call_1", name: "read_file", input: { path: "a.ts" } },
			])
		})

		it("does NOT strip blocks that have encrypted_content (those are not plain-text reasoning)", () => {
			const messages: RooMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "reasoning",
							text: "summary",
							encrypted_content: "abc123",
						} as any,
						{ type: "text", text: "Response" },
					],
				},
			]
			const result = stripPlainTextReasoningBlocks(messages)
			expect(result).toHaveLength(1)
			// Both blocks should remain
			expect((result[0] as any).content).toHaveLength(2)
		})

		it("handles multiple messages correctly", () => {
			const messages: RooMessage[] = [
				{ role: "user", content: [{ type: "text", text: "Q1" }] },
				{
					role: "assistant",
					content: [{ type: "reasoning", text: "Think1" } as any, { type: "text", text: "A1" }],
				},
				{ role: "user", content: [{ type: "text", text: "Q2" }] },
				{
					role: "assistant",
					content: [{ type: "reasoning", text: "Think2" } as any, { type: "text", text: "A2" }],
				},
			]
			const result = stripPlainTextReasoningBlocks(messages)
			expect(result).toHaveLength(4)
			expect((result[1] as any).content).toEqual([{ type: "text", text: "A1" }])
			expect((result[3] as any).content).toEqual([{ type: "text", text: "A2" }])
		})
	})

	// ───────────────────────────────────────────────────────────
	// collectEncryptedReasoningItems
	// ───────────────────────────────────────────────────────────
	describe("collectEncryptedReasoningItems", () => {
		it("returns empty array when no encrypted reasoning items exist", () => {
			const messages: RooMessage[] = [
				{ role: "user", content: [{ type: "text", text: "Hello" }] },
				{ role: "assistant", content: [{ type: "text", text: "Hi" }] },
			]
			const result = collectEncryptedReasoningItems(messages)
			expect(result).toEqual([])
		})

		it("collects a single encrypted reasoning item", () => {
			const messages = [
				{ role: "user", content: [{ type: "text", text: "Hello" }] },
				{
					type: "reasoning",
					id: "rs_abc",
					encrypted_content: "encrypted_data_1",
					summary: [{ type: "summary_text", text: "I thought about it" }],
				},
				{ role: "assistant", content: [{ type: "text", text: "Hi" }] },
			] as unknown as RooMessage[]

			const result = collectEncryptedReasoningItems(messages)
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				id: "rs_abc",
				encrypted_content: "encrypted_data_1",
				summary: [{ type: "summary_text", text: "I thought about it" }],
				originalIndex: 1,
			})
		})

		it("collects multiple encrypted reasoning items with correct indices", () => {
			const messages = [
				{ role: "user", content: [{ type: "text", text: "Q1" }] },
				{
					type: "reasoning",
					id: "rs_1",
					encrypted_content: "enc_1",
					summary: [{ type: "summary_text", text: "Summary 1" }],
				},
				{ role: "assistant", content: [{ type: "text", text: "A1" }] },
				{ role: "user", content: [{ type: "text", text: "Q2" }] },
				{
					type: "reasoning",
					id: "rs_2",
					encrypted_content: "enc_2",
					summary: [{ type: "summary_text", text: "Summary 2" }],
				},
				{ role: "assistant", content: [{ type: "text", text: "A2" }] },
			] as unknown as RooMessage[]

			const result = collectEncryptedReasoningItems(messages)
			expect(result).toHaveLength(2)
			expect(result[0].id).toBe("rs_1")
			expect(result[0].originalIndex).toBe(1)
			expect(result[1].id).toBe("rs_2")
			expect(result[1].originalIndex).toBe(4)
		})

		it("ignores messages that have type 'reasoning' but no encrypted_content", () => {
			const messages = [
				{ type: "reasoning", id: "rs_x", text: "plain reasoning" },
				{ role: "user", content: [{ type: "text", text: "Hello" }] },
			] as unknown as RooMessage[]

			const result = collectEncryptedReasoningItems(messages)
			expect(result).toEqual([])
		})

		it("handles items without summary", () => {
			const messages = [
				{
					type: "reasoning",
					id: "rs_no_summary",
					encrypted_content: "enc_data",
				},
				{ role: "assistant", content: [{ type: "text", text: "Hi" }] },
			] as unknown as RooMessage[]

			const result = collectEncryptedReasoningItems(messages)
			expect(result).toHaveLength(1)
			expect(result[0].summary).toBeUndefined()
		})
	})

	// ───────────────────────────────────────────────────────────
	// injectEncryptedReasoning
	// ───────────────────────────────────────────────────────────
	describe("injectEncryptedReasoning", () => {
		it("does nothing when encryptedItems is empty", () => {
			const aiSdkMessages: ModelMessage[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: [{ type: "text", text: "Hi" }] },
			]
			const original = JSON.parse(JSON.stringify(aiSdkMessages))
			injectEncryptedReasoning(aiSdkMessages, [], [])
			expect(aiSdkMessages).toEqual(original)
		})

		it("injects a single encrypted reasoning part into the next assistant message", () => {
			// Original messages: [user, encrypted_reasoning, assistant]
			const originalMessages = [
				{ role: "user", content: [{ type: "text", text: "Hello" }] },
				{
					type: "reasoning",
					id: "rs_abc",
					encrypted_content: "enc_123",
					summary: [{ type: "summary_text", text: "I considered the question" }],
				},
				{ role: "assistant", content: [{ type: "text", text: "Hi there" }] },
			] as unknown as RooMessage[]

			// AI SDK messages (after filtering encrypted items + converting)
			const aiSdkMessages: ModelMessage[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: [{ type: "text", text: "Hi there" }] },
			]

			const encryptedItems: EncryptedReasoningItem[] = [
				{
					id: "rs_abc",
					encrypted_content: "enc_123",
					summary: [{ type: "summary_text", text: "I considered the question" }],
					originalIndex: 1,
				},
			]

			injectEncryptedReasoning(aiSdkMessages, encryptedItems, originalMessages)

			const assistantMsg = aiSdkMessages[1] as Record<string, unknown>
			const content = assistantMsg.content as unknown[]
			expect(content).toHaveLength(2)

			// First part should be the injected reasoning
			const reasoningPart = content[0] as Record<string, unknown>
			expect(reasoningPart.type).toBe("reasoning")
			expect(reasoningPart.text).toBe("I considered the question")

			const providerOptions = reasoningPart.providerOptions as Record<string, Record<string, unknown>>
			expect(providerOptions.openai.itemId).toBe("rs_abc")
			expect(providerOptions.openai.reasoningEncryptedContent).toBe("enc_123")

			// Second part should be the original text
			const textPart = content[1] as Record<string, unknown>
			expect(textPart.type).toBe("text")
			expect(textPart.text).toBe("Hi there")
		})

		it("handles multiple encrypted reasoning items across different assistant messages", () => {
			const originalMessages = [
				{ role: "user", content: [{ type: "text", text: "Q1" }] },
				{
					type: "reasoning",
					id: "rs_1",
					encrypted_content: "enc_1",
					summary: [{ type: "summary_text", text: "Thought 1" }],
				},
				{ role: "assistant", content: [{ type: "text", text: "A1" }] },
				{ role: "user", content: [{ type: "text", text: "Q2" }] },
				{
					type: "reasoning",
					id: "rs_2",
					encrypted_content: "enc_2",
					summary: [{ type: "summary_text", text: "Thought 2" }],
				},
				{ role: "assistant", content: [{ type: "text", text: "A2" }] },
			] as unknown as RooMessage[]

			const aiSdkMessages: ModelMessage[] = [
				{ role: "user", content: "Q1" },
				{ role: "assistant", content: [{ type: "text", text: "A1" }] },
				{ role: "user", content: "Q2" },
				{ role: "assistant", content: [{ type: "text", text: "A2" }] },
			]

			const encryptedItems: EncryptedReasoningItem[] = [
				{
					id: "rs_1",
					encrypted_content: "enc_1",
					summary: [{ type: "summary_text", text: "Thought 1" }],
					originalIndex: 1,
				},
				{
					id: "rs_2",
					encrypted_content: "enc_2",
					summary: [{ type: "summary_text", text: "Thought 2" }],
					originalIndex: 4,
				},
			]

			injectEncryptedReasoning(aiSdkMessages, encryptedItems, originalMessages)

			// First assistant message
			const content1 = (aiSdkMessages[1] as Record<string, unknown>).content as unknown[]
			expect(content1).toHaveLength(2)
			expect((content1[0] as Record<string, unknown>).type).toBe("reasoning")
			expect(
				((content1[0] as Record<string, unknown>).providerOptions as Record<string, Record<string, unknown>>)
					.openai.itemId,
			).toBe("rs_1")

			// Second assistant message
			const content2 = (aiSdkMessages[3] as Record<string, unknown>).content as unknown[]
			expect(content2).toHaveLength(2)
			expect((content2[0] as Record<string, unknown>).type).toBe("reasoning")
			expect(
				((content2[0] as Record<string, unknown>).providerOptions as Record<string, Record<string, unknown>>)
					.openai.itemId,
			).toBe("rs_2")
		})

		it("joins multiple summary texts with newlines", () => {
			const originalMessages = [
				{ role: "user", content: [{ type: "text", text: "Hi" }] },
				{
					type: "reasoning",
					id: "rs_multi",
					encrypted_content: "enc_multi",
					summary: [
						{ type: "summary_text", text: "First thought" },
						{ type: "summary_text", text: "Second thought" },
					],
				},
				{ role: "assistant", content: [{ type: "text", text: "Response" }] },
			] as unknown as RooMessage[]

			const aiSdkMessages: ModelMessage[] = [
				{ role: "user", content: "Hi" },
				{ role: "assistant", content: [{ type: "text", text: "Response" }] },
			]

			const encryptedItems: EncryptedReasoningItem[] = [
				{
					id: "rs_multi",
					encrypted_content: "enc_multi",
					summary: [
						{ type: "summary_text", text: "First thought" },
						{ type: "summary_text", text: "Second thought" },
					],
					originalIndex: 1,
				},
			]

			injectEncryptedReasoning(aiSdkMessages, encryptedItems, originalMessages)

			const content = (aiSdkMessages[1] as Record<string, unknown>).content as unknown[]
			const reasoningPart = content[0] as Record<string, unknown>
			expect(reasoningPart.text).toBe("First thought\nSecond thought")
		})

		it("uses empty string when summary is undefined", () => {
			const originalMessages = [
				{ role: "user", content: [{ type: "text", text: "Hi" }] },
				{
					type: "reasoning",
					id: "rs_nosummary",
					encrypted_content: "enc_nosummary",
				},
				{ role: "assistant", content: [{ type: "text", text: "Response" }] },
			] as unknown as RooMessage[]

			const aiSdkMessages: ModelMessage[] = [
				{ role: "user", content: "Hi" },
				{ role: "assistant", content: [{ type: "text", text: "Response" }] },
			]

			const encryptedItems: EncryptedReasoningItem[] = [
				{
					id: "rs_nosummary",
					encrypted_content: "enc_nosummary",
					summary: undefined,
					originalIndex: 1,
				},
			]

			injectEncryptedReasoning(aiSdkMessages, encryptedItems, originalMessages)

			const content = (aiSdkMessages[1] as Record<string, unknown>).content as unknown[]
			const reasoningPart = content[0] as Record<string, unknown>
			expect(reasoningPart.text).toBe("")
		})

		it("handles consecutive encrypted items before the same assistant message", () => {
			// Two encrypted reasoning items before one assistant message
			const originalMessages = [
				{ role: "user", content: [{ type: "text", text: "Hi" }] },
				{
					type: "reasoning",
					id: "rs_a",
					encrypted_content: "enc_a",
					summary: [{ type: "summary_text", text: "Step A" }],
				},
				{
					type: "reasoning",
					id: "rs_b",
					encrypted_content: "enc_b",
					summary: [{ type: "summary_text", text: "Step B" }],
				},
				{ role: "assistant", content: [{ type: "text", text: "Done" }] },
			] as unknown as RooMessage[]

			const aiSdkMessages: ModelMessage[] = [
				{ role: "user", content: "Hi" },
				{ role: "assistant", content: [{ type: "text", text: "Done" }] },
			]

			const encryptedItems: EncryptedReasoningItem[] = [
				{
					id: "rs_a",
					encrypted_content: "enc_a",
					summary: [{ type: "summary_text", text: "Step A" }],
					originalIndex: 1,
				},
				{
					id: "rs_b",
					encrypted_content: "enc_b",
					summary: [{ type: "summary_text", text: "Step B" }],
					originalIndex: 2,
				},
			]

			injectEncryptedReasoning(aiSdkMessages, encryptedItems, originalMessages)

			const content = (aiSdkMessages[1] as Record<string, unknown>).content as unknown[]
			// Both reasoning parts should be injected before the text
			expect(content).toHaveLength(3)
			expect((content[0] as Record<string, unknown>).type).toBe("reasoning")
			expect(
				((content[0] as Record<string, unknown>).providerOptions as Record<string, Record<string, unknown>>)
					.openai.itemId,
			).toBe("rs_a")
			expect((content[1] as Record<string, unknown>).type).toBe("reasoning")
			expect(
				((content[1] as Record<string, unknown>).providerOptions as Record<string, Record<string, unknown>>)
					.openai.itemId,
			).toBe("rs_b")
			expect((content[2] as Record<string, unknown>).type).toBe("text")
		})

		it("handles tool messages splitting (user messages with tool_results create extra tool-role messages)", () => {
			// Original: [user_with_tool_result, encrypted_reasoning, assistant]
			// After filtering: [user_with_tool_result, assistant]
			// AI SDK: [tool, user, assistant] (tool_result split into tool + user messages)
			const originalMessages = [
				{
					role: "user",
					content: [
						{ type: "tool_result", tool_use_id: "call_1", content: "result" },
						{ type: "text", text: "Continue" },
					],
				},
				{
					type: "reasoning",
					id: "rs_tool",
					encrypted_content: "enc_tool",
					summary: [{ type: "summary_text", text: "Thought after tool" }],
				},
				{ role: "assistant", content: [{ type: "text", text: "OK" }] },
			] as unknown as RooMessage[]

			// AI SDK messages after conversion (tool_result splits into tool + user)
			const aiSdkMessages: ModelMessage[] = [
				{
					role: "tool",
					content: [
						{ type: "tool-result", toolCallId: "call_1", toolName: "unknown_tool", result: "result" },
					],
				} as unknown as ModelMessage,
				{ role: "user", content: [{ type: "text", text: "Continue" }] },
				{ role: "assistant", content: [{ type: "text", text: "OK" }] },
			]

			const encryptedItems: EncryptedReasoningItem[] = [
				{
					id: "rs_tool",
					encrypted_content: "enc_tool",
					summary: [{ type: "summary_text", text: "Thought after tool" }],
					originalIndex: 1,
				},
			]

			injectEncryptedReasoning(aiSdkMessages, encryptedItems, originalMessages)

			// The assistant message (index 2) should have the reasoning injected
			const content = (aiSdkMessages[2] as Record<string, unknown>).content as unknown[]
			expect(content).toHaveLength(2)
			expect((content[0] as Record<string, unknown>).type).toBe("reasoning")
			expect(
				((content[0] as Record<string, unknown>).providerOptions as Record<string, Record<string, unknown>>)
					.openai.itemId,
			).toBe("rs_tool")
		})

		it("gracefully handles encrypted items with no following assistant message", () => {
			const originalMessages = [
				{ role: "user", content: [{ type: "text", text: "Hi" }] },
				{
					type: "reasoning",
					id: "rs_orphan",
					encrypted_content: "enc_orphan",
				},
			] as unknown as RooMessage[]

			const aiSdkMessages: ModelMessage[] = [{ role: "user", content: "Hi" }]

			const encryptedItems: EncryptedReasoningItem[] = [
				{
					id: "rs_orphan",
					encrypted_content: "enc_orphan",
					summary: undefined,
					originalIndex: 1,
				},
			]

			// Should not throw
			expect(() => {
				injectEncryptedReasoning(aiSdkMessages, encryptedItems, originalMessages)
			}).not.toThrow()

			// User message unchanged
			expect(aiSdkMessages).toHaveLength(1)
			expect(aiSdkMessages[0].role).toBe("user")
		})
	})
})
