// npx vitest run api/providers/__tests__/base-openai-compatible-reasoning-only.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ModelInfo } from "@roo-code/types"

import { BaseOpenAiCompatibleProvider } from "../base-openai-compatible-provider"

// Create mock functions
const mockCreate = vi.fn()

// Mock OpenAI module
vi.mock("openai", () => ({
	default: vi.fn(() => ({
		chat: {
			completions: {
				create: mockCreate,
			},
		},
	})),
}))

// Create a concrete test implementation of the abstract base class
class TestOpenAiCompatibleProvider extends BaseOpenAiCompatibleProvider<"test-model"> {
	constructor(apiKey: string) {
		const testModels: Record<"test-model", ModelInfo> = {
			"test-model": {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0.5,
				outputPrice: 1.5,
			},
		}

		super({
			providerName: "TestProvider",
			baseURL: "https://test.example.com/v1",
			defaultProviderModelId: "test-model",
			providerModels: testModels,
			apiKey,
		})
	}
}

describe("BaseOpenAiCompatibleProvider - Reasoning Only Responses", () => {
	let handler: TestOpenAiCompatibleProvider

	beforeEach(() => {
		vi.clearAllMocks()
		handler = new TestOpenAiCompatibleProvider("test-api-key")
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Reasoning-only responses (Issue #9959)", () => {
		it("should handle responses with only reasoning content in <think> tags", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						next: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [
										{
											delta: {
												content:
													"<think>I need to analyze this problem carefully. The user is asking about weather, so I should provide weather information.</think>",
											},
										},
									],
								},
							})
							.mockResolvedValueOnce({ done: true }),
					}),
				}
			})

			const stream = handler.createMessage("system prompt", [])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should yield reasoning chunks
			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({
				type: "reasoning",
				text: "I need to analyze this problem carefully. The user is asking about weather, so I should provide weather information.",
			})
		})

		it("should handle responses with only reasoning_content field", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						next: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [
										{
											delta: {
												reasoning_content: "Let me think about this step by step...",
											},
										},
									],
								},
							})
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [
										{
											delta: {
												reasoning_content: "First, I need to understand the context.",
											},
										},
									],
								},
							})
							.mockResolvedValueOnce({ done: true }),
					}),
				}
			})

			const stream = handler.createMessage("system prompt", [])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should yield reasoning chunks
			expect(chunks).toEqual([
				{ type: "reasoning", text: "Let me think about this step by step..." },
				{ type: "reasoning", text: "First, I need to understand the context." },
			])
		})

		it("should handle responses with reasoning field (alternative field name)", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						next: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [
										{
											delta: {
												reasoning: "Analyzing the request...",
											},
										},
									],
								},
							})
							.mockResolvedValueOnce({ done: true }),
					}),
				}
			})

			const stream = handler.createMessage("system prompt", [])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should yield reasoning chunk
			expect(chunks).toEqual([{ type: "reasoning", text: "Analyzing the request..." }])
		})

		it("should handle mixed content with reasoning in <think> tags followed by regular text", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						next: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [
										{
											delta: {
												content: "<think>Let me process this request</think>",
											},
										},
									],
								},
							})
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [
										{
											delta: {
												content: "Here is the answer to your question.",
											},
										},
									],
								},
							})
							.mockResolvedValueOnce({ done: true }),
					}),
				}
			})

			const stream = handler.createMessage("system prompt", [])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should yield both reasoning and text chunks
			expect(chunks).toEqual([
				{ type: "reasoning", text: "Let me process this request" },
				{ type: "text", text: "Here is the answer to your question." },
			])
		})

		it("should handle tool calls embedded in thinking content", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						next: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [
										{
											delta: {
												content:
													'<think>I need to use a tool here\n\n<use_tool>\n<tool_name>read_file</tool_name>\n<parameters>\n{"path": "test.txt"}\n</parameters>\n</use_tool></think>',
											},
										},
									],
								},
							})
							.mockResolvedValueOnce({ done: true }),
					}),
				}
			})

			const stream = handler.createMessage("system prompt", [])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// The XmlMatcher should process the thinking content
			// For now it will just extract the reasoning text
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some((c) => c.type === "reasoning")).toBe(true)
		})

		it("should handle empty reasoning_content (whitespace only)", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						next: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [
										{
											delta: {
												reasoning_content: "   \n\t  ",
											},
										},
									],
								},
							})
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [
										{
											delta: {
												content: "Actual response text",
											},
										},
									],
								},
							})
							.mockResolvedValueOnce({ done: true }),
					}),
				}
			})

			const stream = handler.createMessage("system prompt", [])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should filter out whitespace-only reasoning and only return the text
			expect(chunks).toEqual([{ type: "text", text: "Actual response text" }])
		})
	})
})
