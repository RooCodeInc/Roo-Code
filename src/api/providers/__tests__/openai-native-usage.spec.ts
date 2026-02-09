// npx vitest run api/providers/__tests__/openai-native-usage.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText, mockCreateOpenAI } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateOpenAI: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: mockCreateOpenAI.mockImplementation(() => ({
		responses: vi.fn(() => ({
			modelId: "gpt-4o",
			provider: "openai.responses",
		})),
	})),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: vi.fn(),
		},
	},
}))

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { openAiNativeModels } from "@roo-code/types"

import { OpenAiNativeHandler } from "../openai-native"

// Helper: create a mock fullStream generator
function createMockFullStream(parts: Array<{ type: string; text?: string }> = [{ type: "text-delta", text: "ok" }]) {
	return async function* () {
		for (const part of parts) {
			yield part
		}
	}
}

// Helper: mock streamText return with full options
function mockStreamTextWithUsage(
	usage: Record<string, any>,
	providerMetadata: Record<string, any> = {},
	response: any = { messages: [] },
) {
	mockStreamText.mockReturnValue({
		fullStream: createMockFullStream()(),
		usage: Promise.resolve(usage),
		providerMetadata: Promise.resolve(providerMetadata),
		response: Promise.resolve(response),
	})
}

const systemPrompt = "You are a helpful assistant."
const messages: NeutralMessageParam[] = [{ role: "user", content: "Hello!" }]

