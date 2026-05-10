// npx vitest run src/api/providers/__tests__/openai-compatible.spec.ts

const { mockStreamText, mockGenerateText, mockCreateOpenAICompatible } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateOpenAICompatible: vi.fn(),
}))

let capturedProviderConfig: any

vi.mock("ai", () => ({
	streamText: mockStreamText,
	generateText: mockGenerateText,
}))

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: mockCreateOpenAICompatible,
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo, ReasoningEffortExtended } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import type { OpenAICompatibleConfig } from "../openai-compatible"
import { OpenAICompatibleHandler } from "../openai-compatible"

const testModelInfo: ModelInfo = {
	maxTokens: 4096,
	contextWindow: 128000,
	supportsImages: false,
	supportsPromptCache: false,
	inputPrice: 0.5,
	outputPrice: 1.5,
	supportsReasoningEffort: ["low", "medium", "high", "xhigh"],
}

class TestOpenAICompatibleHandler extends OpenAICompatibleHandler {
	private resolvedReasoningEffort: ReasoningEffortExtended | undefined

	constructor(options: ApiHandlerOptions, reasoningEffort?: ReasoningEffortExtended) {
		const config: OpenAICompatibleConfig = {
			providerName: "test-provider",
			baseURL: "https://test.example.com/v1",
			apiKey: "test-api-key",
			modelId: "test-model",
			modelInfo: testModelInfo,
			temperature: 0,
		}

		super(options, config)
		this.resolvedReasoningEffort = reasoningEffort
	}

	override getModel() {
		return {
			id: "test-model",
			info: testModelInfo,
			maxTokens: 2048,
			temperature: 0,
			reasoningEffort: this.resolvedReasoningEffort,
		}
	}
}

const systemPrompt = "You are helpful."
const messages: Anthropic.Messages.MessageParam[] = [
	{
		role: "user",
		content: [
			{
				type: "text",
				text: "Hello",
			},
		],
	},
]

function buildEmptyStreamResult() {
	return {
		fullStream: (async function* () {
			// drain
		})(),
		usage: Promise.resolve(undefined),
	}
}

describe("OpenAICompatibleHandler reasoning payload", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		capturedProviderConfig = undefined
		mockCreateOpenAICompatible.mockImplementation((config: any) => {
			capturedProviderConfig = config
			return vi.fn((modelId: string) => ({
				modelId,
				provider: "test-provider",
			}))
		})
		mockStreamText.mockReturnValue(buildEmptyStreamResult())
		mockGenerateText.mockResolvedValue({ text: "done" })
	})

	it("reasoning payload createMessage passes providerOptions and transform adds both fields", async () => {
		const handler = new TestOpenAICompatibleHandler({ apiModelId: "test-model" } as ApiHandlerOptions, "high")

		for await (const _chunk of handler.createMessage(systemPrompt, messages)) {
			// drain
		}

		expect(mockStreamText).toHaveBeenCalledWith(
			expect.objectContaining({
				providerOptions: {
					openaiCompatible: {
						reasoningEffort: "high",
					},
				},
			}),
		)

		const transformed = capturedProviderConfig.transformRequestBody({
			model: "test-model",
			reasoning_effort: "high",
			messages: [],
		})

		expect(transformed).toEqual(
			expect.objectContaining({
				reasoning_effort: "high",
				reasoning: {
					effort: "high",
					summary: "auto",
				},
			}),
		)
	})

	it("reasoning payload completePrompt preserves xhigh in providerOptions and transform", async () => {
		const handler = new TestOpenAICompatibleHandler({ apiModelId: "test-model" } as ApiHandlerOptions, "xhigh")

		await handler.completePrompt("Hello")

		expect(mockGenerateText).toHaveBeenCalledWith(
			expect.objectContaining({
				providerOptions: {
					openaiCompatible: {
						reasoningEffort: "xhigh",
					},
				},
			}),
		)

		const transformed = capturedProviderConfig.transformRequestBody({
			model: "test-model",
			reasoning_effort: "xhigh",
			prompt: "Hello",
		})

		expect(transformed).toEqual(
			expect.objectContaining({
				reasoning_effort: "xhigh",
				reasoning: {
					effort: "xhigh",
					summary: "auto",
				},
			}),
		)
	})

	it("reasoning payload omits providerOptions and leaves body unchanged when reasoning disabled", async () => {
		const handler = new TestOpenAICompatibleHandler({ apiModelId: "test-model" } as ApiHandlerOptions)

		for await (const _chunk of handler.createMessage(systemPrompt, messages)) {
			// drain
		}

		const callArgs = mockStreamText.mock.calls[0][0]
		expect(callArgs.providerOptions).toBeUndefined()

		const inputBody = {
			model: "test-model",
			messages: [],
		}
		const transformed = capturedProviderConfig.transformRequestBody(inputBody)
		expect(transformed).toEqual(inputBody)
		expect(transformed.reasoning_effort).toBeUndefined()
		expect(transformed.reasoning).toBeUndefined()
	})

	it("reasoning payload overwrites effort and summary but keeps existing reasoning keys", () => {
		new TestOpenAICompatibleHandler({ apiModelId: "test-model" } as ApiHandlerOptions, "high")

		const transformed = capturedProviderConfig.transformRequestBody({
			model: "test-model",
			reasoning_effort: "high",
			reasoning: {
				foo: "bar",
				effort: "low",
				summary: "manual",
			},
			messages: [],
		})

		expect(transformed).toEqual(
			expect.objectContaining({
				reasoning_effort: "high",
				reasoning: {
					foo: "bar",
					effort: "high",
					summary: "auto",
				},
				messages: [],
			}),
		)
	})
})
