import { Anthropic } from "@anthropic-ai/sdk"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ClaudeCodeAcpHandler } from "../claude-code-acp"
import * as pathUtils from "../../../utils/path"

describe("ClaudeCodeAcpHandler", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("fits formatted conversation to a character budget", () => {
		const handler = new ClaudeCodeAcpHandler({} as any)

		const messages: Anthropic.Messages.MessageParam[] = []
		for (let i = 0; i < 50; i++) {
			messages.push({
				role: i % 2 === 0 ? "user" : "assistant",
				content: `message-${i}\n` + "x".repeat(2_000),
			})
		}
		// Ensure we can detect that the tail is preserved.
		messages.push({ role: "assistant", content: "LAST_MESSAGE" + "y".repeat(2_000) })

		const maxChars = 5_000
		const formatted = (handler as any).formatConversation(messages, maxChars) as string

		expect(formatted.length).toBeLessThanOrEqual(maxChars)
		expect(formatted).toContain("[... earlier conversation omitted due to length ...]")
		expect(formatted).toContain("LAST_MESSAGE")
	})

	it("truncates large tool results while preserving head and tail", () => {
		const handler = new ClaudeCodeAcpHandler({} as any)

		const huge = `HEAD\n${"a".repeat(9_000)}\nTAIL`
		const msg: Anthropic.Messages.MessageParam = {
			role: "user",
			content: [
				{
					type: "tool_result",
					tool_use_id: "tool_use_1",
					is_error: false,
					content: huge,
				} as any,
			],
		}

		const formatted = (handler as any).formatSingleMessage(msg, false) as string
		expect(formatted).toContain("HEAD")
		expect(formatted).toContain("TAIL")
		expect(formatted).toContain("...truncated")
	})

	it("prefers explicitly configured ACP working directory", () => {
		vi.spyOn(pathUtils, "getWorkspacePath").mockReturnValue("/workspace")

		const handler = new ClaudeCodeAcpHandler({
			claudeCodeAcpWorkingDirectory: "/configured",
		} as any)

		expect((handler as any).resolveWorkingDirectory()).toBe("/configured")
	})

	it("uses active workspace directory when ACP working directory is not configured", () => {
		vi.spyOn(pathUtils, "getWorkspacePath").mockReturnValue("/workspace")

		const handler = new ClaudeCodeAcpHandler({} as any)

		expect((handler as any).resolveWorkingDirectory()).toBe("/workspace")
	})

	it("falls back to process cwd when no configured or workspace directory is available", () => {
		vi.spyOn(pathUtils, "getWorkspacePath").mockReturnValue("")
		vi.spyOn(process, "cwd").mockReturnValue("/process-cwd")

		const handler = new ClaudeCodeAcpHandler({} as any)

		expect((handler as any).resolveWorkingDirectory()).toBe("/process-cwd")
	})

	it("extracts text from array content blocks", () => {
		const handler = new ClaudeCodeAcpHandler({} as any)

		const content = [
			{ type: "text", text: "Hello " },
			{ type: "text", text: "world" },
		]

		expect((handler as any).extractTextFromContent(content)).toBe("Hello world")
	})

	it("extracts text from updates without a known update type", () => {
		const handler = new ClaudeCodeAcpHandler({} as any)

		const update = {
			content: { type: "text", text: "Fallback text" },
		}

		expect((handler as any).extractTextFromUpdate(update)).toBe("Fallback text")
	})

	it("parses tool call with closing tag", () => {
		const handler = new ClaudeCodeAcpHandler({} as any)

		const text =
			'before <roo_tool_call>{"name":"read_file","arguments":{"path":"package.json"}}</roo_tool_call> after'

		const chunks = (handler as any).parseProxyResponse(text)
		const toolCall = chunks.find((chunk: any) => chunk.type === "tool_call")

		expect(toolCall).toBeTruthy()
		expect(toolCall.name).toBe("read_file")
		expect(toolCall.arguments).toContain("package.json")

		const combinedText = chunks
			.filter((chunk: any) => chunk.type === "text")
			.map((chunk: any) => chunk.text)
			.join(" ")
		expect(combinedText).toContain("before")
		expect(combinedText).toContain("after")
	})

	it("recovers tool call when closing tag is missing", () => {
		const handler = new ClaudeCodeAcpHandler({} as any)

		const text = 'before <roo_tool_call>{"name":"read_file","arguments":{"path":"package.json"}}'

		const chunks = (handler as any).parseProxyResponse(text)
		const toolCall = chunks.find((chunk: any) => chunk.type === "tool_call")

		expect(toolCall).toBeTruthy()
		expect(toolCall.name).toBe("read_file")
		expect(toolCall.arguments).toContain("package.json")

		const combinedText = chunks
			.filter((chunk: any) => chunk.type === "text")
			.map((chunk: any) => chunk.text)
			.join(" ")
		expect(combinedText).toContain("before")
	})

	it("recovers tool call with trailing text inside block", () => {
		const handler = new ClaudeCodeAcpHandler({} as any)

		const text = '<roo_tool_call>{"name":"read_file","arguments":{"path":"package.json"}} trailing</roo_tool_call>'

		const chunks = (handler as any).parseProxyResponse(text)
		const toolCall = chunks.find((chunk: any) => chunk.type === "tool_call")

		expect(toolCall).toBeTruthy()
		expect(toolCall.name).toBe("read_file")
		expect(toolCall.arguments).toContain("package.json")

		const combinedText = chunks
			.filter((chunk: any) => chunk.type === "text")
			.map((chunk: any) => chunk.text)
			.join(" ")
		expect(combinedText).toContain("trailing")
	})

	it("preserves text when tool call payload is unrecoverable", () => {
		const handler = new ClaudeCodeAcpHandler({} as any)

		const text = "<roo_tool_call>{not json}</roo_tool_call>"
		const chunks = (handler as any).parseProxyResponse(text)

		const textChunk = chunks.find((chunk: any) => chunk.type === "text")
		expect(textChunk).toBeTruthy()
		expect(textChunk.text).toContain("<roo_tool_call>")
	})
})
