import { Anthropic } from "@anthropic-ai/sdk"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"

import { rooDefaultModelId, rooModels } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"

import { RooHandler } from "../roo"

// Mock CloudService
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn(() => false),
		instance: {
			authService: {
				getSessionToken: vi.fn(() => "test-token"),
			},
			on: vi.fn(),
			off: vi.fn(),
		},
	},
}))

describe("RooHandler", () => {
	let handler: RooHandler

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("createMessage - fix for blank responses", () => {
		it("should yield empty text when only reasoning content is received to prevent blank UI", async () => {
			// This test verifies the fix for issue #8348
			// When models only return reasoning content without text, the UI should not be blank

			// Mock the internal createStream method using spyOn
			handler = new RooHandler({ apiKey: "test-key" })

			// Create a mock stream that only returns reasoning content
			const mockStream = (async function* () {
				yield {
					choices: [
						{
							delta: {
								reasoning_content: "Let me think about this...",
							},
						},
					],
				}
				yield {
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
					},
				}
			})()

			// @ts-expect-error - accessing protected method for testing
			vi.spyOn(handler, "createStream").mockResolvedValue(mockStream as any)

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hi" }]

			const chunks = []
			for await (const chunk of handler.createMessage(systemPrompt, messages)) {
				chunks.push(chunk)
			}

			// Verify the fix: should have reasoning, empty text, and usage chunks
			expect(chunks).toHaveLength(3)
			expect(chunks[0]).toEqual({
				type: "reasoning",
				text: "Let me think about this...",
			})
			// This is the key fix - should yield empty text to prevent blank responses in UI
			expect(chunks[1]).toEqual({
				type: "text",
				text: "",
			})
			expect(chunks[2]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
			})
		})

		it("should not yield empty text when actual text content is received", async () => {
			handler = new RooHandler({ apiKey: "test-key" })

			// Create a mock stream that returns both reasoning and text content
			const mockStream = (async function* () {
				yield {
					choices: [
						{
							delta: {
								reasoning_content: "Let me think...",
							},
						},
					],
				}
				yield {
					choices: [
						{
							delta: {
								content: "Here's my response",
							},
						},
					],
				}
				yield {
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
					},
				}
			})()

			// @ts-expect-error - accessing protected method for testing
			vi.spyOn(handler, "createStream").mockResolvedValue(mockStream as any)

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hi" }]

			const chunks = []
			for await (const chunk of handler.createMessage(systemPrompt, messages)) {
				chunks.push(chunk)
			}

			// Should have reasoning, text, and usage chunks (no empty text needed)
			expect(chunks).toHaveLength(3)
			expect(chunks[0]).toEqual({
				type: "reasoning",
				text: "Let me think...",
			})
			expect(chunks[1]).toEqual({
				type: "text",
				text: "Here's my response",
			})
			expect(chunks[2]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
			})
		})

		it("should handle empty stream gracefully by yielding empty text", async () => {
			handler = new RooHandler({ apiKey: "test-key" })

			// Create a mock stream that only returns usage (no content at all)
			const mockStream = (async function* () {
				yield {
					usage: {
						prompt_tokens: 10,
						completion_tokens: 0,
					},
				}
			})()

			// @ts-expect-error - accessing protected method for testing
			vi.spyOn(handler, "createStream").mockResolvedValue(mockStream as any)

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hi" }]

			const chunks = []
			for await (const chunk of handler.createMessage(systemPrompt, messages)) {
				chunks.push(chunk)
			}

			// Should yield empty text to prevent blank responses
			expect(chunks).toHaveLength(2)
			expect(chunks[0]).toEqual({
				type: "text",
				text: "",
			})
			expect(chunks[1]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 0,
			})
		})
	})

	describe("getModel", () => {
		it("should return default model when no apiModelId is provided", () => {
			handler = new RooHandler({ apiKey: "test-key" })
			const model = handler.getModel()
			expect(model.id).toBe(rooDefaultModelId)
			expect(model.info).toEqual(rooModels[rooDefaultModelId])
		})

		it("should return specified model when valid apiModelId is provided", () => {
			handler = new RooHandler({ apiKey: "test-key", apiModelId: "roo/code-supernova-1-million" })
			const model = handler.getModel()
			expect(model.id).toBe("roo/code-supernova-1-million")
			expect(model.info).toEqual(rooModels["roo/code-supernova-1-million"])
		})

		it("should return fallback info for unknown model", () => {
			handler = new RooHandler({ apiKey: "test-key", apiModelId: "unknown-model" as any })
			const model = handler.getModel()
			expect(model.id).toBe("unknown-model")
			// The fallback info is returned from the default model
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBeDefined()
			expect(model.info.contextWindow).toBeDefined()
		})
	})

	describe("dispose", () => {
		it("should clean up event listeners when CloudService is available", () => {
			const mockOff = vi.fn()
			;(CloudService.hasInstance as any).mockReturnValue(true)
			;(CloudService.instance as any).off = mockOff

			handler = new RooHandler({ apiKey: "test-key" })
			handler.dispose()

			expect(mockOff).toHaveBeenCalledWith("auth-state-changed", expect.any(Function))
		})

		it("should handle dispose when CloudService is not available", () => {
			;(CloudService.hasInstance as any).mockReturnValue(false)

			handler = new RooHandler({ apiKey: "test-key" })
			// Should not throw
			expect(() => handler.dispose()).not.toThrow()
		})
	})
})
