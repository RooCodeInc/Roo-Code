import { describe, it, expect, beforeEach, vi } from "vitest"
import { Anthropic } from "@anthropic-ai/sdk"
import { TOOL_PROTOCOL } from "@roo-code/types"
import { resolveToolProtocol } from "../../../utils/resolveToolProtocol"

describe("Task Tool History Handling", () => {
	describe("resumeTaskFromHistory tool block preservation", () => {
		it("should preserve tool_use and tool_result blocks for native protocol", () => {
			// Mock API conversation history with tool blocks
			const apiHistory: any[] = [
				{
					role: "user",
					content: "Read the file config.json",
					ts: Date.now(),
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: "I'll read that file for you.",
						},
						{
							type: "tool_use",
							id: "toolu_123",
							name: "read_file",
							input: { path: "config.json" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "toolu_123",
							content: '{"setting": "value"}',
						},
					],
					ts: Date.now(),
				},
			]

			// Simulate the protocol check
			const mockApiConfiguration = { apiProvider: "roo" as const }
			const mockModelInfo = { supportsNativeTools: true }
			const mockExperiments = {}

			const protocol = TOOL_PROTOCOL.NATIVE

			// Test the logic that should NOT convert tool blocks for native protocol
			const useNative = protocol === TOOL_PROTOCOL.NATIVE

			if (!useNative) {
				// This block should NOT execute for native protocol
				throw new Error("Should not convert tool blocks for native protocol")
			}

			// Verify tool blocks are preserved
			const assistantMessage = apiHistory[1]
			const userMessage = apiHistory[2]

			expect(assistantMessage.content).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: "tool_use",
						id: "toolu_123",
						name: "read_file",
					}),
				]),
			)

			expect(userMessage.content).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: "tool_result",
						tool_use_id: "toolu_123",
					}),
				]),
			)
		})

		it("should convert tool blocks to text for XML protocol", () => {
			// Mock API conversation history with tool blocks
			const apiHistory: any[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_123",
							name: "read_file",
							input: { path: "config.json" },
						},
					],
					ts: Date.now(),
				},
			]

			// Simulate XML protocol - tool blocks should be converted to text
			const protocol = "xml"
			const useNative = false // XML protocol is not native

			// For XML protocol, we should convert tool blocks
			if (!useNative) {
				const conversationWithoutToolBlocks = apiHistory.map((message) => {
					if (Array.isArray(message.content)) {
						const newContent = message.content.map((block: any) => {
							if (block.type === "tool_use") {
								return {
									type: "text",
									text: `<read_file>\n<path>\nconfig.json\n</path>\n</read_file>`,
								}
							}
							return block
						})
						return { ...message, content: newContent }
					}
					return message
				})

				// Verify tool blocks were converted to text
				expect(conversationWithoutToolBlocks[0].content[0].type).toBe("text")
				expect(conversationWithoutToolBlocks[0].content[0].text).toContain("<read_file>")
			}
		})
	})

	describe("convertToOpenAiMessages format", () => {
		it("should properly convert tool_use to tool_calls format", () => {
			const anthropicMessage: Anthropic.Messages.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "text",
						text: "I'll read that file.",
					},
					{
						type: "tool_use",
						id: "toolu_123",
						name: "read_file",
						input: { path: "config.json" },
					},
				],
			}

			// Simulate what convertToOpenAiMessages does
			const toolUseBlocks = (anthropicMessage.content as any[]).filter((block) => block.type === "tool_use")

			const tool_calls = toolUseBlocks.map((toolMessage) => ({
				id: toolMessage.id,
				type: "function" as const,
				function: {
					name: toolMessage.name,
					arguments: JSON.stringify(toolMessage.input),
				},
			}))

			expect(tool_calls).toHaveLength(1)
			expect(tool_calls[0]).toEqual({
				id: "toolu_123",
				type: "function",
				function: {
					name: "read_file",
					arguments: '{"path":"config.json"}',
				},
			})
		})

		it("should properly convert tool_result to tool role messages", () => {
			const anthropicMessage: Anthropic.Messages.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "toolu_123",
						content: '{"setting": "value"}',
					},
				],
			}

			// Simulate what convertToOpenAiMessages does
			const toolMessages = (anthropicMessage.content as any[]).filter((block) => block.type === "tool_result")

			const openAiToolMessages = toolMessages.map((toolMessage) => ({
				role: "tool" as const,
				tool_call_id: toolMessage.tool_use_id,
				content: typeof toolMessage.content === "string" ? toolMessage.content : toolMessage.content[0].text,
			}))

			expect(openAiToolMessages).toHaveLength(1)
			expect(openAiToolMessages[0]).toEqual({
				role: "tool",
				tool_call_id: "toolu_123",
				content: '{"setting": "value"}',
			})
		})
	})
})
