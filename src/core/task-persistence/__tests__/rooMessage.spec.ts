import {
	ROO_MESSAGE_VERSION,
	isRooUserMessage,
	isRooAssistantMessage,
	isRooToolMessage,
	isRooReasoningMessage,
	type RooMessage,
	type RooUserMessage,
	type RooAssistantMessage,
	type RooToolMessage,
	type RooReasoningMessage,
	type TextPart,
	type ImagePart,
	type FilePart,
	type ToolCallPart,
	type ToolResultPart,
	type ReasoningPart,
	type RooMessageMetadata,
	type RooMessageHistory,
} from "../rooMessage"

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

const userMessageString: RooUserMessage = {
	role: "user",
	content: "Hello, world!",
	ts: 1000,
}

const userMessageParts: RooUserMessage = {
	role: "user",
	content: [
		{ type: "text", text: "Describe this image:" },
		{ type: "image", image: "data:image/png;base64,abc", mediaType: "image/png" },
		{ type: "file", data: "base64data", mediaType: "application/pdf" },
	],
}

const assistantMessageString: RooAssistantMessage = {
	role: "assistant",
	content: "Sure, I can help with that.",
	id: "resp_123",
}

const assistantMessageParts: RooAssistantMessage = {
	role: "assistant",
	content: [
		{
			type: "reasoning",
			text: "Let me think about this...",
			providerOptions: { anthropic: { signature: "sig123" } },
		},
		{ type: "text", text: "Here is the answer." },
		{ type: "tool-call", toolCallId: "call_1", toolName: "readFile", input: { path: "/tmp/foo" } },
	],
	providerOptions: { openai: { reasoning_details: {} } },
}

const toolMessage: RooToolMessage = {
	role: "tool",
	content: [
		{
			type: "tool-result",
			toolCallId: "call_1",
			toolName: "readFile",
			output: { type: "text", value: "file contents here" },
		},
	],
}

const reasoningMessage: RooReasoningMessage = {
	type: "reasoning",
	encrypted_content: "encrypted_base64_data",
	id: "reasoning_1",
	summary: [{ type: "text", text: "Summary of reasoning" }],
	ts: 2000,
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("ROO_MESSAGE_VERSION", () => {
	it("should be 2", () => {
		expect(ROO_MESSAGE_VERSION).toBe(2)
	})
})

describe("isRooUserMessage", () => {
	it("returns true for a user message with string content", () => {
		expect(isRooUserMessage(userMessageString)).toBe(true)
	})

	it("returns true for a user message with content parts", () => {
		expect(isRooUserMessage(userMessageParts)).toBe(true)
	})

	it("returns false for an assistant message", () => {
		expect(isRooUserMessage(assistantMessageString)).toBe(false)
	})

	it("returns false for a tool message", () => {
		expect(isRooUserMessage(toolMessage)).toBe(false)
	})

	it("returns false for a reasoning message", () => {
		expect(isRooUserMessage(reasoningMessage)).toBe(false)
	})
})

describe("isRooAssistantMessage", () => {
	it("returns true for an assistant message with string content", () => {
		expect(isRooAssistantMessage(assistantMessageString)).toBe(true)
	})

	it("returns true for an assistant message with content parts", () => {
		expect(isRooAssistantMessage(assistantMessageParts)).toBe(true)
	})

	it("returns false for a user message", () => {
		expect(isRooAssistantMessage(userMessageString)).toBe(false)
	})

	it("returns false for a tool message", () => {
		expect(isRooAssistantMessage(toolMessage)).toBe(false)
	})

	it("returns false for a reasoning message", () => {
		expect(isRooAssistantMessage(reasoningMessage)).toBe(false)
	})
})

describe("isRooToolMessage", () => {
	it("returns true for a tool message", () => {
		expect(isRooToolMessage(toolMessage)).toBe(true)
	})

	it("returns false for a user message", () => {
		expect(isRooToolMessage(userMessageString)).toBe(false)
	})

	it("returns false for an assistant message", () => {
		expect(isRooToolMessage(assistantMessageString)).toBe(false)
	})

	it("returns false for a reasoning message", () => {
		expect(isRooToolMessage(reasoningMessage)).toBe(false)
	})
})

describe("isRooReasoningMessage", () => {
	it("returns true for a standalone reasoning message", () => {
		expect(isRooReasoningMessage(reasoningMessage)).toBe(true)
	})

	it("returns false for a user message", () => {
		expect(isRooReasoningMessage(userMessageString)).toBe(false)
	})

	it("returns false for an assistant message", () => {
		expect(isRooReasoningMessage(assistantMessageString)).toBe(false)
	})

	it("returns false for a tool message", () => {
		expect(isRooReasoningMessage(toolMessage)).toBe(false)
	})
})

describe("type guard narrowing", () => {
	it("narrows RooMessage union to the correct type", () => {
		const messages: RooMessage[] = [userMessageString, assistantMessageParts, toolMessage, reasoningMessage]

		const users = messages.filter(isRooUserMessage)
		const assistants = messages.filter(isRooAssistantMessage)
		const tools = messages.filter(isRooToolMessage)
		const reasoning = messages.filter(isRooReasoningMessage)

		expect(users).toHaveLength(1)
		expect(users[0].role).toBe("user")

		expect(assistants).toHaveLength(1)
		expect(assistants[0].role).toBe("assistant")

		expect(tools).toHaveLength(1)
		expect(tools[0].role).toBe("tool")

		expect(reasoning).toHaveLength(1)
		expect(reasoning[0].type).toBe("reasoning")
		expect(reasoning[0].encrypted_content).toBe("encrypted_base64_data")
	})
})

describe("RooMessageMetadata", () => {
	it("allows metadata fields on all message types", () => {
		const msgWithMetadata: RooUserMessage = {
			role: "user",
			content: "test",
			ts: 12345,
			condenseId: "cond-1",
			condenseParent: "cond-0",
			truncationId: "trunc-1",
			truncationParent: "trunc-0",
			isTruncationMarker: true,
			isSummary: true,
		}

		expect(msgWithMetadata.ts).toBe(12345)
		expect(msgWithMetadata.condenseId).toBe("cond-1")
		expect(msgWithMetadata.condenseParent).toBe("cond-0")
		expect(msgWithMetadata.truncationId).toBe("trunc-1")
		expect(msgWithMetadata.truncationParent).toBe("trunc-0")
		expect(msgWithMetadata.isTruncationMarker).toBe(true)
		expect(msgWithMetadata.isSummary).toBe(true)
	})
})

describe("RooMessageHistory", () => {
	it("wraps messages with the correct version", () => {
		const history: RooMessageHistory = {
			version: 2,
			messages: [userMessageString, assistantMessageString, toolMessage, reasoningMessage],
		}

		expect(history.version).toBe(ROO_MESSAGE_VERSION)
		expect(history.messages).toHaveLength(4)
	})
})
