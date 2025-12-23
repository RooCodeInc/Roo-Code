// npx vitest run api/transform/__tests__/minimax-format.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"

import { extractEnvironmentDetailsForMiniMax } from "../minimax-format"

describe("extractEnvironmentDetailsForMiniMax", () => {
	it("should pass through simple text messages unchanged", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
			{
				role: "assistant",
				content: "Hi there!",
			},
		]

		const result = extractEnvironmentDetailsForMiniMax(messages)

		expect(result.messages).toHaveLength(2)
		expect(result.messages).toEqual(messages)
		expect(result.extractedSystemContent).toHaveLength(0)
	})

	it("should pass through user messages with only tool_result blocks unchanged", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-123",
						content: "Tool result content",
					},
				],
			},
		]

		const result = extractEnvironmentDetailsForMiniMax(messages)

		expect(result.messages).toHaveLength(1)
		expect(result.messages).toEqual(messages)
		expect(result.extractedSystemContent).toHaveLength(0)
	})

	it("should pass through user messages with only text blocks unchanged", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Some user message",
					},
				],
			},
		]

		const result = extractEnvironmentDetailsForMiniMax(messages)

		expect(result.messages).toHaveLength(1)
		expect(result.messages).toEqual(messages)
		expect(result.extractedSystemContent).toHaveLength(0)
	})

	it("should extract text content from user messages with tool_result AND text blocks", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-123",
						content: "Tool result content",
					},
					{
						type: "text",
						text: "<environment_details>\nCurrent Time: 2024-01-01\n</environment_details>",
					},
				],
			},
		]

		const result = extractEnvironmentDetailsForMiniMax(messages)

		// The text should be extracted
		expect(result.extractedSystemContent).toHaveLength(1)
		expect(result.extractedSystemContent[0]).toBe(
			"<environment_details>\nCurrent Time: 2024-01-01\n</environment_details>",
		)

		// The message should only contain tool_result
		expect(result.messages).toHaveLength(1)
		expect(result.messages[0].role).toBe("user")
		const content = result.messages[0].content as Anthropic.Messages.ContentBlockParam[]
		expect(content).toHaveLength(1)
		expect(content[0].type).toBe("tool_result")
	})

	it("should extract multiple text blocks from a single message", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-123",
						content: "Tool result 1",
					},
					{
						type: "text",
						text: "First text block",
					},
					{
						type: "tool_result",
						tool_use_id: "tool-456",
						content: "Tool result 2",
					},
					{
						type: "text",
						text: "Second text block",
					},
				],
			},
		]

		const result = extractEnvironmentDetailsForMiniMax(messages)

		// Both text blocks should be extracted
		expect(result.extractedSystemContent).toHaveLength(2)
		expect(result.extractedSystemContent[0]).toBe("First text block")
		expect(result.extractedSystemContent[1]).toBe("Second text block")

		// The message should only contain tool_result blocks
		expect(result.messages).toHaveLength(1)
		const content = result.messages[0].content as Anthropic.Messages.ContentBlockParam[]
		expect(content).toHaveLength(2)
		expect(content[0].type).toBe("tool_result")
		expect(content[1].type).toBe("tool_result")
	})

	it("should NOT extract text when images are present (cannot move images to system)", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-123",
						content: "Tool result content",
					},
					{
						type: "text",
						text: "Some text",
					},
					{
						type: "image",
						source: {
							type: "base64",
							media_type: "image/png",
							data: "base64data",
						},
					},
				],
			},
		]

		const result = extractEnvironmentDetailsForMiniMax(messages)

		// Nothing should be extracted since images are present
		expect(result.extractedSystemContent).toHaveLength(0)

		// Message should be unchanged
		expect(result.messages).toHaveLength(1)
		expect(result.messages).toEqual(messages)
	})

	it("should pass through assistant messages unchanged", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: "I will help you with that.",
					},
					{
						type: "tool_use",
						id: "tool-123",
						name: "read_file",
						input: { path: "test.ts" },
					},
				],
			},
		]

		const result = extractEnvironmentDetailsForMiniMax(messages)

		expect(result.messages).toHaveLength(1)
		expect(result.messages).toEqual(messages)
		expect(result.extractedSystemContent).toHaveLength(0)
	})

	it("should handle mixed conversation with extraction only for eligible messages", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Create a file",
			},
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: "I'll create the file.",
					},
					{
						type: "tool_use",
						id: "tool-123",
						name: "write_file",
						input: { path: "test.ts", content: "// test" },
					},
				],
			},
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-123",
						content: "File created successfully",
					},
					{
						type: "text",
						text: "<environment_details>\nCurrent Time: 2024-01-01\n</environment_details>",
					},
				],
			},
			{
				role: "assistant",
				content: "The file has been created.",
			},
		]

		const result = extractEnvironmentDetailsForMiniMax(messages)

		// Should extract the environment_details from the third message
		expect(result.extractedSystemContent).toHaveLength(1)
		expect(result.extractedSystemContent[0]).toContain("environment_details")

		// Should have all 4 messages
		expect(result.messages).toHaveLength(4)

		// First user message unchanged (simple string)
		expect(result.messages[0]).toEqual(messages[0])

		// Assistant message unchanged
		expect(result.messages[1]).toEqual(messages[1])

		// Third message should have only tool_result
		const thirdMessage = result.messages[2].content as Anthropic.Messages.ContentBlockParam[]
		expect(thirdMessage).toHaveLength(1)
		expect(thirdMessage[0].type).toBe("tool_result")

		// Fourth message unchanged
		expect(result.messages[3]).toEqual(messages[3])
	})

	it("should handle string content in user messages", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Just a string message",
			},
		]

		const result = extractEnvironmentDetailsForMiniMax(messages)

		expect(result.messages).toHaveLength(1)
		expect(result.messages).toEqual(messages)
		expect(result.extractedSystemContent).toHaveLength(0)
	})

	it("should handle empty messages array", () => {
		const messages: Anthropic.Messages.MessageParam[] = []

		const result = extractEnvironmentDetailsForMiniMax(messages)

		expect(result.messages).toHaveLength(0)
		expect(result.extractedSystemContent).toHaveLength(0)
	})
})
