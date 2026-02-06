// npx vitest run src/api/providers/__tests__/bedrock-invokedModelId.spec.ts

// Mock TelemetryService before other imports
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: vi.fn(),
		},
	},
}))

// Mock AWS SDK credential providers
vi.mock("@aws-sdk/credential-providers", () => ({
	fromIni: vi.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	}),
}))

// Use vi.hoisted to define mock functions for AI SDK
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
import { bedrockModels } from "@roo-code/types"

describe("AwsBedrockHandler with invokedModelId", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	/**
	 * Helper: set up mockStreamText to return a stream whose resolved
	 * `providerMetadata` contains the given `invokedModelId` in the
	 * `bedrock.trace.promptRouter` path.
	 */
	function setupMockStreamWithInvokedModelId(invokedModelId?: string) {
		async function* mockFullStream() {
			yield { type: "text-delta", text: "Hello" }
			yield { type: "text-delta", text: ", world!" }
		}

		const providerMetadata = invokedModelId
			? {
					bedrock: {
						trace: {
							promptRouter: {
								invokedModelId,
							},
						},
					},
				}
			: {}

		mockStreamText.mockReturnValue({
			fullStream: mockFullStream(),
			usage: Promise.resolve({ inputTokens: 100, outputTokens: 200 }),
			providerMetadata: Promise.resolve(providerMetadata),
		})
	}

	it("should update costModelConfig when invokedModelId is present in providerMetadata", async () => {
		// Create a handler with a custom ARN (prompt router)
		const handler = new AwsBedrockHandler({
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
			awsCustomArn: "arn:aws:bedrock:us-west-2:123456789:default-prompt-router/anthropic.claude:1",
		})

		// The default prompt router model should use sonnet pricing (inputPrice: 3)
		const initialModel = handler.getModel()
		expect(initialModel.info.inputPrice).toBe(3)

		// Spy on getModelById to verify the invoked model is looked up
		const getModelByIdSpy = vi.spyOn(handler, "getModelById")

		// Set up stream to include an invokedModelId pointing to Claude 3 Opus
		setupMockStreamWithInvokedModelId(
			"arn:aws:bedrock:us-west-2:699475926481:inference-profile/us.anthropic.claude-3-opus-20240229-v1:0",
		)

		// Consume the generator
		const events = []
		for await (const event of handler.createMessage("system prompt", [{ role: "user", content: "user message" }])) {
			events.push(event)
		}

		// Verify that getModelById was called with the parsed model id and type
		expect(getModelByIdSpy).toHaveBeenCalledWith("anthropic.claude-3-opus-20240229-v1:0", "inference-profile")

		// After processing, getModel should return the invoked model's pricing (Opus: inputPrice 15)
		const costModel = handler.getModel()
		expect(costModel.info.inputPrice).toBe(15)

		// Verify that a usage event was emitted
		const usageEvents = events.filter((e: any) => e.type === "usage")
		expect(usageEvents.length).toBeGreaterThanOrEqual(1)

		// The usage event should contain the token counts
		const lastUsageEvent = usageEvents[usageEvents.length - 1] as any
		expect(lastUsageEvent).toMatchObject({
			type: "usage",
			inputTokens: 100,
			outputTokens: 200,
		})
	})

	it("should not update costModelConfig when invokedModelId is not present", async () => {
		const handler = new AwsBedrockHandler({
			apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
		})

		const initialModelConfig = handler.getModel()
		expect(initialModelConfig.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")

		// Set up stream WITHOUT an invokedModelId
		setupMockStreamWithInvokedModelId(undefined)

		// Consume the generator
		for await (const _ of handler.createMessage("system prompt", [{ role: "user", content: "user message" }])) {
			// Just consume
		}

		// Model should remain unchanged
		const costModel = handler.getModel()
		expect(costModel.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
		expect(costModel.info.inputPrice).toBe(initialModelConfig.info.inputPrice)
	})

	it("should handle invalid invokedModelId format gracefully", async () => {
		const handler = new AwsBedrockHandler({
			apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
		})

		// Set up stream with an invalid (non-ARN) invokedModelId
		setupMockStreamWithInvokedModelId("invalid-format-not-an-arn")

		// Consume the generator — should not throw
		for await (const _ of handler.createMessage("system prompt", [{ role: "user", content: "user message" }])) {
			// Just consume
		}

		// Model should remain unchanged (the parseArn call should fail gracefully)
		const costModel = handler.getModel()
		expect(costModel.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
	})

	it("should use the invoked model's pricing for totalCost calculation", async () => {
		const handler = new AwsBedrockHandler({
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
			awsCustomArn: "arn:aws:bedrock:us-west-2:123456789:default-prompt-router/anthropic.claude:1",
		})

		// Set up stream to include Opus as the invoked model
		setupMockStreamWithInvokedModelId(
			"arn:aws:bedrock:us-west-2:699475926481:foundation-model/anthropic.claude-3-opus-20240229-v1:0",
		)

		const events = []
		for await (const event of handler.createMessage("system prompt", [{ role: "user", content: "user message" }])) {
			events.push(event)
		}

		const usageEvent = events.find((e: any) => e.type === "usage") as any
		expect(usageEvent).toBeDefined()

		// Calculate expected cost based on Opus pricing ($15 / 1M input, $75 / 1M output)
		const opusInfo = bedrockModels["anthropic.claude-3-opus-20240229-v1:0"]
		const expectedCost =
			(100 * (opusInfo.inputPrice ?? 0)) / 1_000_000 + (200 * (opusInfo.outputPrice ?? 0)) / 1_000_000

		expect(usageEvent.totalCost).toBeCloseTo(expectedCost, 10)
	})
})
