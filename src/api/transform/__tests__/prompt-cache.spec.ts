import type {
	RooMessage,
	RooUserMessage,
	RooAssistantMessage,
	RooToolMessage,
} from "../../../core/task-persistence/rooMessage"
import type { ModelInfo } from "@roo-code/types"
import { resolveCacheProviderOptions, applyCacheBreakpoints, type PromptCacheConfig } from "../prompt-cache"

// ────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Shorthand to read the runtime-assigned `providerOptions` from a mutated message. */
function opts(msg: RooMessage): Record<string, Record<string, unknown>> | undefined {
	return (msg as unknown as { providerOptions?: Record<string, Record<string, unknown>> }).providerOptions
}

/** Shorthand to set `providerOptions` on a message (for pre-existing options tests). */
function setOpts(msg: RooMessage, value: Record<string, unknown>): void {
	;(msg as unknown as { providerOptions: Record<string, unknown> }).providerOptions = value
}

function makeUserMsg(text: string = "hi"): RooUserMessage {
	return { role: "user", content: text }
}

function makeAssistantMsg(text: string = "hello"): RooAssistantMessage {
	return { role: "assistant", content: text }
}

function makeToolMsg(toolCallId: string = "tool-1"): RooToolMessage {
	return {
		role: "tool",
		content: [
			{
				type: "tool-result",
				toolCallId,
				toolName: "test",
				output: { type: "text", value: "ok" },
			},
		],
	} as RooToolMessage
}

// ────────────────────────────────────────────────────────────────────────────
// Shared Fixtures
// ────────────────────────────────────────────────────────────────────────────

const baseModelInfo = {
	contextWindow: 200_000,
	supportsPromptCache: true,
} as ModelInfo

const noPromptCacheModelInfo = {
	contextWindow: 200_000,
	supportsPromptCache: false,
} as ModelInfo

const ANTHROPIC_CACHE = { anthropic: { cacheControl: { type: "ephemeral" } } }
const BEDROCK_CACHE = { bedrock: { cachePoint: { type: "default" } } }

// ────────────────────────────────────────────────────────────────────────────
// resolveCacheProviderOptions
// ────────────────────────────────────────────────────────────────────────────

describe("resolveCacheProviderOptions", () => {
	it("returns null when model does not support prompt cache", () => {
		const config: PromptCacheConfig = {
			providerName: "anthropic",
			modelInfo: noPromptCacheModelInfo,
		}

		expect(resolveCacheProviderOptions(config)).toBeNull()
	})

	it("returns null for an unknown provider", () => {
		const config: PromptCacheConfig = {
			providerName: "some-unknown-provider",
			modelInfo: baseModelInfo,
		}

		expect(resolveCacheProviderOptions(config)).toBeNull()
	})

	it("returns anthropic cache options for anthropic provider", () => {
		const config: PromptCacheConfig = {
			providerName: "anthropic",
			modelInfo: baseModelInfo,
		}

		expect(resolveCacheProviderOptions(config)).toEqual(ANTHROPIC_CACHE)
	})

	it("returns anthropic cache options for vertex provider", () => {
		const config: PromptCacheConfig = {
			providerName: "vertex",
			modelInfo: baseModelInfo,
		}

		expect(resolveCacheProviderOptions(config)).toEqual(ANTHROPIC_CACHE)
	})

	it("returns anthropic cache options for minimax provider", () => {
		const config: PromptCacheConfig = {
			providerName: "minimax",
			modelInfo: baseModelInfo,
		}

		expect(resolveCacheProviderOptions(config)).toEqual(ANTHROPIC_CACHE)
	})

	it("returns bedrock cache options when awsUsePromptCache is enabled", () => {
		const config: PromptCacheConfig = {
			providerName: "bedrock",
			modelInfo: baseModelInfo,
			providerSettings: { awsUsePromptCache: true },
		}

		expect(resolveCacheProviderOptions(config)).toEqual(BEDROCK_CACHE)
	})

	it("returns null for bedrock without awsUsePromptCache", () => {
		const config: PromptCacheConfig = {
			providerName: "bedrock",
			modelInfo: baseModelInfo,
		}

		expect(resolveCacheProviderOptions(config)).toBeNull()
	})
})

// ────────────────────────────────────────────────────────────────────────────
// applyCacheBreakpoints
// ────────────────────────────────────────────────────────────────────────────

