import type { ApiMessage } from "../../apiMessages"
import type {
	RooUserMessage,
	RooAssistantMessage,
	RooToolMessage,
	RooReasoningMessage,
	TextPart,
	ImagePart,
	ToolCallPart,
	ToolResultPart,
	ReasoningPart,
} from "../../rooMessage"
import { convertAnthropicToRooMessages } from "../anthropicToRoo"

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Shorthand to create an ApiMessage with required fields. */
function apiMsg(overrides: Partial<ApiMessage> & Pick<ApiMessage, "role" | "content">): ApiMessage {
	return overrides as ApiMessage
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Simple string user/assistant messages
// ────────────────────────────────────────────────────────────────────────────

describe("simple string messages", () => {
	test("converts a simple string user message", () => {
		const result = convertAnthropicToRooMessages([apiMsg({ role: "user", content: "Hello" })])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooUserMessage
		expect(msg.role).toBe("user")
		expect(msg.content).toBe("Hello")
	})

	test("converts a simple string assistant message", () => {
		const result = convertAnthropicToRooMessages([apiMsg({ role: "assistant", content: "Hi there" })])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooAssistantMessage
		expect(msg.role).toBe("assistant")
		expect(msg.content).toBe("Hi there")
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 2. User messages with text content blocks
// ────────────────────────────────────────────────────────────────────────────

describe("user messages with text content blocks", () => {
	test("converts text content blocks to TextPart array", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "user",
				content: [
					{ type: "text", text: "First paragraph" },
					{ type: "text", text: "Second paragraph" },
				],
			}),
		])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooUserMessage
		expect(msg.role).toBe("user")
		expect(Array.isArray(msg.content)).toBe(true)
		const parts = msg.content as TextPart[]
		expect(parts).toHaveLength(2)
		expect(parts[0]).toEqual({ type: "text", text: "First paragraph" })
		expect(parts[1]).toEqual({ type: "text", text: "Second paragraph" })
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 3. User messages with base64 image content
// ────────────────────────────────────────────────────────────────────────────

describe("user messages with base64 image content", () => {
	test("converts base64 image blocks to ImagePart", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "user",
				content: [
					{
						type: "image",
						source: {
							type: "base64",
							media_type: "image/png",
							data: "iVBORw0KGgoAAAA==",
						},
					} as any,
				],
			}),
		])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooUserMessage
		const parts = msg.content as ImagePart[]
		expect(parts).toHaveLength(1)
		expect(parts[0]).toEqual({
			type: "image",
			image: "data:image/png;base64,iVBORw0KGgoAAAA==",
			mediaType: "image/png",
		})
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 4. User messages with URL image content
// ────────────────────────────────────────────────────────────────────────────

describe("user messages with URL image content", () => {
	test("converts URL image blocks to ImagePart", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "user",
				content: [
					{
						type: "image",
						source: {
							type: "url",
							url: "https://example.com/image.png",
						},
					} as any,
				],
			}),
		])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooUserMessage
		const parts = msg.content as ImagePart[]
		expect(parts).toHaveLength(1)
		expect(parts[0]).toEqual({
			type: "image",
			image: "https://example.com/image.png",
		})
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 5. User messages with tool_result blocks → split into RooToolMessage + RooUserMessage
// ────────────────────────────────────────────────────────────────────────────

describe("user messages with tool_result blocks", () => {
	test("splits tool_result into RooToolMessage before RooUserMessage", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "assistant",
				content: [{ type: "tool_use", id: "call_1", name: "read_file", input: { path: "foo.ts" } }],
			}),
			apiMsg({
				role: "user",
				content: [
					{ type: "tool_result", tool_use_id: "call_1", content: "file contents here" },
					{ type: "text", text: "Now please edit it" },
				],
			}),
		]
		const result = convertAnthropicToRooMessages(messages)

		// assistant + tool + user = 3 messages
		expect(result).toHaveLength(3)

		// First: assistant with tool call
		const assistantMsg = result[0] as RooAssistantMessage
		expect(assistantMsg.role).toBe("assistant")

		// Second: tool message with the result
		const toolMsg = result[1] as RooToolMessage
		expect(toolMsg.role).toBe("tool")
		expect(toolMsg.content).toHaveLength(1)
		expect(toolMsg.content[0]).toEqual({
			type: "tool-result",
			toolCallId: "call_1",
			toolName: "read_file",
			output: { type: "text", value: "file contents here" },
		})

		// Third: user message with remaining text
		const userMsg = result[2] as RooUserMessage
		expect(userMsg.role).toBe("user")
		expect(userMsg.content).toEqual([{ type: "text", text: "Now please edit it" }])
	})

	test("handles tool_result with array content (joins text with newlines)", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "assistant",
				content: [{ type: "tool_use", id: "call_2", name: "list_files", input: {} }],
			}),
			apiMsg({
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "call_2",
						content: [
							{ type: "text", text: "file1.ts" },
							{ type: "text", text: "file2.ts" },
						],
					},
				],
			}),
		]
		const result = convertAnthropicToRooMessages(messages)
		const toolMsg = result.find((m) => "role" in m && m.role === "tool") as RooToolMessage
		expect(((toolMsg.content[0] as ToolResultPart).output as { value: string }).value).toBe("file1.ts\nfile2.ts")
	})

	test("handles tool_result with undefined content → (empty)", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "assistant",
				content: [{ type: "tool_use", id: "call_3", name: "run_command", input: {} }],
			}),
			apiMsg({
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "call_3", content: undefined as any }],
			}),
		]
		const result = convertAnthropicToRooMessages(messages)
		const toolMsg = result.find((m) => "role" in m && m.role === "tool") as RooToolMessage
		expect(((toolMsg.content[0] as ToolResultPart).output as { value: string }).value).toBe("(empty)")
	})

	test("handles tool_result with empty string content → (empty)", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "assistant",
				content: [{ type: "tool_use", id: "call_4", name: "run_command", input: {} }],
			}),
			apiMsg({
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "call_4", content: "" }],
			}),
		]
		const result = convertAnthropicToRooMessages(messages)
		const toolMsg = result.find((m) => "role" in m && m.role === "tool") as RooToolMessage
		expect(((toolMsg.content[0] as ToolResultPart).output as { value: string }).value).toBe("(empty)")
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 6. User messages with mixed tool_result and text
// ────────────────────────────────────────────────────────────────────────────

