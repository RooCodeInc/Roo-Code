// npx vitest run src/api/transform/__tests__/vscode-lm-format.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"

import {
	convertToVsCodeLmMessages,
	convertToAnthropicRole,
	extractTextCountFromMessage,
	validateAndRepairToolSequence,
} from "../vscode-lm-format"

// Mock crypto using Vitest
vitest.stubGlobal("crypto", {
	randomUUID: () => "test-uuid",
})

// Define types for our mocked classes
interface MockLanguageModelTextPart {
	type: "text"
	value: string
}

interface MockLanguageModelToolCallPart {
	type: "tool_call"
	callId: string
	name: string
	input: any
}

interface MockLanguageModelToolResultPart {
	type: "tool_result"
	callId: string
	content: MockLanguageModelTextPart[]
}

// Mock vscode namespace
vitest.mock("vscode", () => {
	const LanguageModelChatMessageRole = {
		Assistant: "assistant",
		User: "user",
	}

	class MockLanguageModelTextPart {
		type = "text"
		constructor(public value: string) {}
	}

	class MockLanguageModelToolCallPart {
		type = "tool_call"
		constructor(
			public callId: string,
			public name: string,
			public input: any,
		) {}
	}

	class MockLanguageModelToolResultPart {
		type = "tool_result"
		constructor(
			public callId: string,
			public content: MockLanguageModelTextPart[],
		) {}
	}

	return {
		LanguageModelChatMessage: {
			Assistant: vitest.fn((content) => ({
				role: LanguageModelChatMessageRole.Assistant,
				name: "assistant",
				content: Array.isArray(content) ? content : [new MockLanguageModelTextPart(content)],
			})),
			User: vitest.fn((content) => ({
				role: LanguageModelChatMessageRole.User,
				name: "user",
				content: Array.isArray(content) ? content : [new MockLanguageModelTextPart(content)],
			})),
		},
		LanguageModelChatMessageRole,
		LanguageModelTextPart: MockLanguageModelTextPart,
		LanguageModelToolCallPart: MockLanguageModelToolCallPart,
		LanguageModelToolResultPart: MockLanguageModelToolResultPart,
	}
})

describe("convertToVsCodeLmMessages", () => {
	it("should convert simple string messages", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there" },
		]

		const result = convertToVsCodeLmMessages(messages)

		expect(result).toHaveLength(2)
		expect(result[0].role).toBe("user")
		expect((result[0].content[0] as MockLanguageModelTextPart).value).toBe("Hello")
		expect(result[1].role).toBe("assistant")
		expect((result[1].content[0] as MockLanguageModelTextPart).value).toBe("Hi there")
	})

	it("should handle complex user messages with tool results", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Here is the result:" },
					{
						type: "tool_result",
						tool_use_id: "tool-1",
						content: "Tool output",
					},
				],
			},
		]

		const result = convertToVsCodeLmMessages(messages)

		expect(result).toHaveLength(1)
		expect(result[0].role).toBe("user")
		expect(result[0].content).toHaveLength(2)
		const [toolResult, textContent] = result[0].content as [
			MockLanguageModelToolResultPart,
			MockLanguageModelTextPart,
		]
		expect(toolResult.type).toBe("tool_result")
		expect(textContent.type).toBe("text")
	})

	it("should handle complex assistant messages with tool calls", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [
					{ type: "text", text: "Let me help you with that." },
					{
						type: "tool_use",
						id: "tool-1",
						name: "calculator",
						input: { operation: "add", numbers: [2, 2] },
					},
				],
			},
		]

		const result = convertToVsCodeLmMessages(messages)

		expect(result).toHaveLength(1)
		expect(result[0].role).toBe("assistant")
		expect(result[0].content).toHaveLength(2)
		// Text must come before tool calls so that tool calls are at the end,
		// properly followed by user message with tool results
		const [textContent, toolCall] = result[0].content as [MockLanguageModelTextPart, MockLanguageModelToolCallPart]
		expect(textContent.type).toBe("text")
		expect(toolCall.type).toBe("tool_call")
	})

	it("should handle image blocks with appropriate placeholders", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Look at this:" },
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

		const result = convertToVsCodeLmMessages(messages)

		expect(result).toHaveLength(1)
		const imagePlaceholder = result[0].content[1] as MockLanguageModelTextPart
		expect(imagePlaceholder.value).toContain("[Image (base64): image/png not supported by VSCode LM API]")
	})
})

