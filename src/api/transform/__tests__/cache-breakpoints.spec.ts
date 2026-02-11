import type { RooMessage } from "../../../core/task-persistence/rooMessage"
import { applyCacheBreakpoints, type CacheBreakpointConfig } from "../cache-breakpoints"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUserMsg(content = "hi"): RooMessage {
	return { role: "user", content: [{ type: "text", text: content }], ts: Date.now() } as RooMessage
}

function makeAssistantMsg(content = "hello"): RooMessage {
	return { role: "assistant", content: [{ type: "text", text: content }], ts: Date.now() } as RooMessage
}

function makeToolMsg(content = "result"): RooMessage {
	return {
		role: "tool",
		content: [{ type: "tool-result", toolCallId: "1", toolName: "test", output: { type: "text", value: content } }],
		ts: Date.now(),
	} as RooMessage
}

const anthropicCache: CacheBreakpointConfig["cacheProviderOption"] = {
	anthropic: { cacheControl: { type: "ephemeral" } },
}

function defaultConfig(overrides?: Partial<CacheBreakpointConfig>): CacheBreakpointConfig {
	return { cacheProviderOption: anthropicCache, ...overrides }
}

function getProviderOptions(msg: RooMessage): Record<string, Record<string, unknown>> | undefined {
	return (msg as RooMessage & { providerOptions?: Record<string, Record<string, unknown>> }).providerOptions
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applyCacheBreakpoints", () => {
	it("empty messages → no crash", () => {
		const messages: RooMessage[] = []
		expect(() => applyCacheBreakpoints(messages, defaultConfig())).not.toThrow()
	})

	it("single user message → gets breakpoint", () => {
		const messages = [makeUserMsg()]
		applyCacheBreakpoints(messages, defaultConfig())

		expect(getProviderOptions(messages[0])).toEqual(anthropicCache)
	})

	it("single tool message → gets breakpoint", () => {
		const messages = [makeToolMsg()]
		applyCacheBreakpoints(messages, defaultConfig())

		expect(getProviderOptions(messages[0])).toEqual(anthropicCache)
	})

	it("3 batches with maxMessageBreakpoints=2 → only last 2 batches get breakpoints", () => {
		// Batch 1: user (idx 0)
		// Batch 2: tool (idx 2)
		// Batch 3: user (idx 4)
		const messages = [
			makeUserMsg("q1"),
			makeAssistantMsg("a1"),
			makeToolMsg("r1"),
			makeAssistantMsg("a2"),
			makeUserMsg("q2"),
		]

		applyCacheBreakpoints(messages, defaultConfig({ maxMessageBreakpoints: 2 }))

		// Batch 1 (idx 0) should NOT get a breakpoint
		expect(getProviderOptions(messages[0])).toBeUndefined()
		// Batch 2 last = tool at idx 2
		expect(getProviderOptions(messages[2])).toEqual(anthropicCache)
		// Batch 3 last = user at idx 4
		expect(getProviderOptions(messages[4])).toEqual(anthropicCache)
		// Assistants never get breakpoints
		expect(getProviderOptions(messages[1])).toBeUndefined()
		expect(getProviderOptions(messages[3])).toBeUndefined()
	})

	it("consecutive tool+user in same batch → only last in batch gets breakpoint", () => {
		// [tool, user, assistant] → one batch: tool(0), user(1); then assistant(2)
		// Last in batch = user at idx 1
		const messages = [makeToolMsg(), makeUserMsg(), makeAssistantMsg()]

		applyCacheBreakpoints(messages, defaultConfig())

		expect(getProviderOptions(messages[0])).toBeUndefined()
		expect(getProviderOptions(messages[1])).toEqual(anthropicCache)
		expect(getProviderOptions(messages[2])).toBeUndefined()
	})

	it("long conversation with anchor enabled → anchor at ~1/3", () => {
		// Create 6 batches: [user, assistant] × 6, ending with user
		// Pattern: user, assistant, user, assistant, user, assistant, user, assistant, user, assistant, user
		// Batches: idx 0, 2, 4, 6, 8, 10 → batchLastIndices = [0, 2, 4, 6, 8, 10]
		const messages: RooMessage[] = []
		for (let i = 0; i < 6; i++) {
			messages.push(makeUserMsg(`q${i}`))
			if (i < 5) {
				messages.push(makeAssistantMsg(`a${i}`))
			}
		}
		// 6 batches total (each single user msg is a batch)
		// anchorBatchIdx = Math.floor(6 / 3) = 2 → batchLastIndices[2] = idx 4

		applyCacheBreakpoints(
			messages,
			defaultConfig({ maxMessageBreakpoints: 2, useAnchor: true, anchorThreshold: 5 }),
		)

		// Last 2 batches: idx 10 (batch 5) and idx 8 (batch 4)
		expect(getProviderOptions(messages[10])).toEqual(anthropicCache)
		expect(getProviderOptions(messages[8])).toEqual(anthropicCache)
		// Anchor at batch 2 → idx 4
		expect(getProviderOptions(messages[4])).toEqual(anthropicCache)
		// Other user messages should NOT have breakpoints
		expect(getProviderOptions(messages[0])).toBeUndefined()
		expect(getProviderOptions(messages[2])).toBeUndefined()
		expect(getProviderOptions(messages[6])).toBeUndefined()
	})

	it("messages with existing providerOptions → preserved", () => {
		const msg = makeUserMsg()
		;(msg as RooMessage & { providerOptions?: Record<string, Record<string, unknown>> }).providerOptions = {
			other: { key: "val" },
		}
		const messages = [msg]

		applyCacheBreakpoints(messages, defaultConfig())

		const opts = getProviderOptions(messages[0])
		expect(opts).toEqual({
			other: { key: "val" },
			anthropic: { cacheControl: { type: "ephemeral" } },
		})
	})

	it("maxMessageBreakpoints=3 (Bedrock config) → 3 breakpoints", () => {
		// 4 batches: user, asst, user, asst, user, asst, user
		const messages: RooMessage[] = []
		for (let i = 0; i < 4; i++) {
			messages.push(makeUserMsg(`q${i}`))
			if (i < 3) {
				messages.push(makeAssistantMsg(`a${i}`))
			}
		}
		// batchLastIndices = [0, 2, 4, 6] → 4 batches
		// maxMessageBreakpoints=3 → last 3: idx 6, 4, 2

		applyCacheBreakpoints(messages, defaultConfig({ maxMessageBreakpoints: 3 }))

		// Last 3 batch-end messages get breakpoints
		expect(getProviderOptions(messages[6])).toEqual(anthropicCache)
		expect(getProviderOptions(messages[4])).toEqual(anthropicCache)
		expect(getProviderOptions(messages[2])).toEqual(anthropicCache)
		// First batch (idx 0) should NOT
		expect(getProviderOptions(messages[0])).toBeUndefined()
	})
})