describe("user messages with mixed tool_result and text", () => {
	test("separates tool results from text/image parts correctly", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "assistant",
				content: [
					{ type: "tool_use", id: "tc_a", name: "tool_a", input: {} },
					{ type: "tool_use", id: "tc_b", name: "tool_b", input: {} },
				],
			}),
			apiMsg({
				role: "user",
				content: [
					{ type: "tool_result", tool_use_id: "tc_a", content: "result A" },
					{ type: "text", text: "User commentary" },
					{ type: "tool_result", tool_use_id: "tc_b", content: "result B" },
					{
						type: "image",
						source: { type: "base64", media_type: "image/jpeg", data: "abc123" },
					} as any,
				],
			}),
		]
		const result = convertAnthropicToRooMessages(messages)

		// assistant + tool + user = 3
		expect(result).toHaveLength(3)

		const toolMsg = result[1] as RooToolMessage
		expect(toolMsg.role).toBe("tool")
		expect(toolMsg.content).toHaveLength(2)
		expect((toolMsg.content[0] as ToolResultPart).toolCallId).toBe("tc_a")
		expect((toolMsg.content[1] as ToolResultPart).toolCallId).toBe("tc_b")

		const userMsg = result[2] as RooUserMessage
		expect(userMsg.role).toBe("user")
		const parts = userMsg.content as Array<TextPart | ImagePart>
		expect(parts).toHaveLength(2)
		expect(parts[0]).toEqual({ type: "text", text: "User commentary" })
		expect(parts[1]).toEqual({
			type: "image",
			image: "data:image/jpeg;base64,abc123",
			mediaType: "image/jpeg",
		})
	})

	test("only emits tool message when no text/image parts exist", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "assistant",
				content: [{ type: "tool_use", id: "tc_only", name: "some_tool", input: {} }],
			}),
			apiMsg({
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "tc_only", content: "done" }],
			}),
		]
		const result = convertAnthropicToRooMessages(messages)
		// assistant + tool (no user message since no text/image parts)
		expect(result).toHaveLength(2)
		expect((result[1] as RooToolMessage).role).toBe("tool")
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 7. Assistant messages with text blocks
// ────────────────────────────────────────────────────────────────────────────