describe("applyCacheBreakpoints", () => {
	it("returns empty array unchanged when no messages", () => {
		const messages: RooMessage[] = []
		const result = applyCacheBreakpoints(messages, ANTHROPIC_CACHE)

		expect(result).toHaveLength(0)
		expect(result).toBe(messages) // same reference — mutates in place
	})

	it("places breakpoint on a single user message", () => {
		const messages: RooMessage[] = [makeUserMsg()]

		applyCacheBreakpoints(messages, ANTHROPIC_CACHE)

		expect(opts(messages[0])).toEqual(ANTHROPIC_CACHE)
	})

	it("places breakpoint on a single tool message", () => {
		const messages: RooMessage[] = [makeToolMsg()]

		applyCacheBreakpoints(messages, ANTHROPIC_CACHE)

		expect(opts(messages[0])).toEqual(ANTHROPIC_CACHE)
	})

	it("places breakpoints at end of each non-assistant batch (user → assistant → tool → user)", () => {
		// Batch 1: [user(0)]  Batch 2: [tool(2), user(3)]
		const messages: RooMessage[] = [
			makeUserMsg("u0"), // index 0 — batch 1 end
			makeAssistantMsg("a1"), // index 1 — assistant (separator)
			makeToolMsg("t2"), // index 2 — batch 2 start
			makeUserMsg("u3"), // index 3 — batch 2 end
		]

		applyCacheBreakpoints(messages, ANTHROPIC_CACHE, 2)

		expect(opts(messages[0])).toEqual(ANTHROPIC_CACHE)
		expect(opts(messages[1])).toBeUndefined()
		expect(opts(messages[2])).toBeUndefined()
		expect(opts(messages[3])).toEqual(ANTHROPIC_CACHE)
	})

	it("only targets last message in each batch for consecutive non-assistant messages", () => {
		// Batch 1: [tool(0), user(1)]  Batch 2: [tool(3), user(4)]
		const messages: RooMessage[] = [
			makeToolMsg("t0"), // index 0 — batch 1 start
			makeUserMsg("u1"), // index 1 — batch 1 end
			makeAssistantMsg("a2"), // index 2 — assistant (separator)
			makeToolMsg("t3"), // index 3 — batch 2 start
			makeUserMsg("u4"), // index 4 — batch 2 end
		]

		applyCacheBreakpoints(messages, ANTHROPIC_CACHE, 2)

		expect(opts(messages[0])).toBeUndefined()
		expect(opts(messages[1])).toEqual(ANTHROPIC_CACHE)
		expect(opts(messages[2])).toBeUndefined()
		expect(opts(messages[3])).toBeUndefined()
		expect(opts(messages[4])).toEqual(ANTHROPIC_CACHE)
	})

	it("places anchor breakpoint at ~1/3 for long conversations with useAnchor", () => {
		// Build alternating user/assistant: 10 messages, 5 non-assistant batches
		// Batches (by end index): [0], [2], [4], [6], [8]
		const messages: RooMessage[] = []
		for (let i = 0; i < 5; i++) {
			messages.push(makeUserMsg(`u${i * 2}`))
			messages.push(makeAssistantMsg(`a${i * 2 + 1}`))
		}

		// maxBreakpoints=2, useAnchor=true, anchorThreshold=5
		applyCacheBreakpoints(messages, BEDROCK_CACHE, 2, true, 5)

		// targetBatches = last 2 batch-ends: indices 6 and 8
		// anchorIndex = Math.floor(10 / 3) = 3 → first batch with end >= 3 is batch[4]
		// batch[4] not in targetBatches → gets anchor breakpoint
		// Total breakpoints at indices: 4 (anchor), 6 (trailing), 8 (trailing)
		expect(opts(messages[0])).toBeUndefined()
		expect(opts(messages[2])).toBeUndefined()
		expect(opts(messages[4])).toEqual(BEDROCK_CACHE)
		expect(opts(messages[6])).toEqual(BEDROCK_CACHE)
		expect(opts(messages[8])).toEqual(BEDROCK_CACHE)
	})

	it("preserves existing providerOptions on message (merged, not replaced)", () => {
		const messages: RooMessage[] = [makeUserMsg()]
		setOpts(messages[0], { openai: { someOption: true } })

		applyCacheBreakpoints(messages, ANTHROPIC_CACHE)

		const result = opts(messages[0])
		// Existing provider-specific key should be preserved alongside cache options
		expect(result?.openai).toEqual({ someOption: true })
		expect(result?.anthropic).toEqual({ cacheControl: { type: "ephemeral" } })
	})
})
