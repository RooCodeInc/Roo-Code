import type { ClineMessage } from "@roo-code/types"
import { Writable } from "stream"

import { JsonEventEmitter } from "../json-event-emitter.js"

function createMockStdout(): { stdout: NodeJS.WriteStream; lines: () => Record<string, unknown>[] } {
	const chunks: string[] = []

	const writable = new Writable({
		write(chunk, _encoding, callback) {
			chunks.push(chunk.toString())
			callback()
		},
	}) as unknown as NodeJS.WriteStream

	const lines = () =>
		chunks
			.join("")
			.split("\n")
			.filter((line) => line.length > 0)
			.map((line) => JSON.parse(line) as Record<string, unknown>)

	return { stdout: writable, lines }
}

function emitMessage(emitter: JsonEventEmitter, message: ClineMessage): void {
	;(emitter as unknown as { handleMessage: (msg: ClineMessage, isUpdate: boolean) => void }).handleMessage(
		message,
		false,
	)
}

function createAskMessage(overrides: Partial<ClineMessage>): ClineMessage {
	return {
		ts: 1,
		type: "ask",
		ask: "tool",
		partial: true,
		text: "",
		...overrides,
	} as ClineMessage
}

describe("JsonEventEmitter streaming deltas", () => {
	it("streams ask:command partial updates as deltas and emits full final snapshot", () => {
		const { stdout, lines } = createMockStdout()
		const emitter = new JsonEventEmitter({ mode: "stream-json", stdout })
		const id = 101

		emitMessage(
			emitter,
			createAskMessage({
				ts: id,
				ask: "command",
				partial: true,
				text: "g",
			}),
		)
		emitMessage(
			emitter,
			createAskMessage({
				ts: id,
				ask: "command",
				partial: true,
				text: "gh",
			}),
		)
		emitMessage(
			emitter,
			createAskMessage({
				ts: id,
				ask: "command",
				partial: true,
				text: "gh pr",
			}),
		)
		emitMessage(
			emitter,
			createAskMessage({
				ts: id,
				ask: "command",
				partial: false,
				text: "gh pr",
			}),
		)

		const output = lines()
		expect(output).toHaveLength(4)
		expect(output[0]).toMatchObject({
			type: "tool_use",
			id,
			subtype: "command",
			content: "g",
			tool_use: { name: "execute_command", input: { command: "g" } },
		})
		expect(output[1]).toMatchObject({
			type: "tool_use",
			id,
			subtype: "command",
			content: "h",
			tool_use: { name: "execute_command", input: { command: "h" } },
		})
		expect(output[2]).toMatchObject({
			type: "tool_use",
			id,
			subtype: "command",
			content: " pr",
			tool_use: { name: "execute_command", input: { command: " pr" } },
		})
		expect(output[3]).toMatchObject({
			type: "tool_use",
			id,
			subtype: "command",
			tool_use: { name: "execute_command", input: { command: "gh pr" } },
			done: true,
		})
		expect(output[3]).not.toHaveProperty("content")
	})

	it("streams ask:tool snapshots as structured deltas and preserves full final payload", () => {
		const { stdout, lines } = createMockStdout()
		const emitter = new JsonEventEmitter({ mode: "stream-json", stdout })
		const id = 202
		const first = JSON.stringify({ tool: "readFile", path: "a" })
		const second = JSON.stringify({ tool: "readFile", path: "ab" })

		emitMessage(
			emitter,
			createAskMessage({
				ts: id,
				ask: "tool",
				partial: true,
				text: first,
			}),
		)
		emitMessage(
			emitter,
			createAskMessage({
				ts: id,
				ask: "tool",
				partial: true,
				text: second,
			}),
		)
		emitMessage(
			emitter,
			createAskMessage({
				ts: id,
				ask: "tool",
				partial: false,
				text: second,
			}),
		)

		const output = lines()
		expect(output).toHaveLength(3)
		expect(output[0]).toMatchObject({
			type: "tool_use",
			id,
			subtype: "tool",
			content: first,
			tool_use: { name: "readFile" },
		})
		expect(output[1]).toMatchObject({
			type: "tool_use",
			id,
			subtype: "tool",
			content: "b",
			tool_use: { name: "readFile" },
		})
		expect(output[2]).toMatchObject({
			type: "tool_use",
			id,
			subtype: "tool",
			tool_use: { name: "readFile", input: { tool: "readFile", path: "ab" } },
			done: true,
		})
	})

	it("suppresses duplicate partial tool snapshots with no delta", () => {
		const { stdout, lines } = createMockStdout()
		const emitter = new JsonEventEmitter({ mode: "stream-json", stdout })
		const id = 303

		emitMessage(
			emitter,
			createAskMessage({
				ts: id,
				ask: "command",
				partial: true,
				text: "gh",
			}),
		)
		emitMessage(
			emitter,
			createAskMessage({
				ts: id,
				ask: "command",
				partial: true,
				text: "gh",
			}),
		)
		emitMessage(
			emitter,
			createAskMessage({
				ts: id,
				ask: "command",
				partial: true,
				text: "gh pr",
			}),
		)

		const output = lines()
		expect(output).toHaveLength(2)
		expect(output[0]).toMatchObject({ content: "gh" })
		expect(output[1]).toMatchObject({ content: " pr" })
	})
})