describe("assistant messages with text blocks", () => {
	test("converts text content blocks to TextPart array", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{ type: "text", text: "Here is my analysis:" },
					{ type: "text", text: "The code looks good." },
				],
			}),
		])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooAssistantMessage
		expect(msg.role).toBe("assistant")
		const parts = msg.content as TextPart[]
		expect(parts).toHaveLength(2)
		expect(parts[0]).toEqual({ type: "text", text: "Here is my analysis:" })
		expect(parts[1]).toEqual({ type: "text", text: "The code looks good." })
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 8. Assistant messages with tool_use blocks
// ────────────────────────────────────────────────────────────────────────────

describe("assistant messages with tool_use blocks", () => {
	test("converts tool_use blocks to ToolCallPart", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{ type: "text", text: "I'll read the file." },
					{
						type: "tool_use",
						id: "toolu_01",
						name: "read_file",
						input: { path: "src/index.ts" },
					},
				],
			}),
		])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as Array<TextPart | ToolCallPart>
		expect(parts).toHaveLength(2)
		expect(parts[0]).toEqual({ type: "text", text: "I'll read the file." })
		expect(parts[1]).toEqual({
			type: "tool-call",
			toolCallId: "toolu_01",
			toolName: "read_file",
			input: { path: "src/index.ts" },
		})
	})

	test("converts multiple parallel tool_use blocks", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{ type: "tool_use", id: "tc1", name: "read_file", input: { path: "a.ts" } },
					{ type: "tool_use", id: "tc2", name: "read_file", input: { path: "b.ts" } },
				],
			}),
		])
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as ToolCallPart[]
		expect(parts).toHaveLength(2)
		expect(parts[0].toolCallId).toBe("tc1")
		expect(parts[1].toolCallId).toBe("tc2")
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 9. Assistant messages with reasoning blocks (plain text)
// ────────────────────────────────────────────────────────────────────────────

describe("assistant messages with reasoning blocks", () => {
	test("converts reasoning blocks to ReasoningPart", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{ type: "reasoning", text: "Let me think about this..." } as any,
					{ type: "text", text: "The answer is 42." },
				],
			}),
		])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as Array<ReasoningPart | TextPart>
		expect(parts).toHaveLength(2)
		expect(parts[0]).toEqual({ type: "reasoning", text: "Let me think about this..." })
		expect(parts[1]).toEqual({ type: "text", text: "The answer is 42." })
	})

	test("skips reasoning blocks with empty text", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [{ type: "reasoning", text: "" } as any, { type: "text", text: "Response" }],
			}),
		])
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as TextPart[]
		expect(parts).toHaveLength(1)
		expect(parts[0].type).toBe("text")
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 10. Assistant messages with thinking blocks (with signature)
// ────────────────────────────────────────────────────────────────────────────

