// npx vitest run src/api/providers/__tests__/bedrock-usage-metrics.spec.ts

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: vi.fn(),
		},
	},
}))

vi.mock("@aws-sdk/credential-providers", () => ({
	fromIni: vi.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	}),
}))

const { mockStreamText, mockGenerateText } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
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
	createAmazonBedrock: vi.fn(() => vi.fn(() => ({ modelId: "test", provider: "bedrock" }))),
}))

import { AwsBedrockHandler } from "../bedrock"

describe("AwsBedrockHandler usage metrics", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	function createHandler() {
		return new AwsBedrockHandler({
			apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
		})
	}

	async function collectChunks(stream: AsyncGenerator<any>) {
		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}
		return chunks
	}

	it("emits inputTokens as total (not noCacheTokens) when cache details are present", async () => {
		async function* mockFullStream() {
			yield { type: "text-delta", text: "Hello" }
		}

		mockStreamText.mockReturnValue({
			fullStream: mockFullStream(),
			usage: Promise.resolve({
				inputTokens: 13_071,
				outputTokens: 93,
				inputTokenDetails: {
					noCacheTokens: 10,
					cacheWriteTokens: 489,
					cacheReadTokens: 12_572,
				},
			}),
			providerMetadata: Promise.resolve({}),
		})

		const handler = createHandler()
		const chunks = await collectChunks(
			handler.createMessage("You are a helpful assistant.", [{ role: "user", content: "Hello" }]),
		)

		const usageChunk = chunks.find((c) => c.type === "usage")
		expect(usageChunk).toBeDefined()

		// inputTokens must be the total (13,071), not noCacheTokens (10).
		// This aligns with the ApiStreamUsageChunk contract:
		// "inputTokens: Total input tokens (cached + non-cached)."
		expect(usageChunk.inputTokens).toBe(13_071)
		expect(usageChunk.nonCachedInputTokens).toBe(10)
		expect(usageChunk.outputTokens).toBe(93)
		expect(usageChunk.cacheWriteTokens).toBe(489)
		expect(usageChunk.cacheReadTokens).toBe(12_572)
	})

	it("emits inputTokens as total when cache metrics come from providerMetadata.bedrock.usage", async () => {
		async function* mockFullStream() {
			yield { type: "text-delta", text: "Hello" }
		}

		mockStreamText.mockReturnValue({
			fullStream: mockFullStream(),
			usage: Promise.resolve({
				inputTokens: 500,
				outputTokens: 50,
			}),
			providerMetadata: Promise.resolve({
				bedrock: {
					usage: {
						cacheReadInputTokens: 300,
						cacheWriteInputTokens: 100,
					},
				},
			}),
		})

		const handler = createHandler()
		const chunks = await collectChunks(
			handler.createMessage("You are a helpful assistant.", [{ role: "user", content: "Hello" }]),
		)

		const usageChunk = chunks.find((c) => c.type === "usage")
		expect(usageChunk).toBeDefined()
		expect(usageChunk.inputTokens).toBe(500)
		expect(usageChunk.outputTokens).toBe(50)
		expect(usageChunk.cacheReadTokens).toBe(300)
		expect(usageChunk.cacheWriteTokens).toBe(100)
		// Non-cached should be derived: 500 - 300 - 100 = 100
		expect(usageChunk.nonCachedInputTokens).toBe(100)
	})

	it("handles basic usage without cache details", async () => {
		async function* mockFullStream() {
			yield { type: "text-delta", text: "Hello" }
		}

		mockStreamText.mockReturnValue({
			fullStream: mockFullStream(),
			usage: Promise.resolve({
				inputTokens: 100,
				outputTokens: 50,
			}),
			providerMetadata: Promise.resolve({}),
		})

		const handler = createHandler()
		const chunks = await collectChunks(
			handler.createMessage("You are a helpful assistant.", [{ role: "user", content: "Hello" }]),
		)

		const usageChunk = chunks.find((c) => c.type === "usage")
		expect(usageChunk).toBeDefined()
		expect(usageChunk.inputTokens).toBe(100)
		expect(usageChunk.outputTokens).toBe(50)
	})

	it("calculates cost correctly with cache tokens using total inputTokens", async () => {
		async function* mockFullStream() {
			yield { type: "text-delta", text: "Hello" }
		}

		mockStreamText.mockReturnValue({
			fullStream: mockFullStream(),
			usage: Promise.resolve({
				inputTokens: 13_071,
				outputTokens: 93,
				inputTokenDetails: {
					noCacheTokens: 10,
					cacheWriteTokens: 489,
					cacheReadTokens: 12_572,
				},
			}),
			providerMetadata: Promise.resolve({}),
		})

		const handler = createHandler()
		const chunks = await collectChunks(
			handler.createMessage("You are a helpful assistant.", [{ role: "user", content: "Hello" }]),
		)

		const usageChunk = chunks.find((c) => c.type === "usage")
		expect(usageChunk).toBeDefined()
		// totalCost should be > 0 since we have token usage
		expect(usageChunk.totalCost).toBeGreaterThan(0)
	})
})
