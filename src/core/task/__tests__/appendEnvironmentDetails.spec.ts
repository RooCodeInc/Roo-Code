import { Anthropic } from "@anthropic-ai/sdk"
import { appendEnvironmentDetails, removeEnvironmentDetailsBlocks, UserContentBlock } from "../appendEnvironmentDetails"

describe("appendEnvironmentDetails", () => {
	const envDetails = "<environment_details>\n# Test\nSome details\n</environment_details>"

	describe("empty content", () => {
		it("should return a text block when content is empty", () => {
			const result = appendEnvironmentDetails([], envDetails)

			expect(result).toHaveLength(1)
			expect(result[0].type).toBe("text")
			expect((result[0] as Anthropic.Messages.TextBlockParam).text).toBe(envDetails)
		})
	})

	describe("text block handling", () => {
		it("should append to the last text block", () => {
			const content: UserContentBlock[] = [{ type: "text", text: "User message" }]

			const result = appendEnvironmentDetails(content, envDetails)

			expect(result).toHaveLength(1)
			expect(result[0].type).toBe("text")
			expect((result[0] as Anthropic.Messages.TextBlockParam).text).toBe("User message\n\n" + envDetails)
		})

		it("should append to the last text block when multiple text blocks exist", () => {
			const content: UserContentBlock[] = [
				{ type: "text", text: "First message" },
				{ type: "text", text: "Second message" },
			]

			const result = appendEnvironmentDetails(content, envDetails)

			expect(result).toHaveLength(2)
			expect((result[0] as Anthropic.Messages.TextBlockParam).text).toBe("First message")
			expect((result[1] as Anthropic.Messages.TextBlockParam).text).toBe("Second message\n\n" + envDetails)
		})

		it("should not mutate the original content array", () => {
			const content: UserContentBlock[] = [{ type: "text", text: "Original" }]

			appendEnvironmentDetails(content, envDetails)

			expect((content[0] as Anthropic.Messages.TextBlockParam).text).toBe("Original")
		})
	})

	describe("tool_result block handling", () => {
		it("should append to tool_result with string content", () => {
			const content: UserContentBlock[] = [
				{
					type: "tool_result",
					tool_use_id: "tool-123",
					content: "Tool result text",
				},
			]

			const result = appendEnvironmentDetails(content, envDetails)

			expect(result).toHaveLength(1)
			expect(result[0].type).toBe("tool_result")
			const toolResult = result[0] as Anthropic.Messages.ToolResultBlockParam
			expect(toolResult.content).toBe("Tool result text\n\n" + envDetails)
			expect(toolResult.tool_use_id).toBe("tool-123")
		})

		it("should append to tool_result with undefined content", () => {
			const content: UserContentBlock[] = [
				{
					type: "tool_result",
					tool_use_id: "tool-123",
				} as Anthropic.Messages.ToolResultBlockParam,
			]

			const result = appendEnvironmentDetails(content, envDetails)

			expect(result).toHaveLength(1)
			const toolResult = result[0] as Anthropic.Messages.ToolResultBlockParam
			expect(toolResult.content).toBe(envDetails)
		})

		it("should append to tool_result with array content containing text", () => {
			const content: UserContentBlock[] = [
				{
					type: "tool_result",
					tool_use_id: "tool-123",
					content: [{ type: "text", text: "Result line 1" }],
				},
			]

			const result = appendEnvironmentDetails(content, envDetails)

			expect(result).toHaveLength(1)
			const toolResult = result[0] as Anthropic.Messages.ToolResultBlockParam
			expect(Array.isArray(toolResult.content)).toBe(true)
			const contentArray = toolResult.content as Anthropic.Messages.TextBlockParam[]
			expect(contentArray).toHaveLength(1)
			expect(contentArray[0].text).toBe("Result line 1\n\n" + envDetails)
		})

		it("should add text block to tool_result with array content containing only images", () => {
			const content: UserContentBlock[] = [
				{
					type: "tool_result",
					tool_use_id: "tool-123",
					content: [
						{
							type: "image",
							source: { type: "base64", media_type: "image/png", data: "abc123" },
						},
					],
				},
			]

			const result = appendEnvironmentDetails(content, envDetails)

			expect(result).toHaveLength(1)
			const toolResult = result[0] as Anthropic.Messages.ToolResultBlockParam
			expect(Array.isArray(toolResult.content)).toBe(true)
			const contentArray = toolResult.content as Array<
				Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam
			>
			expect(contentArray).toHaveLength(2)
			expect(contentArray[0].type).toBe("image")
			expect(contentArray[1].type).toBe("text")
			expect((contentArray[1] as Anthropic.Messages.TextBlockParam).text).toBe(envDetails)
		})

		it("should append to the last text block in tool_result array content", () => {
			const content: UserContentBlock[] = [
				{
					type: "tool_result",
					tool_use_id: "tool-123",
					content: [
						{ type: "text", text: "First text" },
						{
							type: "image",
							source: { type: "base64", media_type: "image/png", data: "abc123" },
						},
						{ type: "text", text: "Last text" },
					],
				},
			]

			const result = appendEnvironmentDetails(content, envDetails)

			const toolResult = result[0] as Anthropic.Messages.ToolResultBlockParam
			const contentArray = toolResult.content as Array<
				Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam
			>
			expect(contentArray).toHaveLength(3)
			expect((contentArray[0] as Anthropic.Messages.TextBlockParam).text).toBe("First text")
			expect((contentArray[2] as Anthropic.Messages.TextBlockParam).text).toBe("Last text\n\n" + envDetails)
		})

		it("should preserve is_error flag on tool_result", () => {
			const content: UserContentBlock[] = [
				{
					type: "tool_result",
					tool_use_id: "tool-123",
					content: "Error message",
					is_error: true,
				},
			]

			const result = appendEnvironmentDetails(content, envDetails)

			const toolResult = result[0] as Anthropic.Messages.ToolResultBlockParam
			expect(toolResult.is_error).toBe(true)
			expect(toolResult.content).toBe("Error message\n\n" + envDetails)
		})
	})

	describe("mixed content handling", () => {
		it("should append to last text block when text comes after tool_result", () => {
			const content: UserContentBlock[] = [
				{
					type: "tool_result",
					tool_use_id: "tool-123",
					content: "Tool result",
				},
				{ type: "text", text: "User comment" },
			]

			const result = appendEnvironmentDetails(content, envDetails)

			expect(result).toHaveLength(2)
			expect((result[0] as Anthropic.Messages.ToolResultBlockParam).content).toBe("Tool result")
			expect((result[1] as Anthropic.Messages.TextBlockParam).text).toBe("User comment\n\n" + envDetails)
		})

		it("should append to last tool_result when no text block follows", () => {
			const content: UserContentBlock[] = [
				{ type: "text", text: "User message" },
				{
					type: "tool_result",
					tool_use_id: "tool-123",
					content: "Tool result",
				},
			]

			const result = appendEnvironmentDetails(content, envDetails)

			expect(result).toHaveLength(2)
			expect((result[0] as Anthropic.Messages.TextBlockParam).text).toBe("User message")
			expect((result[1] as Anthropic.Messages.ToolResultBlockParam).content).toBe("Tool result\n\n" + envDetails)
		})

		it("should add new text block when content only has images", () => {
			const content: UserContentBlock[] = [
				{
					type: "image",
					source: { type: "base64", media_type: "image/png", data: "abc123" },
				},
			]

			const result = appendEnvironmentDetails(content, envDetails)

			expect(result).toHaveLength(2)
			expect(result[0].type).toBe("image")
			expect(result[1].type).toBe("text")
			expect((result[1] as Anthropic.Messages.TextBlockParam).text).toBe(envDetails)
		})

		it("should handle multiple tool_results and append to the last one", () => {
			const content: UserContentBlock[] = [
				{
					type: "tool_result",
					tool_use_id: "tool-1",
					content: "First result",
				},
				{
					type: "tool_result",
					tool_use_id: "tool-2",
					content: "Second result",
				},
			]

			const result = appendEnvironmentDetails(content, envDetails)

			expect(result).toHaveLength(2)
			expect((result[0] as Anthropic.Messages.ToolResultBlockParam).content).toBe("First result")
			expect((result[1] as Anthropic.Messages.ToolResultBlockParam).content).toBe(
				"Second result\n\n" + envDetails,
			)
		})
	})
})

