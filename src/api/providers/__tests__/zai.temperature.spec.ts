// npx vitest run api/providers/__tests__/zai.temperature.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ModelInfo } from "@roo-code/types"

// Must be mocked before importing the handler.
vi.mock("@roo-code/types", async () => {
	const model: ModelInfo = {
		maxTokens: 1000,
		maxThinkingTokens: null,
		contextWindow: 8000,
		supportsImages: false,
		supportsPromptCache: false,
		defaultTemperature: 0.9,
		supportsReasoningEffort: ["disable", "medium"],
		reasoningEffort: "medium",
		preserveReasoning: true,
	}

	const models = {
		"glm-4.7": model,
	} as const satisfies Record<string, ModelInfo>

	return {
		internationalZAiModels: models,
		mainlandZAiModels: models,
		internationalZAiDefaultModelId: "glm-4.7",
		mainlandZAiDefaultModelId: "glm-4.7",
		ZAI_DEFAULT_TEMPERATURE: 0.5,
		zaiApiLineConfigs: {
			international_coding: { isChina: false, baseUrl: "https://example.invalid/v1" },
			china_coding: { isChina: true, baseUrl: "https://example.invalid/v1" },
		} as const,
	}
})

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

import { ZAiHandler } from "../zai"

describe("ZAiHandler temperature precedence", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("uses model defaultTemperature when modelTemperature is not set", async () => {
		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					async next() {
						return { done: true }
					},
				}),
			}
		})

		const handler = new ZAiHandler({
			apiModelId: "glm-4.7",
			zaiApiKey: "test-key",
			zaiApiLine: "international_coding",
		})

		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "hi" }]
		const stream = handler.createMessage("system", messages)
		await stream.next()

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				temperature: 0.9,
			}),
		)
	})

	it("uses modelTemperature when set", async () => {
		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					async next() {
						return { done: true }
					},
				}),
			}
		})

		const handler = new ZAiHandler({
			apiModelId: "glm-4.7",
			zaiApiKey: "test-key",
			zaiApiLine: "international_coding",
			modelTemperature: 0.1,
		})

		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "hi" }]
		const stream = handler.createMessage("system", messages)
		await stream.next()

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				temperature: 0.1,
			}),
		)
	})
})
