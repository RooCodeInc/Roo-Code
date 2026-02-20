import type { ClineMessage } from "@roo-code/types"
import { fileChangesFromMessages } from "../components/chat/utils/fileChangesFromMessages"

function msg(overrides: Partial<ClineMessage> & { text: string }): ClineMessage {
	return {
		type: "say",
		say: "tool",
		ts: Date.now(),
		partial: false,
		...overrides,
	}
}

describe("fileChangesFromMessages", () => {
	it("returns empty array for undefined messages", () => {
		expect(fileChangesFromMessages(undefined)).toEqual([])
	})

	it("returns empty array for empty messages", () => {
		expect(fileChangesFromMessages([])).toEqual([])
	})

	it("ignores non-tool messages", () => {
		const messages: ClineMessage[] = [
			msg({ type: "say", say: "text", text: "hello" }),
			msg({ type: "ask", ask: "followup", text: "world" }),
		]
		expect(fileChangesFromMessages(messages)).toEqual([])
	})

	it("ignores tool messages with non-file-edit tool type", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "read_file", path: "a.ts" }),
			}),
		]
		expect(fileChangesFromMessages(messages)).toEqual([])
	})

	it("skips partial messages", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				partial: true,
				text: JSON.stringify({
					tool: "appliedDiff",
					path: "src/file.ts",
					diff: "+x",
				}),
			}),
		]
		expect(fileChangesFromMessages(messages)).toEqual([])
	})

	it("excludes ask tool file-edit when isAnswered is false or undefined", () => {
		const payload = JSON.stringify({
			tool: "appliedDiff",
			path: "src/foo.ts",
			diff: "+line",
		})
		expect(fileChangesFromMessages([msg({ type: "ask", ask: "tool", text: payload, isAnswered: false })])).toEqual(
			[],
		)
		expect(fileChangesFromMessages([msg({ type: "ask", ask: "tool", text: payload })])).toEqual([])
	})

	it("includes ask tool file-edit when isAnswered is true", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				isAnswered: true,
				text: JSON.stringify({
					tool: "appliedDiff",
					path: "src/foo.ts",
					diff: "+line",
				}),
			}),
		]
		const result = fileChangesFromMessages(messages)
		expect(result).toHaveLength(1)
		expect(result[0].path).toBe("src/foo.ts")
	})

	it("extracts single-file edit from ask tool message", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				isAnswered: true,
				text: JSON.stringify({
					tool: "appliedDiff",
					path: "src/foo.ts",
					diff: "@@ -1 +1 @@\n+line",
					diffStats: { added: 1, removed: 0 },
				}),
			}),
		]
		const result = fileChangesFromMessages(messages)
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({
			path: "src/foo.ts",
			diff: "@@ -1 +1 @@\n+line",
			diffStats: { added: 1, removed: 0 },
		})
	})

	it("extracts single-file edit from say tool message", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "say",
				say: "tool",
				text: JSON.stringify({
					tool: "editedExistingFile",
					path: "lib/bar.ts",
					diff: "-old\n+new",
				}),
			}),
		]
		const result = fileChangesFromMessages(messages)
		expect(result).toHaveLength(1)
		expect(result[0].path).toBe("lib/bar.ts")
		expect(result[0].diff).toBe("-old\n+new")
	})

	it("uses content when diff is missing for single-file", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				isAnswered: true,
				text: JSON.stringify({
					tool: "newFileCreated",
					path: "new.ts",
					content: "full file content",
				}),
			}),
		]
		const result = fileChangesFromMessages(messages)
		expect(result).toHaveLength(1)
		expect(result[0].diff).toBe("full file content")
	})

	it("ignores single-file tool when path is missing", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				text: JSON.stringify({
					tool: "appliedDiff",
					diff: "something",
				}),
			}),
		]
		expect(fileChangesFromMessages(messages)).toEqual([])
	})

	it("ignores single-file tool when diff and content are empty", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				text: JSON.stringify({
					tool: "appliedDiff",
					path: "x.ts",
				}),
			}),
		]
		expect(fileChangesFromMessages(messages)).toEqual([])
	})

	it("extracts from batchDiffs", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				isAnswered: true,
				text: JSON.stringify({
					tool: "appliedDiff",
					batchDiffs: [
						{ path: "a.ts", content: "content a" },
						{ path: "b.ts", diffs: [{ content: "content b" }] },
						{ path: "c.ts" }, // no content
					],
				}),
			}),
		]
		const result = fileChangesFromMessages(messages)
		expect(result).toHaveLength(2)
		expect(result[0]).toEqual({ path: "a.ts", diff: "content a" })
		expect(result[1].path).toBe("b.ts")
		expect(result[1].diff).toBe("content b")
	})

	it("includes diffStats from batchDiffs when present", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				isAnswered: true,
				text: JSON.stringify({
					tool: "appliedDiff",
					batchDiffs: [
						{
							path: "f.ts",
							content: "x",
							diffStats: { added: 2, removed: 1 },
						},
					],
				}),
			}),
		]
		const result = fileChangesFromMessages(messages)
		expect(result[0].diffStats).toEqual({ added: 2, removed: 1 })
	})

	it("recognizes all ClineSayTool file-edit tool names (editedExistingFile, appliedDiff, newFileCreated)", () => {
		const tools = ["editedExistingFile", "appliedDiff", "newFileCreated"]
		for (const tool of tools) {
			const messages: ClineMessage[] = [
				msg({
					type: "ask",
					ask: "tool",
					isAnswered: true,
					text: JSON.stringify({
						tool,
						path: "f.ts",
						diff: "d",
					}),
				}),
			]
			const result = fileChangesFromMessages(messages)
			expect(result).toHaveLength(1)
			expect(result[0].path).toBe("f.ts")
		}
	})

	it("returns multiple entries for multiple file-edit messages", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				isAnswered: true,
				text: JSON.stringify({
					tool: "appliedDiff",
					path: "first.ts",
					diff: "a",
				}),
			}),
			msg({
				type: "ask",
				ask: "tool",
				isAnswered: true,
				text: JSON.stringify({
					tool: "editedExistingFile",
					path: "second.ts",
					diff: "b",
				}),
			}),
		]
		const result = fileChangesFromMessages(messages)
		expect(result).toHaveLength(2)
		expect(result[0].path).toBe("first.ts")
		expect(result[1].path).toBe("second.ts")
	})

	it("skips invalid JSON in message text", () => {
		const messages: ClineMessage[] = [
			msg({
				type: "ask",
				ask: "tool",
				text: "not json",
			}),
		]
		expect(fileChangesFromMessages(messages)).toEqual([])
	})
})