describe("assistant messages with thinking blocks", () => {
	test("converts thinking blocks to ReasoningPart with providerOptions containing signature", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{
						type: "thinking",
						thinking: "I need to carefully consider the edge cases...",
						signature: "sig_abc123",
					} as any,
					{ type: "text", text: "Here's my response." },
				],
			}),
		])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as Array<ReasoningPart | TextPart>
		expect(parts).toHaveLength(2)
		expect(parts[0]).toEqual({
			type: "reasoning",
			text: "I need to carefully consider the edge cases...",
			providerOptions: {
				bedrock: { signature: "sig_abc123" },
				anthropic: { signature: "sig_abc123" },
			},
		})
		expect(parts[1]).toEqual({ type: "text", text: "Here's my response." })
	})

	test("converts thinking blocks without signature", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "Hmm let me think..." } as any,
					{ type: "text", text: "Done." },
				],
			}),
		])
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as Array<ReasoningPart | TextPart>
		expect(parts[0]).toEqual({ type: "reasoning", text: "Hmm let me think..." })
		expect(parts[0]).not.toHaveProperty("providerOptions")
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 11. Assistant messages with thoughtSignature blocks
// ────────────────────────────────────────────────────────────────────────────

describe("assistant messages with thoughtSignature blocks", () => {
	test("attaches thoughtSignature to first ToolCallPart via providerOptions", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{ type: "thoughtSignature", thoughtSignature: "gemini_sig_xyz" } as any,
					{ type: "tool_use", id: "tc1", name: "read_file", input: { path: "a.ts" } },
					{ type: "tool_use", id: "tc2", name: "write_file", input: { path: "b.ts" } },
				],
			}),
		])
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as ToolCallPart[]
		expect(parts).toHaveLength(2)

		// First tool call gets the thoughtSignature
		expect(parts[0].providerOptions).toEqual({
			google: { thoughtSignature: "gemini_sig_xyz" },
			vertex: { thoughtSignature: "gemini_sig_xyz" },
		})

		// Second tool call does NOT get the signature
		expect(parts[1].providerOptions).toBeUndefined()
	})

	test("thoughtSignature block itself is not included in output parts", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{ type: "thoughtSignature", thoughtSignature: "sig123" } as any,
					{ type: "text", text: "Response text" },
				],
			}),
		])
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as TextPart[]
		expect(parts).toHaveLength(1)
		expect(parts[0]).toEqual({ type: "text", text: "Response text" })
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 12. Assistant messages with message-level reasoning_content
// ────────────────────────────────────────────────────────────────────────────

describe("assistant messages with message-level reasoning_content", () => {
	test("reasoning_content takes precedence over content-block reasoning", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{ type: "reasoning", text: "This should be skipped" } as any,
					{ type: "text", text: "Final answer" },
				],
				reasoning_content: "DeepSeek canonical reasoning",
			}),
		])
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as Array<ReasoningPart | TextPart>
		expect(parts).toHaveLength(2)
		expect(parts[0]).toEqual({ type: "reasoning", text: "DeepSeek canonical reasoning" })
		expect(parts[1]).toEqual({ type: "text", text: "Final answer" })
	})

	test("reasoning_content takes precedence over thinking blocks", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "Skipped thinking", signature: "sig" } as any,
					{ type: "text", text: "Answer" },
				],
				reasoning_content: "DeepSeek reasoning here",
			}),
		])
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as Array<ReasoningPart | TextPart>
		expect(parts).toHaveLength(2)
		expect(parts[0]).toEqual({ type: "reasoning", text: "DeepSeek reasoning here" })
		expect(parts[0]).not.toHaveProperty("providerOptions")
	})

	test("empty reasoning_content is ignored", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [
					{ type: "reasoning", text: "This should NOT be skipped" } as any,
					{ type: "text", text: "Answer" },
				],
				reasoning_content: "",
			}),
		])
		const msg = result[0] as RooAssistantMessage
		const parts = msg.content as Array<ReasoningPart | TextPart>
		expect(parts).toHaveLength(2)
		expect(parts[0]).toEqual({ type: "reasoning", text: "This should NOT be skipped" })
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 13. Assistant messages with message-level reasoning_details
// ────────────────────────────────────────────────────────────────────────────

