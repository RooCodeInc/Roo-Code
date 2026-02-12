import {
	applyCacheBreakpoints,
	applyToolCacheOptions,
	applySystemPromptCaching,
	UNIVERSAL_CACHE_OPTIONS,
} from "../cache-breakpoints"

type TestMessage = { role: string; providerOptions?: Record<string, Record<string, unknown>> }

describe("UNIVERSAL_CACHE_OPTIONS", () => {
	it("includes anthropic namespace with ephemeral cacheControl", () => {
		expect(UNIVERSAL_CACHE_OPTIONS.anthropic).toEqual({ cacheControl: { type: "ephemeral" } })
	})

	it("includes bedrock namespace with default cachePoint", () => {
		expect(UNIVERSAL_CACHE_OPTIONS.bedrock).toEqual({ cachePoint: { type: "default" } })
	})
})

describe("applyCacheBreakpoints", () => {
	it("is a no-op for empty message array", () => {
		const messages: TestMessage[] = []
		applyCacheBreakpoints(messages)
		expect(messages).toEqual([])
	})

	it("is a no-op when all messages are assistant or system", () => {
		const messages: TestMessage[] = [{ role: "system" }, { role: "assistant" }, { role: "assistant" }]
		applyCacheBreakpoints(messages)
		expect(messages[0].providerOptions).toBeUndefined()
		expect(messages[1].providerOptions).toBeUndefined()
		expect(messages[2].providerOptions).toBeUndefined()
	})

	it("places 1 breakpoint on a single user message", () => {
		const messages: TestMessage[] = [{ role: "user" }]
		applyCacheBreakpoints(messages)
		expect(messages[0].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
	})

	it("places 1 breakpoint on a single tool message", () => {
		const messages: TestMessage[] = [{ role: "tool" }]
		applyCacheBreakpoints(messages)
		expect(messages[0].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
	})

	it("places 2 breakpoints on 2 user messages", () => {
		const messages: TestMessage[] = [{ role: "user" }, { role: "user" }]
		applyCacheBreakpoints(messages)
		expect(messages[0].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
		expect(messages[1].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
	})

	it("places 2 breakpoints on 2 tool messages", () => {
		const messages: TestMessage[] = [{ role: "tool" }, { role: "tool" }]
		applyCacheBreakpoints(messages)
		expect(messages[0].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
		expect(messages[1].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
	})

	it("targets last 2 non-assistant messages in a mixed conversation", () => {
		const messages: TestMessage[] = [
			{ role: "user" },
			{ role: "assistant" },
			{ role: "user" },
			{ role: "assistant" },
			{ role: "tool" },
		]
		applyCacheBreakpoints(messages)
		// Last 2 non-assistant: index 2 (user) and index 4 (tool)
		expect(messages[0].providerOptions).toBeUndefined()
		expect(messages[1].providerOptions).toBeUndefined()
		expect(messages[2].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
		expect(messages[3].providerOptions).toBeUndefined()
		expect(messages[4].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
	})

	it("targets indices 3 and 5 in [user, assistant, tool, user, assistant, tool]", () => {
		const messages: TestMessage[] = [
			{ role: "user" },
			{ role: "assistant" },
			{ role: "tool" },
			{ role: "user" },
			{ role: "assistant" },
			{ role: "tool" },
		]
		applyCacheBreakpoints(messages)
		expect(messages[0].providerOptions).toBeUndefined()
		expect(messages[1].providerOptions).toBeUndefined()
		expect(messages[2].providerOptions).toBeUndefined()
		expect(messages[3].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
		expect(messages[4].providerOptions).toBeUndefined()
		expect(messages[5].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
	})

	it("never targets system messages", () => {
		const messages: TestMessage[] = [{ role: "system" }, { role: "user" }, { role: "assistant" }, { role: "user" }]
		applyCacheBreakpoints(messages)
		expect(messages[0].providerOptions).toBeUndefined()
		expect(messages[1].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
		expect(messages[3].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
	})

	it("never targets assistant messages", () => {
		const messages: TestMessage[] = [
			{ role: "user" },
			{ role: "assistant" },
			{ role: "assistant" },
			{ role: "user" },
		]
		applyCacheBreakpoints(messages)
		expect(messages[1].providerOptions).toBeUndefined()
		expect(messages[2].providerOptions).toBeUndefined()
	})

	it("preserves existing providerOptions via spread", () => {
		const messages: TestMessage[] = [
			{
				role: "user",
				providerOptions: {
					openai: { customField: "keep-me" },
				},
			},
		]
		applyCacheBreakpoints(messages)
		expect(messages[0].providerOptions).toEqual({
			openai: { customField: "keep-me" },
			...UNIVERSAL_CACHE_OPTIONS,
		})
	})

	it("adds anchor breakpoint at ~1/3 with useAnchor and enough messages", () => {
		// 6 non-assistant messages (indices 0-5 in nonAssistantIndices)
		// Anchor at floor(6/3) = index 2 in nonAssistantIndices -> messages index 4
		// Last 2: indices 10 and 8
		const messages: TestMessage[] = [
			{ role: "user" }, // 0 - nonAssistant[0]
			{ role: "assistant" }, // 1
			{ role: "user" }, // 2 - nonAssistant[1]
			{ role: "assistant" }, // 3
			{ role: "user" }, // 4 - nonAssistant[2] <- anchor (floor(6/3)=2)
			{ role: "assistant" }, // 5
			{ role: "user" }, // 6 - nonAssistant[3]
			{ role: "assistant" }, // 7
			{ role: "user" }, // 8 - nonAssistant[4] <- last 2
			{ role: "assistant" }, // 9
			{ role: "user" }, // 10 - nonAssistant[5] <- last 2
		]
		applyCacheBreakpoints(messages, { useAnchor: true })

		// Should have 3 breakpoints: indices 4, 8, 10
		expect(messages[4].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
		expect(messages[8].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
		expect(messages[10].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)

		// Others should NOT have breakpoints
		expect(messages[0].providerOptions).toBeUndefined()
		expect(messages[2].providerOptions).toBeUndefined()
		expect(messages[6].providerOptions).toBeUndefined()
	})

	it("does not add anchor when below anchorThreshold", () => {
		const messages: TestMessage[] = [
			{ role: "user" },
			{ role: "assistant" },
			{ role: "user" },
			{ role: "assistant" },
			{ role: "user" },
		]
		// 3 non-assistant messages, below default threshold of 5
		applyCacheBreakpoints(messages, { useAnchor: true })

		// Last 2 only: indices 2 and 4
		expect(messages[0].providerOptions).toBeUndefined()
		expect(messages[2].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
		expect(messages[4].providerOptions).toEqual(UNIVERSAL_CACHE_OPTIONS)
	})

	it("universal options include both anthropic and bedrock namespaces", () => {
		const messages: TestMessage[] = [{ role: "user" }]
		applyCacheBreakpoints(messages)
		expect(messages[0].providerOptions).toHaveProperty("anthropic")
		expect(messages[0].providerOptions).toHaveProperty("bedrock")
	})
})

describe("applyToolCacheOptions", () => {
	it("should apply cache options only to the last tool to conserve breakpoints", () => {
		const tools: Record<
			string,
			{ providerOptions?: Record<string, Record<string, unknown>>; [key: string]: unknown }
		> = {
			tool1: { description: "test", parameters: {} },
			tool2: { description: "test2", parameters: {}, providerOptions: { existing: { key: "value" } } },
		}
		const cacheOptions = { anthropic: { cacheControl: { type: "ephemeral" } } }
		applyToolCacheOptions(tools, cacheOptions)
		// Only the last tool (tool2) should receive cache options
		expect(tools.tool1.providerOptions).toBeUndefined()
		expect(tools.tool2.providerOptions).toEqual({
			existing: { key: "value" },
			anthropic: { cacheControl: { type: "ephemeral" } },
		})
	})

	it("should handle undefined tools", () => {
		expect(() =>
			applyToolCacheOptions(undefined, { anthropic: { cacheControl: { type: "ephemeral" } } }),
		).not.toThrow()
	})

	it("should handle undefined cacheOptions", () => {
		const tools: Record<
			string,
			{ providerOptions?: Record<string, Record<string, unknown>>; [key: string]: unknown }
		> = {
			tool1: { description: "test", parameters: {} },
		}
		applyToolCacheOptions(tools, undefined)
		expect(tools.tool1.providerOptions).toBeUndefined()
	})

	it("should handle empty tools object", () => {
		const tools: Record<
			string,
			{ providerOptions?: Record<string, Record<string, unknown>>; [key: string]: unknown }
		> = {}
		applyToolCacheOptions(tools, { anthropic: { cacheControl: { type: "ephemeral" } } })
		expect(tools).toEqual({})
	})
})

describe("applySystemPromptCaching", () => {
	it("injects system prompt as cached system message and returns undefined", () => {
		const messages: TestMessage[] = [{ role: "user" }]
		const result = applySystemPromptCaching("You are helpful", messages, UNIVERSAL_CACHE_OPTIONS)
		expect(result).toBeUndefined()
		expect(messages).toHaveLength(2)
		expect(messages[0]).toEqual({
			role: "system",
			content: "You are helpful",
			providerOptions: UNIVERSAL_CACHE_OPTIONS,
		})
	})

	it("returns undefined (no system prompt) when systemPrompt is empty string", () => {
		const messages: TestMessage[] = [{ role: "user" }]
		const result = applySystemPromptCaching("", messages, UNIVERSAL_CACHE_OPTIONS)
		expect(result).toBeUndefined()
		expect(messages).toHaveLength(1) // no message injected
	})

	it("returns undefined when systemPrompt is undefined", () => {
		const messages: TestMessage[] = [{ role: "user" }]
		const result = applySystemPromptCaching(undefined, messages, UNIVERSAL_CACHE_OPTIONS)
		expect(result).toBeUndefined()
		expect(messages).toHaveLength(1) // no message injected
	})

	it("returns systemPrompt unchanged when cacheOptions is undefined", () => {
		const messages: TestMessage[] = [{ role: "user" }]
		const result = applySystemPromptCaching("You are helpful", messages, undefined)
		expect(result).toBe("You are helpful")
		expect(messages).toHaveLength(1) // no message injected
	})

	it("prepends system message before existing messages", () => {
		const messages: TestMessage[] = [{ role: "user" }, { role: "assistant" }, { role: "user" }]
		applySystemPromptCaching("System prompt", messages, UNIVERSAL_CACHE_OPTIONS)
		expect(messages).toHaveLength(4)
		expect(messages[0].role).toBe("system")
		expect(messages[1].role).toBe("user")
	})
})
