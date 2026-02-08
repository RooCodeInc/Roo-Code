// npx vitest run api/providers/__tests__/bedrock-reasoning.spec.ts

// Use vi.hoisted to define mock functions for AI SDK
const { mockStreamText, mockGenerateText, mockCreateAmazonBedrock } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateAmazonBedrock: vi.fn(() => vi.fn(() => ({ modelId: "test", provider: "bedrock" }))),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/amazon-bedrock", () => ({
	createAmazonBedrock: mockCreateAmazonBedrock,
}))

// Mock AWS SDK credential providers
vi.mock("@aws-sdk/credential-providers", () => ({
	fromIni: vi.fn().mockReturnValue(async () => ({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	})),
}))

vi.mock("../../../utils/logging", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

import { AwsBedrockHandler } from "../bedrock"
import { logger } from "../../../utils/logging"

describe("AwsBedrockHandler - Extended Thinking", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Extended Thinking Support", () => {
		it("should include reasoningConfig in providerOptions when reasoning is enabled", async () => {
			const handler = new AwsBedrockHandler({
				apiProvider: "bedrock",
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsRegion: "us-east-1",
				enableReasoningEffort: true,
				modelMaxTokens: 8192,
				modelMaxThinkingTokens: 4096,
			})

			// Mock stream with reasoning content
			async function* mockFullStream() {
				yield { type: "reasoning", text: "Let me think..." }
				yield { type: "reasoning", text: " about this problem." }
				yield { type: "text-delta", text: "Here's the answer:" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
				providerMetadata: Promise.resolve({}),
			})

			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("System prompt", messages)

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify streamText was called with providerOptions containing reasoningConfig
			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions).toBeDefined()
			expect(callArgs.providerOptions.bedrock).toBeDefined()
			expect(callArgs.providerOptions.bedrock.reasoningConfig).toEqual({
				type: "enabled",
				budgetTokens: 4096,
			})

			// Verify reasoning chunks were yielded
			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(2)
			expect(reasoningChunks[0].text).toBe("Let me think...")
			expect(reasoningChunks[1].text).toBe(" about this problem.")
		})

		it("should not include reasoningConfig when reasoning is disabled", async () => {
			const handler = new AwsBedrockHandler({
				apiProvider: "bedrock",
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				awsRegion: "us-east-1",
				// Note: no enableReasoningEffort = true, so thinking is disabled
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Hello world" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
				providerMetadata: Promise.resolve({}),
			})

			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("System prompt", messages)

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify streamText was called — providerOptions should not contain reasoningConfig
			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]
			const bedrockOpts = callArgs.providerOptions?.bedrock
			expect(bedrockOpts?.reasoningConfig).toBeUndefined()
		})

		it("should capture thinking signature from stream providerMetadata", async () => {
			const handler = new AwsBedrockHandler({
				apiProvider: "bedrock",
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsRegion: "us-east-1",
				enableReasoningEffort: true,
				modelMaxThinkingTokens: 4096,
			})

			const testSignature = "test-thinking-signature-abc123"

			// Mock stream with reasoning content that includes a signature in providerMetadata
			async function* mockFullStream() {
				yield { type: "reasoning", text: "Let me think..." }
				// The SDK emits signature as a reasoning-delta with providerMetadata.bedrock.signature
				yield {
					type: "reasoning",
					text: "",
					providerMetadata: { bedrock: { signature: testSignature } },
				}
				yield { type: "text-delta", text: "Answer" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
				providerMetadata: Promise.resolve({}),
			})

			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("System prompt", messages)

			for await (const _chunk of stream) {
				// consume stream
			}

			// Verify thinking signature was captured
			expect(handler.getThoughtSignature()).toBe(testSignature)
		})

		it("should capture redacted thinking blocks from stream providerMetadata", async () => {
			const handler = new AwsBedrockHandler({
				apiProvider: "bedrock",
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsRegion: "us-east-1",
				enableReasoningEffort: true,
				modelMaxThinkingTokens: 4096,
			})

			const redactedData = "base64-encoded-redacted-data"

			// Mock stream with redacted reasoning content
			async function* mockFullStream() {
				yield { type: "reasoning", text: "Some thinking..." }
				yield {
					type: "reasoning",
					text: "",
					providerMetadata: { bedrock: { redactedData } },
				}
				yield { type: "text-delta", text: "Answer" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
				providerMetadata: Promise.resolve({}),
			})

			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("System prompt", messages)

			for await (const _chunk of stream) {
				// consume stream
			}

			// Verify redacted thinking blocks were captured
			const redactedBlocks = handler.getRedactedThinkingBlocks()
			expect(redactedBlocks).toBeDefined()
			expect(redactedBlocks).toHaveLength(1)
			expect(redactedBlocks![0]).toEqual({
				type: "redacted_thinking",
				data: redactedData,
			})
		})

		it("should enable reasoning when enableReasoningEffort is true in settings", async () => {
			const handler = new AwsBedrockHandler({
				apiProvider: "bedrock",
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsRegion: "us-east-1",
				enableReasoningEffort: true,
				modelMaxThinkingTokens: 4096,
			})

			async function* mockFullStream() {
				yield { type: "reasoning", text: "Let me think..." }
				yield { type: "reasoning", text: " about this problem." }
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
				providerMetadata: Promise.resolve({}),
			})

			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("System prompt", messages)

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify thinking was enabled via settings
			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.bedrock?.reasoningConfig).toEqual({
				type: "enabled",
				budgetTokens: 4096,
			})

			// Verify reasoning chunks were yielded
			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(2)
			expect(reasoningChunks[0].text).toBe("Let me think...")
			expect(reasoningChunks[1].text).toBe(" about this problem.")
		})

		it("should support API key authentication via createAmazonBedrock", () => {
			new AwsBedrockHandler({
				apiProvider: "bedrock",
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseApiKey: true,
				awsApiKey: "test-api-key-token",
			})

			// Verify the provider was created with API key
			expect(mockCreateAmazonBedrock).toHaveBeenCalledWith(
				expect.objectContaining({
					region: "us-east-1",
					apiKey: "test-api-key-token",
				}),
			)
		})
	})
})