describe("assistant messages with message-level reasoning_details", () => {
	test("preserves valid reasoning_details via providerOptions", () => {
		const details = [
			{ type: "reasoning.encrypted", data: "encrypted_data_here" },
			{ type: "reasoning.text", text: "Some reasoning text" },
			{ type: "reasoning.summary", summary: "A summary" },
		]
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [{ type: "text", text: "Response" }],
				reasoning_details: details,
			}),
		])
		const msg = result[0] as RooAssistantMessage
		expect(msg.providerOptions).toEqual({
			openrouter: { reasoning_details: details },
		})
	})

	test("filters out invalid reasoning_details entries", () => {
		const details = [
			{ type: "reasoning.encrypted", data: "" }, // invalid: empty data
			{ type: "reasoning.encrypted" }, // invalid: missing data
			{ type: "reasoning.text", text: "Valid text" }, // valid
			{ type: "unknown_type" }, // invalid: unknown type
		]
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [{ type: "text", text: "Response" }],
				reasoning_details: details,
			}),
		])
		const msg = result[0] as RooAssistantMessage
		expect(msg.providerOptions).toEqual({
			openrouter: { reasoning_details: [{ type: "reasoning.text", text: "Valid text" }] },
		})
	})

	test("does not set providerOptions when all reasoning_details are invalid", () => {
		const details = [{ type: "reasoning.encrypted", data: "" }, { type: "bad_type" }]
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: [{ type: "text", text: "Response" }],
				reasoning_details: details,
			}),
		])
		const msg = result[0] as RooAssistantMessage
		expect(msg.providerOptions).toBeUndefined()
	})

	test("preserves reasoning_details on string-content assistant messages", () => {
		const details = [{ type: "reasoning.text", text: "Some reasoning" }]
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: "Simple string response",
				reasoning_details: details,
			}),
		])
		const msg = result[0] as RooAssistantMessage
		expect(msg.content).toBe("Simple string response")
		expect(msg.providerOptions).toEqual({
			openrouter: { reasoning_details: details },
		})
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 14. Standalone reasoning messages
// ────────────────────────────────────────────────────────────────────────────

describe("standalone reasoning messages", () => {
	test("converts standalone reasoning with encrypted_content", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: "",
				type: "reasoning",
				encrypted_content: "encrypted_data_blob",
				id: "resp_001",
				summary: [{ type: "summary_text", text: "I thought about X" }],
			}),
		])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooReasoningMessage
		expect(msg.type).toBe("reasoning")
		expect(msg.encrypted_content).toBe("encrypted_data_blob")
		expect(msg.id).toBe("resp_001")
		expect(msg.summary).toEqual([{ type: "summary_text", text: "I thought about X" }])
		expect(msg).not.toHaveProperty("role")
	})

	test("does not convert reasoning message without encrypted_content", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: "Some text",
				type: "reasoning",
			}),
		])
		// Without encrypted_content, falls through to normal assistant handling
		expect(result).toHaveLength(1)
		const msg = result[0] as RooAssistantMessage
		expect(msg.role).toBe("assistant")
		expect(msg.content).toBe("Some text")
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 15. Metadata preservation
// ────────────────────────────────────────────────────────────────────────────

