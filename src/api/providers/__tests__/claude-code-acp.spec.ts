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
})