describe("OpenAiNativeHandler - usage processing via createMessage", () => {
	let handler: OpenAiNativeHandler

	beforeEach(() => {
		handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		})
		vi.clearAllMocks()
	})

	describe("basic usage metrics", () => {
		it("should emit usage chunk with input and output tokens", async () => {
			mockStreamTextWithUsage({ inputTokens: 100, outputTokens: 50 })

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
			})
		})

		it("should handle zero tokens", async () => {
			mockStreamTextWithUsage({ inputTokens: 0, outputTokens: 0 })

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 0,
				outputTokens: 0,
			})
		})

		it("should handle undefined token fields gracefully", async () => {
			mockStreamTextWithUsage({})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 0,
				outputTokens: 0,
			})
		})
	})

	describe("cache token metrics", () => {
		it("should include cached input tokens from usage details", async () => {
			mockStreamTextWithUsage({
				inputTokens: 100,
				outputTokens: 50,
				details: {
					cachedInputTokens: 30,
				},
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.cacheReadTokens).toBe(30)
		})

		it("should include cached input tokens from provider metadata as fallback", async () => {
			mockStreamTextWithUsage({ inputTokens: 100, outputTokens: 50 }, { openai: { cachedInputTokens: 25 } })

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.cacheReadTokens).toBe(25)
		})

		it("should include cache creation tokens from provider metadata", async () => {
			mockStreamTextWithUsage(
				{ inputTokens: 100, outputTokens: 50 },
				{ openai: { cacheCreationInputTokens: 20 } },
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.cacheWriteTokens).toBe(20)
		})

		it("should include both cache read and write tokens", async () => {
			mockStreamTextWithUsage(
				{
					inputTokens: 100,
					outputTokens: 50,
					details: { cachedInputTokens: 30 },
				},
				{ openai: { cacheCreationInputTokens: 20 } },
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.cacheReadTokens).toBe(30)
			expect(usageChunk.cacheWriteTokens).toBe(20)
		})

		it("should handle no cache information", async () => {
			mockStreamTextWithUsage({
				inputTokens: 100,
				outputTokens: 50,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			// cacheReadTokens and cacheWriteTokens should be undefined when 0
			expect(usageChunk.cacheReadTokens).toBeUndefined()
			expect(usageChunk.cacheWriteTokens).toBeUndefined()
		})
	})

	describe("reasoning tokens", () => {
		it("should include reasoning tokens from usage details", async () => {
			mockStreamTextWithUsage({
				inputTokens: 100,
				outputTokens: 150,
				details: {
					reasoningTokens: 50,
				},
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.reasoningTokens).toBe(50)
		})

		it("should omit reasoning tokens when not present", async () => {
			mockStreamTextWithUsage({
				inputTokens: 100,
				outputTokens: 50,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.reasoningTokens).toBeUndefined()
		})
	})

	describe("cost calculation", () => {
		it("should calculate cost for gpt-4o", async () => {
			mockStreamTextWithUsage({
				inputTokens: 100,
				outputTokens: 50,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.totalCost).toBeGreaterThan(0)

			// gpt-4o pricing: input $2.5/M, output $10/M
			const expectedCost = (100 / 1_000_000) * 2.5 + (50 / 1_000_000) * 10
			expect(usageChunk.totalCost).toBeCloseTo(expectedCost, 10)
		})

		it("should calculate cost with cache tokens for gpt-4o", async () => {
			mockStreamTextWithUsage(
				{
					inputTokens: 100,
					outputTokens: 50,
					details: { cachedInputTokens: 30 },
				},
				{ openai: { cacheCreationInputTokens: 20 } },
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.totalCost).toBeGreaterThan(0)
		})

		it("should calculate cost for gpt-5.1", async () => {
			const gpt51Handler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: "gpt-5.1",
			})

			mockStreamTextWithUsage({
				inputTokens: 100,
				outputTokens: 50,
			})

			const stream = gpt51Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()

			// gpt-5.1 pricing: input $1.25/M, output $10/M
			const expectedCost = (100 / 1_000_000) * 1.25 + (50 / 1_000_000) * 10
			expect(usageChunk.totalCost).toBeCloseTo(expectedCost, 10)
		})

		it("should calculate cost for codex-mini-latest", async () => {
			const codexHandler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: "codex-mini-latest",
			})

			mockStreamTextWithUsage({
				inputTokens: 50,
				outputTokens: 10,
			})

			const stream = codexHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()

			// codex-mini-latest pricing: input $1.5/M, output $6/M
			const expectedCost = (50 / 1_000_000) * 1.5 + (10 / 1_000_000) * 6
			expect(usageChunk.totalCost).toBeCloseTo(expectedCost, 10)
		})

		it("should handle cost calculation with no cache reads", async () => {
			mockStreamTextWithUsage({
				inputTokens: 100,
				outputTokens: 50,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.totalCost).toBeGreaterThan(0)
		})
	})

	describe("service tier pricing", () => {
		it("should apply priority tier pricing when service tier is returned", async () => {
			const gpt4oHandler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: "gpt-4o",
				openAiNativeServiceTier: "priority",
			})

			mockStreamTextWithUsage({ inputTokens: 100, outputTokens: 50 }, { openai: { serviceTier: "priority" } })

			const stream = gpt4oHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()

			// Priority tier for gpt-4o: input $4.25/M, output $17/M
			const expectedCost = (100 / 1_000_000) * 4.25 + (50 / 1_000_000) * 17.0
			expect(usageChunk.totalCost).toBeCloseTo(expectedCost, 10)
		})

		it("should use default pricing when service tier is 'default'", async () => {
			const gpt4oHandler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: "gpt-4o",
				openAiNativeServiceTier: "default",
			})

			mockStreamTextWithUsage({ inputTokens: 100, outputTokens: 50 }, { openai: { serviceTier: "default" } })

			const stream = gpt4oHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()

			// Default tier for gpt-4o: input $2.5/M, output $10/M
			const expectedCost = (100 / 1_000_000) * 2.5 + (50 / 1_000_000) * 10
			expect(usageChunk.totalCost).toBeCloseTo(expectedCost, 10)
		})

		it("should apply flex tier pricing for gpt-5.1", async () => {
			const gpt51Handler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: "gpt-5.1",
				openAiNativeServiceTier: "flex",
			})

			mockStreamTextWithUsage({ inputTokens: 1000, outputTokens: 500 }, { openai: { serviceTier: "flex" } })

			const stream = gpt51Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()

			// Flex tier for gpt-5.1: input $0.625/M, output $5/M
			const expectedCost = (1000 / 1_000_000) * 0.625 + (500 / 1_000_000) * 5.0
			expect(usageChunk.totalCost).toBeCloseTo(expectedCost, 10)
		})

		it("should pass service tier in providerOptions for models with tiers", async () => {
			const gpt4oHandler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: "gpt-4o",
				openAiNativeServiceTier: "priority",
			})

			mockStreamTextWithUsage({ inputTokens: 10, outputTokens: 5 })

			const stream = gpt4oHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.serviceTier).toBe("priority")
		})

		it("should not pass invalid service tier in providerOptions", async () => {
			const gpt4oHandler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: "gpt-4o",
				openAiNativeServiceTier: "nonexistent_tier" as any,
			})

			mockStreamTextWithUsage({ inputTokens: 10, outputTokens: 5 })

			const stream = gpt4oHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.serviceTier).toBeUndefined()
		})
	})
})