describe("metadata preservation", () => {
	test("carries over all metadata fields on user messages", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "user",
				content: "Hello",
				ts: 1700000000000,
				condenseId: "cond_1",
				condenseParent: "cond_0",
				truncationId: "trunc_1",
				truncationParent: "trunc_0",
				isTruncationMarker: true,
				isSummary: true,
			}),
		])
		const msg = result[0] as RooUserMessage
		expect(msg.ts).toBe(1700000000000)
		expect(msg.condenseId).toBe("cond_1")
		expect(msg.condenseParent).toBe("cond_0")
		expect(msg.truncationId).toBe("trunc_1")
		expect(msg.truncationParent).toBe("trunc_0")
		expect(msg.isTruncationMarker).toBe(true)
		expect(msg.isSummary).toBe(true)
	})

	test("carries over metadata on assistant messages", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: "Response",
				ts: 1700000001000,
				isSummary: true,
			}),
		])
		const msg = result[0] as RooAssistantMessage
		expect(msg.ts).toBe(1700000001000)
		expect(msg.isSummary).toBe(true)
	})

	test("carries over metadata on tool messages (split from user)", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "assistant",
				content: [{ type: "tool_use", id: "tc_meta", name: "my_tool", input: {} }],
			}),
			apiMsg({
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "tc_meta", content: "result" }],
				ts: 1700000002000,
				condenseId: "cond_2",
			}),
		]
		const result = convertAnthropicToRooMessages(messages)
		const toolMsg = result[1] as RooToolMessage
		expect(toolMsg.role).toBe("tool")
		expect(toolMsg.ts).toBe(1700000002000)
		expect(toolMsg.condenseId).toBe("cond_2")
	})

	test("carries over metadata on standalone reasoning messages", () => {
		const result = convertAnthropicToRooMessages([
			apiMsg({
				role: "assistant",
				content: "",
				type: "reasoning",
				encrypted_content: "enc_data",
				ts: 1700000003000,
				truncationParent: "trunc_x",
			}),
		])
		const msg = result[0] as RooReasoningMessage
		expect(msg.ts).toBe(1700000003000)
		expect(msg.truncationParent).toBe("trunc_x")
	})

	test("does not include undefined metadata fields", () => {
		const result = convertAnthropicToRooMessages([apiMsg({ role: "user", content: "Hi" })])
		const msg = result[0] as RooUserMessage
		expect(msg).not.toHaveProperty("ts")
		expect(msg).not.toHaveProperty("condenseId")
		expect(msg).not.toHaveProperty("condenseParent")
		expect(msg).not.toHaveProperty("truncationId")
		expect(msg).not.toHaveProperty("truncationParent")
		expect(msg).not.toHaveProperty("isTruncationMarker")
		expect(msg).not.toHaveProperty("isSummary")
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 16. Tool name resolution via tool call ID map
// ────────────────────────────────────────────────────────────────────────────

describe("tool name resolution", () => {
	test("resolves tool names from preceding assistant messages", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "assistant",
				content: [{ type: "tool_use", id: "tc_x", name: "execute_command", input: { command: "ls" } }],
			}),
			apiMsg({
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "tc_x", content: "file_list" }],
			}),
		]
		const result = convertAnthropicToRooMessages(messages)
		const toolMsg = result[1] as RooToolMessage
		expect((toolMsg.content[0] as ToolResultPart).toolName).toBe("execute_command")
	})

	test("falls back to unknown_tool when tool call ID is not found", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "nonexistent_id", content: "result" }],
			}),
		]
		const result = convertAnthropicToRooMessages(messages)
		const toolMsg = result[0] as RooToolMessage
		expect((toolMsg.content[0] as ToolResultPart).toolName).toBe("unknown_tool")
	})

	test("resolves tool names across multiple assistant messages", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "assistant",
				content: [{ type: "tool_use", id: "tc_first", name: "tool_alpha", input: {} }],
			}),
			apiMsg({
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "tc_first", content: "done" }],
			}),
			apiMsg({
				role: "assistant",
				content: [{ type: "tool_use", id: "tc_second", name: "tool_beta", input: {} }],
			}),
			apiMsg({
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "tc_second", content: "done" }],
			}),
		]
		const result = convertAnthropicToRooMessages(messages)
		const toolMsg1 = result[1] as RooToolMessage
		const toolMsg2 = result[3] as RooToolMessage
		expect((toolMsg1.content[0] as ToolResultPart).toolName).toBe("tool_alpha")
		expect((toolMsg2.content[0] as ToolResultPart).toolName).toBe("tool_beta")
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 17. Empty/undefined content edge cases
// ────────────────────────────────────────────────────────────────────────────