describe("convertToAnthropicRole", () => {
	it("should convert assistant role correctly", () => {
		const result = convertToAnthropicRole("assistant" as any)
		expect(result).toBe("assistant")
	})

	it("should convert user role correctly", () => {
		const result = convertToAnthropicRole("user" as any)
		expect(result).toBe("user")
	})

	it("should return null for unknown roles", () => {
		const result = convertToAnthropicRole("unknown" as any)
		expect(result).toBeNull()
	})
})

describe("extractTextCountFromMessage", () => {
	it("should extract text from simple string content", () => {
		const message = {
			role: "user",
			content: "Hello world",
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe("Hello world")
	})

	it("should extract text from LanguageModelTextPart", () => {
		const mockTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("Text content")
		const message = {
			role: "user",
			content: [mockTextPart],
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe("Text content")
	})

	it("should extract text from multiple LanguageModelTextParts", () => {
		const mockTextPart1 = new (vitest.mocked(vscode).LanguageModelTextPart)("First part")
		const mockTextPart2 = new (vitest.mocked(vscode).LanguageModelTextPart)("Second part")
		const message = {
			role: "user",
			content: [mockTextPart1, mockTextPart2],
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe("First partSecond part")
	})

	it("should extract text from LanguageModelToolResultPart", () => {
		const mockTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("Tool result content")
		const mockToolResultPart = new (vitest.mocked(vscode).LanguageModelToolResultPart)("tool-result-id", [
			mockTextPart,
		])
		const message = {
			role: "user",
			content: [mockToolResultPart],
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe("tool-result-idTool result content")
	})

	it("should extract text from LanguageModelToolCallPart without input", () => {
		const mockToolCallPart = new (vitest.mocked(vscode).LanguageModelToolCallPart)("call-id", "tool-name", {})
		const message = {
			role: "assistant",
			content: [mockToolCallPart],
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe("tool-namecall-id")
	})

	it("should extract text from LanguageModelToolCallPart with input", () => {
		const mockInput = { operation: "add", numbers: [1, 2, 3] }
		const mockToolCallPart = new (vitest.mocked(vscode).LanguageModelToolCallPart)(
			"call-id",
			"calculator",
			mockInput,
		)
		const message = {
			role: "assistant",
			content: [mockToolCallPart],
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe(`calculatorcall-id${JSON.stringify(mockInput)}`)
	})

	it("should extract text from LanguageModelToolCallPart with empty input", () => {
		const mockToolCallPart = new (vitest.mocked(vscode).LanguageModelToolCallPart)("call-id", "tool-name", {})
		const message = {
			role: "assistant",
			content: [mockToolCallPart],
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe("tool-namecall-id")
	})

	it("should extract text from mixed content types", () => {
		const mockTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("Text content")
		const mockToolResultTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("Tool result")
		const mockToolResultPart = new (vitest.mocked(vscode).LanguageModelToolResultPart)("result-id", [
			mockToolResultTextPart,
		])
		const mockInput = { param: "value" }
		const mockToolCallPart = new (vitest.mocked(vscode).LanguageModelToolCallPart)("call-id", "tool", mockInput)

		const message = {
			role: "assistant",
			content: [mockTextPart, mockToolResultPart, mockToolCallPart],
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe(`Text contentresult-idTool resulttoolcall-id${JSON.stringify(mockInput)}`)
	})

	it("should handle empty array content", () => {
		const message = {
			role: "user",
			content: [],
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe("")
	})

	it("should handle undefined content", () => {
		const message = {
			role: "user",
			content: undefined,
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe("")
	})

	it("should handle ToolResultPart with multiple text parts", () => {
		const mockTextPart1 = new (vitest.mocked(vscode).LanguageModelTextPart)("Part 1")
		const mockTextPart2 = new (vitest.mocked(vscode).LanguageModelTextPart)("Part 2")
		const mockToolResultPart = new (vitest.mocked(vscode).LanguageModelToolResultPart)("result-id", [
			mockTextPart1,
			mockTextPart2,
		])

		const message = {
			role: "user",
			content: [mockToolResultPart],
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe("result-idPart 1Part 2")
	})

	it("should handle ToolResultPart with empty parts array", () => {
		const mockToolResultPart = new (vitest.mocked(vscode).LanguageModelToolResultPart)("result-id", [])

		const message = {
			role: "user",
			content: [mockToolResultPart],
		} as any

		const result = extractTextCountFromMessage(message)
		expect(result).toBe("result-id")
	})
})

describe("validateAndRepairToolSequence", () => {
	it("should return empty array for empty input", () => {
		const result = validateAndRepairToolSequence([])
		expect(result).toEqual([])
	})

	it("should return messages unchanged when no tool calls present", () => {
		const mockTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("Hello")
		const messages = [
			{
				role: vitest.mocked(vscode).LanguageModelChatMessageRole.User,
				content: [mockTextPart],
			},
			{
				role: vitest.mocked(vscode).LanguageModelChatMessageRole.Assistant,
				content: [mockTextPart],
			},
		] as vscode.LanguageModelChatMessage[]

		const result = validateAndRepairToolSequence(messages)
		expect(result).toHaveLength(2)
		expect(result[0]).toBe(messages[0])
		expect(result[1]).toBe(messages[1])
	})

	it("should return messages unchanged when tool call is followed by matching tool result", () => {
		const mockTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("I'll help")
		const mockToolCallPart = new (vitest.mocked(vscode).LanguageModelToolCallPart)("call-1", "test-tool", {})
		const mockToolResultPart = new (vitest.mocked(vscode).LanguageModelToolResultPart)("call-1", [
			new (vitest.mocked(vscode).LanguageModelTextPart)("result"),
		])

		const assistantMessage = {
			role: vitest.mocked(vscode).LanguageModelChatMessageRole.Assistant,
			content: [mockTextPart, mockToolCallPart],
		} as vscode.LanguageModelChatMessage

		const userMessage = {
			role: vitest.mocked(vscode).LanguageModelChatMessageRole.User,
			content: [mockToolResultPart],
		} as vscode.LanguageModelChatMessage

		const messages = [assistantMessage, userMessage]

		const result = validateAndRepairToolSequence(messages)
		expect(result).toHaveLength(2)
		expect(result[0]).toBe(assistantMessage)
		expect(result[1]).toBe(userMessage)
	})

	it("should add placeholder tool result when assistant tool call is not followed by user message", () => {
		const mockTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("I'll help")
		const mockToolCallPart = new (vitest.mocked(vscode).LanguageModelToolCallPart)("call-1", "test-tool", {})

		const assistantMessage = {
			role: vitest.mocked(vscode).LanguageModelChatMessageRole.Assistant,
			content: [mockTextPart, mockToolCallPart],
		} as vscode.LanguageModelChatMessage

		const messages = [assistantMessage]

		const result = validateAndRepairToolSequence(messages)

		// Should have original assistant message plus new user message with placeholder
		expect(result).toHaveLength(2)
		expect(result[0]).toBe(assistantMessage)
		expect(result[1].role).toBe(vitest.mocked(vscode).LanguageModelChatMessageRole.User)
		// The new user message should have a tool result part
		expect(result[1].content).toHaveLength(1)
		expect((result[1].content[0] as MockLanguageModelToolResultPart).callId).toBe("call-1")
	})

	it("should add placeholder tool result when tool call is followed by user message without matching result", () => {
		const mockTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("I'll help")
		const mockToolCallPart = new (vitest.mocked(vscode).LanguageModelToolCallPart)("call-1", "test-tool", {})
		const mockUserTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("Continue please")

		const assistantMessage = {
			role: vitest.mocked(vscode).LanguageModelChatMessageRole.Assistant,
			content: [mockTextPart, mockToolCallPart],
		} as vscode.LanguageModelChatMessage

		const userMessage = {
			role: vitest.mocked(vscode).LanguageModelChatMessageRole.User,
			content: [mockUserTextPart],
		} as vscode.LanguageModelChatMessage

		const messages = [assistantMessage, userMessage]

		const result = validateAndRepairToolSequence(messages)

		expect(result).toHaveLength(2)
		expect(result[0]).toBe(assistantMessage)
		// The repaired user message should have placeholder result prepended
		expect(result[1].content).toHaveLength(2)
		expect((result[1].content[0] as MockLanguageModelToolResultPart).callId).toBe("call-1")
		expect((result[1].content[1] as MockLanguageModelTextPart).value).toBe("Continue please")
	})

	it("should handle multiple tool calls with partial matching results", () => {
		const mockTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("I'll help")
		const mockToolCallPart1 = new (vitest.mocked(vscode).LanguageModelToolCallPart)("call-1", "tool-1", {})
		const mockToolCallPart2 = new (vitest.mocked(vscode).LanguageModelToolCallPart)("call-2", "tool-2", {})
		const mockToolResultPart1 = new (vitest.mocked(vscode).LanguageModelToolResultPart)("call-1", [
			new (vitest.mocked(vscode).LanguageModelTextPart)("result-1"),
		])

		const assistantMessage = {
			role: vitest.mocked(vscode).LanguageModelChatMessageRole.Assistant,
			content: [mockTextPart, mockToolCallPart1, mockToolCallPart2],
		} as vscode.LanguageModelChatMessage

		const userMessage = {
			role: vitest.mocked(vscode).LanguageModelChatMessageRole.User,
			content: [mockToolResultPart1], // Only has result for call-1, missing call-2
		} as vscode.LanguageModelChatMessage

		const messages = [assistantMessage, userMessage]

		const result = validateAndRepairToolSequence(messages)

		expect(result).toHaveLength(2)
		expect(result[0]).toBe(assistantMessage)
		// The repaired user message should have placeholder for call-2 prepended
		expect(result[1].content).toHaveLength(2)
		// Placeholder for missing call-2 should be first
		expect((result[1].content[0] as MockLanguageModelToolResultPart).callId).toBe("call-2")
		// Original result for call-1 should still be present
		expect((result[1].content[1] as MockLanguageModelToolResultPart).callId).toBe("call-1")
	})

	it("should handle tool call followed by another assistant message", () => {
		const mockTextPart = new (vitest.mocked(vscode).LanguageModelTextPart)("I'll help")
		const mockToolCallPart = new (vitest.mocked(vscode).LanguageModelToolCallPart)("call-1", "test-tool", {})
		const mockTextPart2 = new (vitest.mocked(vscode).LanguageModelTextPart)("More assistant text")

		const assistantMessage1 = {
			role: vitest.mocked(vscode).LanguageModelChatMessageRole.Assistant,
			content: [mockTextPart, mockToolCallPart],
		} as vscode.LanguageModelChatMessage

		const assistantMessage2 = {
			role: vitest.mocked(vscode).LanguageModelChatMessageRole.Assistant,
			content: [mockTextPart2],
		} as vscode.LanguageModelChatMessage

		const messages = [assistantMessage1, assistantMessage2]

		const result = validateAndRepairToolSequence(messages)

		// Should insert a user message with placeholder between the two assistant messages
		expect(result).toHaveLength(3)
		expect(result[0]).toBe(assistantMessage1)
		expect(result[1].role).toBe(vitest.mocked(vscode).LanguageModelChatMessageRole.User)
		expect((result[1].content[0] as MockLanguageModelToolResultPart).callId).toBe("call-1")
		expect(result[2]).toBe(assistantMessage2)
	})

	it("should handle null/undefined input gracefully", () => {
		expect(validateAndRepairToolSequence(null as any)).toEqual(null)
		expect(validateAndRepairToolSequence(undefined as any)).toEqual(undefined)
	})
})
