// npx vitest run src/services/git-ai/__tests__/transcript.spec.ts

import type { ApiMessage } from "../../../core/task-persistence/apiMessages"
import { buildTranscript } from "../transcript"

describe("buildTranscript", () => {
	it("converts a simple string user message", () => {
		const history: ApiMessage[] = [
			{ role: "user", content: "Hello world", ts: 1700000000000 },
		]

		const result = buildTranscript(history)

		expect(result).toEqual([
			{
				type: "user",
				text: "Hello world",
				timestamp: new Date(1700000000000).toISOString(),
			},
		])
	})

	it("converts a simple string assistant message", () => {
		const history: ApiMessage[] = [
			{ role: "assistant", content: "Sure, I can help", ts: 1700000001000 },
		]

		const result = buildTranscript(history)

		expect(result).toEqual([
			{
				type: "assistant",
				text: "Sure, I can help",
				timestamp: new Date(1700000001000).toISOString(),
			},
		])
	})

	it("converts array-content assistant messages with text and tool_use blocks", () => {
		const history: ApiMessage[] = [
			{
				role: "assistant",
				content: [
					{ type: "text", text: "Let me edit that file." },
					{
						type: "tool_use",
						id: "tool_1",
						name: "edit_file",
						input: { file_path: "src/index.ts", old_string: "foo", new_string: "bar" },
					},
				],
				ts: 1700000002000,
			},
		]

		const result = buildTranscript(history)

		expect(result).toEqual([
			{
				type: "assistant",
				text: "Let me edit that file.",
				timestamp: new Date(1700000002000).toISOString(),
			},
			{
				type: "tool_use",
				name: "edit_file",
				input: { file_path: "src/index.ts", old_string: "foo", new_string: "bar" },
				timestamp: new Date(1700000002000).toISOString(),
			},
		])
	})

	it("excludes tool_result blocks from user messages", () => {
		const history: ApiMessage[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Please fix this" },
					{
						type: "tool_result",
						tool_use_id: "tool_1",
						content: "File edited successfully",
					},
				],
				ts: 1700000003000,
			},
		]

		const result = buildTranscript(history)

		// Only the text block should be included, tool_result excluded
		expect(result).toEqual([
			{
				type: "user",
				text: "Please fix this",
				timestamp: new Date(1700000003000).toISOString(),
			},
		])
	})

	it("handles messages without timestamps", () => {
		const history: ApiMessage[] = [
			{ role: "user", content: "No timestamp" },
		]

		const result = buildTranscript(history)

		expect(result).toEqual([
			{
				type: "user",
				text: "No timestamp",
				timestamp: undefined,
			},
		])
	})

	it("truncates to last 50 messages", () => {
		const history: ApiMessage[] = Array.from({ length: 60 }, (_, i) => ({
			role: "user" as const,
			content: `Message ${i}`,
			ts: 1700000000000 + i * 1000,
		}))

		const result = buildTranscript(history)

		// Should only process the last 50 ApiMessages
		expect(result.length).toBe(50)
		expect(result[0].text).toBe("Message 10")
		expect(result[49].text).toBe("Message 59")
	})

	it("handles a mixed conversation with multiple message types", () => {
		const history: ApiMessage[] = [
			{ role: "user", content: "Fix the bug", ts: 1700000000000 },
			{
				role: "assistant",
				content: [
					{ type: "text", text: "I'll look into it." },
					{
						type: "tool_use",
						id: "tool_1",
						name: "read_file",
						input: { path: "src/bug.ts" },
					},
				],
				ts: 1700000001000,
			},
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool_1",
						content: "file contents here",
					},
				],
				ts: 1700000002000,
			},
			{
				role: "assistant",
				content: "I found the issue and fixed it.",
				ts: 1700000003000,
			},
		]

		const result = buildTranscript(history)

		expect(result).toEqual([
			{ type: "user", text: "Fix the bug", timestamp: new Date(1700000000000).toISOString() },
			{ type: "assistant", text: "I'll look into it.", timestamp: new Date(1700000001000).toISOString() },
			{
				type: "tool_use",
				name: "read_file",
				input: { path: "src/bug.ts" },
				timestamp: new Date(1700000001000).toISOString(),
			},
			// tool_result message is excluded entirely
			{
				type: "assistant",
				text: "I found the issue and fixed it.",
				timestamp: new Date(1700000003000).toISOString(),
			},
		])
	})

	it("filters out environment_details string messages", () => {
		const history: ApiMessage[] = [
			{ role: "user", content: "Fix the bug", ts: 1700000000000 },
			{
				role: "user",
				content: "<environment_details>\n# VSCode Visible Files\nfirst-20-primes.txt\n\n# Current Time\n...\n</environment_details>",
				ts: 1700000001000,
			},
		]

		const result = buildTranscript(history)

		expect(result).toEqual([
			{ type: "user", text: "Fix the bug", timestamp: new Date(1700000000000).toISOString() },
		])
	})

	it("filters out environment_details text blocks within array content", () => {
		const history: ApiMessage[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "<user_message>\nfix the bug\n</user_message>" },
					{ type: "text", text: "<environment_details>\n# VSCode Visible Files\n...</environment_details>" },
				],
				ts: 1700000000000,
			},
		]

		const result = buildTranscript(history)

		expect(result).toEqual([
			{
				type: "user",
				text: "<user_message>\nfix the bug\n</user_message>",
				timestamp: new Date(1700000000000).toISOString(),
			},
		])
	})

	it("keeps non-environment_details user messages like read_file results", () => {
		const history: ApiMessage[] = [
			{
				role: "user",
				content: "[read_file for 'src/index.ts']\nFile: src/index.ts\n  1 | console.log('hello')",
				ts: 1700000000000,
			},
		]

		const result = buildTranscript(history)

		expect(result).toHaveLength(1)
		expect(result[0].text).toContain("[read_file for")
	})

	it("does not filter environment_details-like text from assistant messages", () => {
		const history: ApiMessage[] = [
			{ role: "assistant", content: "<environment_details>\nsome response", ts: 1700000000000 },
		]

		const result = buildTranscript(history)

		expect(result).toHaveLength(1)
		expect(result[0].type).toBe("assistant")
	})

	it("skips messages with non-string, non-array content", () => {
		const history: ApiMessage[] = [
			{ role: "user", content: undefined as any },
			{ role: "assistant", content: 42 as any },
		]

		const result = buildTranscript(history)

		expect(result).toEqual([])
	})
})