describe("empty/undefined content edge cases", () => {
	test("handles empty string user message", () => {
		const result = convertAnthropicToRooMessages([apiMsg({ role: "user", content: "" })])
		expect(result).toHaveLength(1)
		expect((result[0] as RooUserMessage).content).toBe("")
	})

	test("handles empty string assistant message", () => {
		const result = convertAnthropicToRooMessages([apiMsg({ role: "assistant", content: "" })])
		expect(result).toHaveLength(1)
		expect((result[0] as RooAssistantMessage).content).toBe("")
	})

	test("handles empty array content for user (no output messages from that input)", () => {
		const result = convertAnthropicToRooMessages([apiMsg({ role: "user", content: [] })])
		// No text/image parts and no tool results → no messages emitted
		expect(result).toHaveLength(0)
	})

	test("handles empty array content for assistant", () => {
		const result = convertAnthropicToRooMessages([apiMsg({ role: "assistant", content: [] })])
		expect(result).toHaveLength(1)
		const msg = result[0] as RooAssistantMessage
		// Empty content array falls back to empty string
		expect(msg.content).toBe("")
	})

	test("handles empty messages array input", () => {
		const result = convertAnthropicToRooMessages([])
		expect(result).toHaveLength(0)
	})

	test("handles tool_result with image content blocks", () => {
		const messages: ApiMessage[] = [
			apiMsg({
				role: "assistant",
				content: [{ type: "tool_use", id: "tc_img", name: "screenshot", input: {} }],
			}),
			apiMsg({
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tc_img",
						content: [
							{ type: "text", text: "Screenshot taken" },
							{
								type: "image",
								source: { type: "base64", media_type: "image/png", data: "img_data" },
							},
						],
					},
				],
			}),
		]
		const result = convertAnthropicToRooMessages(messages)
		const toolMsg = result[1] as RooToolMessage
		expect(((toolMsg.content[0] as ToolResultPart).output as { value: string }).value).toBe(
			"Screenshot taken\n(image)",
		)
	})
})

// ────────────────────────────────────────────────────────────────────────────
// 18. Full conversation round-trip (multi-message sequence)
// ────────────────────────────────────────────────────────────────────────────