describe("removeEnvironmentDetailsBlocks", () => {
	const envDetailsBlock: UserContentBlock = {
		type: "text",
		text: "<environment_details>\n# Test\nSome details\n</environment_details>",
	}

	it("should remove standalone environment_details text blocks", () => {
		const content: UserContentBlock[] = [{ type: "text", text: "User message" }, envDetailsBlock]

		const result = removeEnvironmentDetailsBlocks(content)

		expect(result).toHaveLength(1)
		expect((result[0] as Anthropic.Messages.TextBlockParam).text).toBe("User message")
	})

	it("should not remove text blocks that mention environment_details but aren't complete blocks", () => {
		const content: UserContentBlock[] = [
			{ type: "text", text: "Let me explain <environment_details> tags" },
			{ type: "text", text: "The closing tag is </environment_details>" },
		]

		const result = removeEnvironmentDetailsBlocks(content)

		expect(result).toHaveLength(2)
	})

	it("should preserve non-text blocks", () => {
		const content: UserContentBlock[] = [
			{
				type: "tool_result",
				tool_use_id: "tool-123",
				content: "Result",
			},
			envDetailsBlock,
			{
				type: "image",
				source: { type: "base64", media_type: "image/png", data: "abc123" },
			},
		]

		const result = removeEnvironmentDetailsBlocks(content)

		expect(result).toHaveLength(2)
		expect(result[0].type).toBe("tool_result")
		expect(result[1].type).toBe("image")
	})

	it("should handle empty content", () => {
		const result = removeEnvironmentDetailsBlocks([])
		expect(result).toHaveLength(0)
	})

	it("should handle whitespace around environment_details tags", () => {
		const content: UserContentBlock[] = [
			{
				type: "text",
				text: "  <environment_details>\n# Test\nSome details\n</environment_details>  ",
			},
		]

		const result = removeEnvironmentDetailsBlocks(content)

		expect(result).toHaveLength(0)
	})
})
