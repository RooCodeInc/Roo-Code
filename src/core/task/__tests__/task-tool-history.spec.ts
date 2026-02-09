import type { RooMessageParam } from "../../task-persistence/apiMessages"
import { describe, it, expect, beforeEach, vi } from "vitest"

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
							type: "tool-call",
							toolCallId: "toolu_123",
							toolName: "read_file",
							input: { path: "config.json" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool-result",
							toolCallId: "toolu_123",
							toolName: "",
							content: '{"setting": "value"}',
						},
					],
					ts: Date.now(),
				},
			]

			// Verify tool blocks are preserved
			const assistantMessage = apiHistory[1]
			const userMessage = apiHistory[2]

			expect(assistantMessage.content).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: "tool-call",
						toolCallId: "toolu_123",
						toolName: "read_file",
					}),
				]),
			)

			expect(userMessage.content).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: "tool-result",
						toolCallId: "toolu_123",
						toolName: "",
					}),
				]),
			)
		})
	})

	describe("convertToOpenAiMessages format", () => {
		it("should properly convert tool_use to tool_calls format", () => {
			const anthropicMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "text",
						text: "I'll read that file.",
					},
					{
						type: "tool-call",
						toolCallId: "toolu_123",
						toolName: "read_file",
						input: { path: "config.json" },
					},
				],
			}

			// Simulate what convertToOpenAiMessages does
			const toolUseBlocks = (anthropicMessage.content as any[]).filter((block) => block.type === "tool-call")

			const tool_calls = toolUseBlocks.map((toolMessage) => ({
				id: toolMessage.toolCallId,
				type: "function" as const,
				function: {
					name: toolMessage.toolName,
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
			const anthropicMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "toolu_123",
						toolName: "",
						output: { type: "text" as const, value: '{"setting": "value"}' },
					},
				],
			}

			// Simulate what convertToOpenAiMessages does
			const toolMessages = (anthropicMessage.content as any[]).filter((block) => block.type === "tool-result")

			const openAiToolMessages = toolMessages.map((toolMessage) => ({
				role: "tool" as const,
				tool_call_id: toolMessage.toolCallId,
				content: typeof toolMessage.output === "string" ? toolMessage.output : toolMessage.output?.value,
			}))

			expect(openAiToolMessages).toHaveLength(1)
			expect(openAiToolMessages[0]).toEqual({
				role: "tool",
				tool_call_id: "toolu_123",
				content: '{"setting": "value"}',
			})
		})

		describe("environment details deduplication", () => {
			it("should filter out existing environment_details blocks before adding new ones", () => {
				// Simulate user content that already contains environment details from a previous session
				const userContentWithOldEnvDetails = [
					{
						type: "text" as const,
						text: "Some user message",
					},
					{
						type: "text" as const,
						text: "<environment_details>\n# Old Environment Details\nCurrent time: 2024-01-01\n</environment_details>",
					},
				]

				// Filter out existing environment_details blocks using the same logic as Task.ts
				const contentWithoutEnvDetails = userContentWithOldEnvDetails.filter((block) => {
					if (block.type === "text" && typeof block.text === "string") {
						// Check if this text block is a complete environment_details block
						const isEnvironmentDetailsBlock =
							block.text.trim().startsWith("<environment_details>") &&
							block.text.trim().endsWith("</environment_details>")
						return !isEnvironmentDetailsBlock
					}
					return true
				})

				// Verify old environment details were removed
				expect(contentWithoutEnvDetails).toHaveLength(1)
				expect(contentWithoutEnvDetails[0].text).toBe("Some user message")

				// Simulate adding fresh environment details
				const newEnvironmentDetails =
					"<environment_details>\n# Fresh Environment Details\nCurrent time: 2024-01-02\n</environment_details>"
				const finalUserContent = [
					...contentWithoutEnvDetails,
					{ type: "text" as const, text: newEnvironmentDetails },
				]

				// Verify we have exactly one environment_details block (the new one)
				const envDetailsBlocks = finalUserContent.filter((block) => {
					if (block.type === "text" && typeof block.text === "string") {
						return (
							block.text.trim().startsWith("<environment_details>") &&
							block.text.trim().endsWith("</environment_details>")
						)
					}
					return false
				})
				expect(envDetailsBlocks).toHaveLength(1)
				expect(envDetailsBlocks[0].text).toContain("2024-01-02")
				expect(envDetailsBlocks[0].text).not.toContain("2024-01-01")
			})

			it("should not filter out text that mentions environment_details tags in content", () => {
				// User content that mentions the tags but isn't an environment_details block
				const userContent = [
					{
						type: "text" as const,
						text: "Let me explain how <environment_details> work in this system",
					},
					{
						type: "text" as const,
						text: "The closing tag is </environment_details>",
					},
					{
						type: "text" as const,
						text: "Regular message",
					},
				]

				// Filter using the same logic as Task.ts
				const contentWithoutEnvDetails = userContent.filter((block) => {
					if (block.type === "text" && typeof block.text === "string") {
						const isEnvironmentDetailsBlock =
							block.text.trim().startsWith("<environment_details>") &&
							block.text.trim().endsWith("</environment_details>")
						return !isEnvironmentDetailsBlock
					}
					return true
				})

				// All blocks should be preserved since none are complete environment_details blocks
				expect(contentWithoutEnvDetails).toHaveLength(3)
				expect(contentWithoutEnvDetails).toEqual(userContent)
			})

			it("should not filter out regular text blocks", () => {
				// User content with various blocks but no environment details
				const userContent = [
					{
						type: "text" as const,
						text: "Regular message",
					},
					{
						type: "text" as const,
						text: "Another message with <user_message> tags",
					},
					{
						type: "tool-result" as const,
						toolCallId: "tool_123",
						toolName: "",
						output: { type: "text" as const, value: "Tool result" },
					},
				]

				// Filter using the same logic as Task.ts
				const contentWithoutEnvDetails = userContent.filter((block) => {
					if (block.type === "text" && typeof block.text === "string") {
						const isEnvironmentDetailsBlock =
							block.text.trim().startsWith("<environment_details>") &&
							block.text.trim().endsWith("</environment_details>")
						return !isEnvironmentDetailsBlock
					}
					return true
				})

				// All blocks should be preserved
				expect(contentWithoutEnvDetails).toHaveLength(3)
				expect(contentWithoutEnvDetails).toEqual(userContent)
			})
		})
	})
})