describe("OpenAiNativeHandler - prompt cache retention via providerOptions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should set promptCacheRetention=24h for gpt-5.1 models that support prompt caching", async () => {
		const modelIds = ["gpt-5.1", "gpt-5.1-codex", "gpt-5.1-codex-mini"]

		for (const modelId of modelIds) {
			vi.clearAllMocks()

			const handler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: modelId,
			})

			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta", text: "ok" }
				})(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.promptCacheRetention).toBe("24h")
		}
	})

	it("should not set promptCacheRetention for non-gpt-5.1 models even if they support prompt caching", async () => {
		const modelIds = ["gpt-5", "gpt-4o"]

		for (const modelId of modelIds) {
			vi.clearAllMocks()

			const handler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: modelId,
			})

			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta", text: "ok" }
				})(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.promptCacheRetention).toBeUndefined()
		}
	})

	it("should not set promptCacheRetention when the model does not support prompt caching", async () => {
		const modelId = "codex-mini-latest"
		expect(openAiNativeModels[modelId as keyof typeof openAiNativeModels].supportsPromptCache).toBe(false)

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: modelId,
		})

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "ok" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

		const stream = handler.createMessage(systemPrompt, messages)
		for await (const _chunk of stream) {
			// consume stream
		}

		const callArgs = mockStreamText.mock.calls[0][0]
		expect(callArgs.providerOptions?.openai?.promptCacheRetention).toBeUndefined()
	})
})

describe("OpenAiNativeHandler - buildProviderOptions via streamText args", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should always include store: false", async () => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		})

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "ok" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

		const stream = handler.createMessage(systemPrompt, messages)
		for await (const _chunk of stream) {
			// consume stream
		}

		const callArgs = mockStreamText.mock.calls[0][0]
		expect(callArgs.providerOptions?.openai?.store).toBe(false)
	})

	it("should default parallelToolCalls to true", async () => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		})

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "ok" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

		const stream = handler.createMessage(systemPrompt, messages)
		for await (const _chunk of stream) {
			// consume stream
		}

		const callArgs = mockStreamText.mock.calls[0][0]
		expect(callArgs.providerOptions?.openai?.parallelToolCalls).toBe(true)
	})

	it("should respect parallelToolCalls from metadata", async () => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		})

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "ok" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

		const stream = handler.createMessage(systemPrompt, messages, {
			taskId: "test",
			parallelToolCalls: false,
		})
		for await (const _chunk of stream) {
			// consume stream
		}

		const callArgs = mockStreamText.mock.calls[0][0]
		expect(callArgs.providerOptions?.openai?.parallelToolCalls).toBe(false)
	})

	it("should set reasoningEffort and related fields for models with reasoning support", async () => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "o3",
		})

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "ok" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

		const stream = handler.createMessage(systemPrompt, messages)
		for await (const _chunk of stream) {
			// consume stream
		}

		const callArgs = mockStreamText.mock.calls[0][0]
		const openaiOpts = callArgs.providerOptions?.openai

		// o3 has reasoningEffort: "medium" by default
		expect(openaiOpts?.reasoningEffort).toBe("medium")
		expect(openaiOpts?.include).toEqual(["reasoning.encrypted_content"])
		expect(openaiOpts?.reasoningSummary).toBe("auto")
	})

	it("should not set reasoning fields for models without reasoning support", async () => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4.1",
		})

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "ok" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

		const stream = handler.createMessage(systemPrompt, messages)
		for await (const _chunk of stream) {
			// consume stream
		}

		const callArgs = mockStreamText.mock.calls[0][0]
		const openaiOpts = callArgs.providerOptions?.openai

		expect(openaiOpts?.reasoningEffort).toBeUndefined()
		expect(openaiOpts?.include).toBeUndefined()
		expect(openaiOpts?.reasoningSummary).toBeUndefined()
	})
})
