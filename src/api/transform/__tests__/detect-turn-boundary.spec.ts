// npx vitest run api/transform/__tests__/detect-turn-boundary.spec.ts

import { isNewUserTurn } from "../detect-turn-boundary"
import { Anthropic } from "@anthropic-ai/sdk"

describe("isNewUserTurn", () => {
	describe("new turn detection", () => {
		it("should return true when last message is user message", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "assistant", content: "Previous answer" },
				{ role: "user", content: "New question" },
			]

			expect(isNewUserTurn(messages)).toBe(true)
		})

		it("should return true when only user messages exist", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "First question" },
				{ role: "user", content: "Second question" },
			]

			expect(isNewUserTurn(messages)).toBe(true)
		})

		it("should return true when assistant message without tool_calls is followed by user message", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Question" },
				{ role: "assistant", content: "Answer" },
				{ role: "user", content: "New question" },
			]

			expect(isNewUserTurn(messages)).toBe(true)
		})

		it("should return true when assistant finishes answering and user asks new question", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "What is 2+2?" },
				{ role: "assistant", content: "The answer is 4" },
				{ role: "user", content: "What is 3+3?" },
			]

			expect(isNewUserTurn(messages)).toBe(true)
		})
	})

	describe("tool call continuation detection", () => {
		it("should return false when last message is assistant with tool_use blocks", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Get the weather" },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-1",
							name: "get_weather",
							input: { location: "NYC" },
						},
					],
				},
			]

			expect(isNewUserTurn(messages)).toBe(false)
		})

		it("should return false when last message is assistant with tool_use and content", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Question" },
				{
					role: "assistant",
					content: [
						{ type: "text", text: "Let me check" },
						{
							type: "tool_use",
							id: "tool-1",
							name: "get_info",
							input: {},
						},
					],
				},
			]

			expect(isNewUserTurn(messages)).toBe(false)
		})

		it("should return false when last message is assistant after tool results", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Get weather" },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-1",
							name: "get_weather",
							input: {},
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-1",
							content: "Sunny, 72°F",
						},
					],
				},
				{ role: "assistant", content: "The weather is sunny" },
			]

			expect(isNewUserTurn(messages)).toBe(false)
		})

		it("should return false for multiple tool call rounds in same turn", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Complex task" },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-1",
							name: "step1",
							input: {},
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-1",
							content: "Result 1",
						},
					],
				},
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-2",
							name: "step2",
							input: {},
						},
					],
				},
			]

			expect(isNewUserTurn(messages)).toBe(false)
		})
	})

	describe("edge cases", () => {
		it("should return true for empty messages array", () => {
			expect(isNewUserTurn([])).toBe(true)
		})

		it("should return true when only one assistant message exists", () => {
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "assistant", content: "Answer" }]

			expect(isNewUserTurn(messages)).toBe(true)
		})

		it("should return false when multiple assistant messages in sequence", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Question" },
				{ role: "assistant", content: "Part 1" },
				{ role: "assistant", content: "Part 2" },
			]

			expect(isNewUserTurn(messages)).toBe(false)
		})

		it("should handle user message with tool_result blocks correctly", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-1",
							name: "get_date",
							input: {},
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-1",
							content: "2025-01-01",
						},
					],
				},
				{ role: "assistant", content: "The date is 2025-01-01" },
			]

			expect(isNewUserTurn(messages)).toBe(false)
		})

		it("should handle user message with both text and tool_result blocks", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-1",
							name: "get_info",
							input: {},
						},
					],
				},
				{
					role: "user",
					content: [
						{ type: "text", text: "Here's the result:" },
						{
							type: "tool_result",
							tool_use_id: "tool-1",
							content: "Info",
						},
					],
				},
				{ role: "assistant", content: "Thanks" },
			]

			expect(isNewUserTurn(messages)).toBe(false)
		})
	})
})