describe("full conversation round-trip", () => {
	test("converts a realistic multi-turn conversation", () => {
		const messages: ApiMessage[] = [
			// Turn 1: user asks a question
			apiMsg({ role: "user", content: "Can you read my config file?", ts: 1000 }),
			// Turn 2: assistant uses a tool
			apiMsg({
				role: "assistant",
				content: [
					{ type: "text", text: "Sure, let me read it." },
					{
						type: "tool_use",
						id: "toolu_read",
						name: "read_file",
						input: { path: "config.json" },
					},
				],
				ts: 2000,
			}),
			// Turn 3: tool result + user follow-up
			apiMsg({
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "toolu_read",
						content: '{"port": 3000}',
					},
					{ type: "text", text: "Can you change the port to 8080?" },
				],
				ts: 3000,
			}),
			// Turn 4: assistant with thinking + tool use
			apiMsg({
				role: "assistant",
				content: [
					{
						type: "thinking",
						thinking: "I need to modify the port value...",
						signature: "sig_think_1",
					} as any,
					{ type: "text", text: "I'll update the port for you." },
					{
						type: "tool_use",
						id: "toolu_write",
						name: "write_file",
						input: { path: "config.json", content: '{"port": 8080}' },
					},
				],
				ts: 4000,
			}),
			// Turn 5: tool result
			apiMsg({
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "toolu_write", content: "File written successfully" }],
				ts: 5000,
			}),
			// Turn 6: assistant confirms
			apiMsg({ role: "assistant", content: "Done! The port has been updated to 8080.", ts: 6000 }),
			// Turn 7: standalone reasoning
			apiMsg({
				role: "assistant",
				content: "",
				type: "reasoning",
				encrypted_content: "enc_reasoning_blob",
				id: "resp_reason",
				ts: 6500,
			}),
		]

		const result = convertAnthropicToRooMessages(messages)

		// Expected sequence:
		// 0: user "Can you read my config file?"
		// 1: assistant [text + tool_use]
		// 2: tool [result of toolu_read]
		// 3: user [text: "Can you change the port..."]
		// 4: assistant [thinking + text + tool_use]
		// 5: tool [result of toolu_write]
		// 6: assistant "Done! The port has been updated..."
		// 7: reasoning message

		expect(result).toHaveLength(8)

		// Message 0: user string
		const m0 = result[0] as RooUserMessage
		expect(m0.role).toBe("user")
		expect(m0.content).toBe("Can you read my config file?")
		expect(m0.ts).toBe(1000)

		// Message 1: assistant with text + tool call
		const m1 = result[1] as RooAssistantMessage
		expect(m1.role).toBe("assistant")
		expect(m1.ts).toBe(2000)
		const m1Parts = m1.content as Array<TextPart | ToolCallPart>
		expect(m1Parts).toHaveLength(2)
		expect(m1Parts[0]).toEqual({ type: "text", text: "Sure, let me read it." })
		expect(m1Parts[1]).toMatchObject({
			type: "tool-call",
			toolCallId: "toolu_read",
			toolName: "read_file",
		})

		// Message 2: tool result
		const m2 = result[2] as RooToolMessage
		expect(m2.role).toBe("tool")
		expect(m2.ts).toBe(3000)
		expect(m2.content[0]).toMatchObject({
			type: "tool-result",
			toolCallId: "toolu_read",
			toolName: "read_file",
			output: { type: "text", value: '{"port": 3000}' },
		})

		// Message 3: user follow-up text
		const m3 = result[3] as RooUserMessage
		expect(m3.role).toBe("user")
		expect(m3.ts).toBe(3000)
		expect(m3.content).toEqual([{ type: "text", text: "Can you change the port to 8080?" }])

		// Message 4: assistant with thinking + text + tool call
		const m4 = result[4] as RooAssistantMessage
		expect(m4.role).toBe("assistant")
		expect(m4.ts).toBe(4000)
		const m4Parts = m4.content as Array<ReasoningPart | TextPart | ToolCallPart>
		expect(m4Parts).toHaveLength(3)
		expect(m4Parts[0]).toEqual({
			type: "reasoning",
			text: "I need to modify the port value...",
			providerOptions: {
				bedrock: { signature: "sig_think_1" },
				anthropic: { signature: "sig_think_1" },
			},
		})
		expect(m4Parts[1]).toEqual({ type: "text", text: "I'll update the port for you." })
		expect(m4Parts[2]).toMatchObject({
			type: "tool-call",
			toolCallId: "toolu_write",
			toolName: "write_file",
		})

		// Message 5: tool result
		const m5 = result[5] as RooToolMessage
		expect(m5.role).toBe("tool")
		expect(m5.ts).toBe(5000)
		expect(((m5.content[0] as ToolResultPart).output as { value: string }).value).toBe("File written successfully")

		// Message 6: assistant string
		const m6 = result[6] as RooAssistantMessage
		expect(m6.role).toBe("assistant")
		expect(m6.content).toBe("Done! The port has been updated to 8080.")
		expect(m6.ts).toBe(6000)

		// Message 7: standalone reasoning
		const m7 = result[7] as RooReasoningMessage
		expect(m7.type).toBe("reasoning")
		expect(m7.encrypted_content).toBe("enc_reasoning_blob")
		expect(m7.id).toBe("resp_reason")
		expect(m7.ts).toBe(6500)
	})
})
