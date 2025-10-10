// npx vitest run src/api/providers/__tests__/bedrock-global-inference.spec.ts

import { AwsBedrockHandler } from "../bedrock"
import { BedrockRuntimeClient, ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime"
import { logger } from "../../../utils/logging"
import type { ProviderSettings } from "@roo-code/types"

// Mock AWS SDK modules
vitest.mock("@aws-sdk/client-bedrock-runtime", () => {
	const mockSend = vi.fn().mockResolvedValue({
		stream: (async function* () {
			yield {
				contentBlockStart: {
					start: { text: "Test response" },
				},
			}
			yield {
				contentBlockDelta: {
					delta: { text: " from Claude" },
				},
			}
			yield {
				messageStop: {},
			}
		})(),
	})

	return {
		BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
			send: mockSend,
		})),
		ConverseStreamCommand: vi.fn(),
		ConverseCommand: vi.fn(),
	}
})

vitest.mock("../../../utils/logging")

describe("AwsBedrockHandler - Global Inference Profile Support", () => {
	let handler: AwsBedrockHandler
	let mockSend: any

	beforeEach(() => {
		vi.clearAllMocks()
		mockSend = vi.fn().mockResolvedValue({
			stream: (async function* () {
				yield {
					contentBlockStart: {
						start: { text: "Test response" },
					},
				}
				yield {
					contentBlockDelta: {
						delta: { text: " from Claude" },
					},
				}
				yield {
					messageStop: {},
				}
			})(),
		})
		;(BedrockRuntimeClient as any).mockImplementation(() => ({
			send: mockSend,
		}))
	})

	describe("Global Inference Profile ARN Support", () => {
		it("should detect Claude Sonnet 4.5 global inference profile ARN", () => {
			const options: ProviderSettings = {
				apiProvider: "bedrock",
				awsRegion: "us-east-1",
				awsCustomArn:
					"arn:aws:bedrock:us-east-1:148761681080:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0",
				awsAccessKey: "test-key",
				awsSecretKey: "test-secret",
			}

			handler = new AwsBedrockHandler(options)
			const model = handler.getModel()

			// Should recognize the ARN and provide appropriate model info
			expect(model.id).toBe(
				"arn:aws:bedrock:us-east-1:148761681080:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0",
			)
			expect(model.info).toBeDefined()
			expect(model.info.supportsReasoningBudget).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
			expect(model.info.supportsImages).toBe(true)
		})

		it("should enable 1M context for global inference profile when awsBedrock1MContext is true", async () => {
			const options: ProviderSettings = {
				apiProvider: "bedrock",
				awsRegion: "us-east-1",
				awsCustomArn:
					"arn:aws:bedrock:us-east-1:148761681080:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0",
				awsBedrock1MContext: true,
				awsAccessKey: "test-key",
				awsSecretKey: "test-secret",
			}

			handler = new AwsBedrockHandler(options)

			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("System prompt", messages)

			// Consume the stream
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Check that the command was called
			expect(mockSend).toHaveBeenCalled()
			expect(ConverseStreamCommand).toHaveBeenCalled()

			// Get the payload from the ConverseStreamCommand constructor
			const commandPayload = (ConverseStreamCommand as any).mock.calls[0][0]
			expect(commandPayload).toBeDefined()
			expect(commandPayload.additionalModelRequestFields).toBeDefined()
			expect(commandPayload.additionalModelRequestFields.anthropic_beta).toContain("context-1m-2025-08-07")
		})

		it("should enable thinking/reasoning for global inference profile", async () => {
			const options: ProviderSettings = {
				apiProvider: "bedrock",
				awsRegion: "us-east-1",
				awsCustomArn:
					"arn:aws:bedrock:us-east-1:148761681080:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0",
				enableReasoningEffort: true,
				awsAccessKey: "test-key",
				awsSecretKey: "test-secret",
			}

			handler = new AwsBedrockHandler(options)

			const messages = [{ role: "user" as const, content: "Test message" }]
			const metadata = {
				taskId: "test-task-id",
				thinking: {
					enabled: true,
					maxThinkingTokens: 8192,
				},
			}

			const stream = handler.createMessage("System prompt", messages, metadata)

			// Consume the stream
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Check that thinking was enabled
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining("Extended thinking enabled"),
				expect.objectContaining({
					ctx: "bedrock",
					thinking: expect.objectContaining({
						type: "enabled",
						budget_tokens: 8192,
					}),
				}),
			)
		})

		it("should handle various Claude 4.5 ARN patterns", () => {
			const testCases = [
				"arn:aws:bedrock:us-east-1:148761681080:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0",
				"arn:aws:bedrock:eu-west-1:123456789012:inference-profile/anthropic.claude-sonnet-4-5-20250929-v1:0",
				"arn:aws:bedrock:ap-southeast-1:987654321098:foundation-model/anthropic.claude-sonnet-4.5-v1:0",
			]

			testCases.forEach((arn) => {
				const options: ProviderSettings = {
					apiProvider: "bedrock",
					awsRegion: "us-east-1",
					awsCustomArn: arn,
					awsAccessKey: "test-key",
					awsSecretKey: "test-secret",
				}

				handler = new AwsBedrockHandler(options)
				const model = handler.getModel()

				expect(model.info.supportsReasoningBudget).toBe(true)
				expect(model.info.supportsPromptCache).toBe(true)
			})
		})

		it("should not enable thinking for non-Claude-4.5 custom ARNs", () => {
			const options: ProviderSettings = {
				apiProvider: "bedrock",
				awsRegion: "us-east-1",
				awsCustomArn:
					"arn:aws:bedrock:us-east-1:123456789012:foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
				awsAccessKey: "test-key",
				awsSecretKey: "test-secret",
			}

			handler = new AwsBedrockHandler(options)
			const model = handler.getModel()

			// Should not have reasoning budget support for non-Claude-4.5 models
			expect(model.info.supportsReasoningBudget).toBeFalsy()
		})
	})

	describe("ARN Parsing with Global Inference Profile", () => {
		it("should correctly parse global inference profile ARN", () => {
			const handler = new AwsBedrockHandler({
				apiProvider: "bedrock",
				awsRegion: "us-east-1",
				awsAccessKey: "test-key",
				awsSecretKey: "test-secret",
			})

			const parseArn = (handler as any).parseArn.bind(handler)
			const result = parseArn(
				"arn:aws:bedrock:us-east-1:148761681080:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0",
			)

			expect(result.isValid).toBe(true)
			expect(result.region).toBe("us-east-1")
			expect(result.modelType).toBe("inference-profile")
			expect(result.modelId).toContain("anthropic.claude-sonnet-4-5-20250929")
		})
	})
})
