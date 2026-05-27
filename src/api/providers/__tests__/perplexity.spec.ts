// npx vitest run api/providers/__tests__/perplexity.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type PerplexityModelId, perplexityDefaultModelId, perplexityModels } from "@roo-code/types"

import { Package } from "../../../shared/package"
import { PerplexityHandler, resolvePerplexityApiKey } from "../perplexity"

const mockCreate = vi.fn()

vi.mock("openai", () => ({
	default: vi.fn(() => ({
		chat: {
			completions: {
				create: mockCreate,
			},
		},
	})),
}))

describe("PerplexityHandler", () => {
	let handler: PerplexityHandler
	const originalEnv = { ...process.env }

	beforeEach(() => {
		vi.clearAllMocks()
		mockCreate.mockImplementation(async () => ({
			[Symbol.asyncIterator]: async function* () {
				yield {
					choices: [{ delta: { content: "Test response" }, index: 0 }],
					usage: null,
				}
				yield {
					choices: [{ delta: {}, index: 0 }],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				}
			},
		}))
		handler = new PerplexityHandler({ perplexityApiKey: "test-key" })
	})

	afterEach(() => {
		vi.restoreAllMocks()
		process.env = { ...originalEnv }
	})

	it("should use the correct Perplexity base URL", () => {
		new PerplexityHandler({ perplexityApiKey: "test-perplexity-api-key" })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://api.perplexity.ai" }))
	})

	it("should use the provided API key from settings", () => {
		const perplexityApiKey = "test-perplexity-api-key"
		new PerplexityHandler({ perplexityApiKey })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: perplexityApiKey }))
	})

	it("should set the Perplexity integration attribution header", () => {
		new PerplexityHandler({ perplexityApiKey: "test-perplexity-api-key" })
		const defaultHeaders = vi.mocked(OpenAI).mock.calls.at(-1)?.[0]?.defaultHeaders as
			| Record<string, string>
			| undefined

		expect(defaultHeaders).toEqual(
			expect.objectContaining({
				"X-Pplx-Integration": `roo-code/${Package.version}`,
			}),
		)
		expect(defaultHeaders?.["X-Pplx-Integration"]).toMatch(/^roo-code\//)
	})

	it("should fall back to PERPLEXITY_API_KEY env var when no settings key is provided", () => {
		delete process.env.PPLX_API_KEY
		process.env.PERPLEXITY_API_KEY = "env-perplexity-key"
		new PerplexityHandler({})
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "env-perplexity-key" }))
	})

	it("should fall back to PPLX_API_KEY env var as a secondary fallback", () => {
		delete process.env.PERPLEXITY_API_KEY
		process.env.PPLX_API_KEY = "pplx-fallback-key"
		new PerplexityHandler({})
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "pplx-fallback-key" }))
	})

	it("should fall back to PPLX_API_KEY when PERPLEXITY_API_KEY is empty", () => {
		process.env.PERPLEXITY_API_KEY = ""
		process.env.PPLX_API_KEY = "pplx-fallback-key"
		new PerplexityHandler({})
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "pplx-fallback-key" }))
	})

	it("should prefer explicit settings API key over env vars", () => {
		process.env.PERPLEXITY_API_KEY = "env-key"
		process.env.PPLX_API_KEY = "pplx-key"
		new PerplexityHandler({ perplexityApiKey: "explicit-key" })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "explicit-key" }))
	})

	it("should throw when no API key is configured (settings or env vars)", () => {
		delete process.env.PERPLEXITY_API_KEY
		delete process.env.PPLX_API_KEY
		expect(() => new PerplexityHandler({})).toThrow("API key is required")
	})

	it("resolvePerplexityApiKey should return undefined when nothing is set", () => {
		delete process.env.PERPLEXITY_API_KEY
		delete process.env.PPLX_API_KEY
		expect(resolvePerplexityApiKey()).toBeUndefined()
		expect(resolvePerplexityApiKey("")).toBeUndefined()
	})

	it("should return default sonar-pro model when no model is specified", () => {
		const model = handler.getModel()
		expect(model.id).toBe(perplexityDefaultModelId)
		expect(model.id).toBe("sonar-pro")
		expect(model.info).toEqual(expect.objectContaining(perplexityModels[perplexityDefaultModelId]))
	})

	it("should return sonar-reasoning-pro model when configured", () => {
		const testModelId: PerplexityModelId = "sonar-reasoning-pro"
		const handlerWithModel = new PerplexityHandler({
			apiModelId: testModelId,
			perplexityApiKey: "test-key",
		})
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(
			expect.objectContaining({
				maxTokens: 8192,
				contextWindow: 128_000,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 2.0,
				outputPrice: 8.0,
			}),
		)
	})

	it("should fall back to default model when an unknown model id is provided", () => {
		const handlerWithModel = new PerplexityHandler({
			apiModelId: "not-a-real-model",
			perplexityApiKey: "test-key",
		})
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(perplexityDefaultModelId)
	})

	it("should expose all four Sonar models with 128k context", () => {
		const expectedIds: PerplexityModelId[] = ["sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro"]
		for (const id of expectedIds) {
			expect(perplexityModels[id]).toBeDefined()
			expect(perplexityModels[id].contextWindow).toBe(128_000)
		}
	})

	it("createMessage should yield text content from stream", async () => {
		const testContent = "Streamed content from Perplexity"
		mockCreate.mockImplementationOnce(() => ({
			[Symbol.asyncIterator]: () => ({
				next: vi
					.fn()
					.mockResolvedValueOnce({
						done: false,
						value: { choices: [{ delta: { content: testContent } }] },
					})
					.mockResolvedValueOnce({ done: true }),
			}),
		}))

		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()
		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual({ type: "text", text: testContent })
	})

	it("createMessage should pass the configured model id to the upstream client", async () => {
		const modelId: PerplexityModelId = "sonar-reasoning"
		const handlerWithModel = new PerplexityHandler({
			apiModelId: modelId,
			perplexityApiKey: "test-key",
		})

		mockCreate.mockImplementationOnce(() => ({
			[Symbol.asyncIterator]: () => ({
				async next() {
					return { done: true }
				},
			}),
		}))

		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "hi" }]
		const generator = handlerWithModel.createMessage("system", messages)
		await generator.next()

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: modelId,
				stream: true,
				stream_options: { include_usage: true },
				messages: expect.arrayContaining([{ role: "system", content: "system" }]),
			}),
			undefined,
		)
	})

	it.each(["sonar-reasoning", "sonar-reasoning-pro"] as const)(
		"createMessage should omit temperature for %s",
		async (modelId) => {
			const handlerWithModel = new PerplexityHandler({
				apiModelId: modelId,
				perplexityApiKey: "test-key",
			})

			mockCreate.mockImplementationOnce(() => ({
				[Symbol.asyncIterator]: () => ({
					async next() {
						return { done: true }
					},
				}),
			}))

			const generator = handlerWithModel.createMessage("system", [{ role: "user", content: "hi" }])
			await generator.next()

			const lastCall = mockCreate.mock.calls[mockCreate.mock.calls.length - 1]
			expect(lastCall[0]).not.toHaveProperty("temperature")
		},
	)

	it("createMessage should propagate upstream errors", async () => {
		mockCreate.mockImplementationOnce(() => {
			throw new Error("upstream 401")
		})

		const generator = handler.createMessage("system", [{ role: "user", content: "hi" }])
		await expect(generator.next()).rejects.toThrow(/upstream 401/)
	})
})
