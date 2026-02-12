import type { RooMessage } from "../../../core/task-persistence/rooMessage"
// Mock TelemetryService before other imports
const mockCaptureException = vi.fn()

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: (...args: unknown[]) => mockCaptureException(...args),
		},
	},
}))

// Mock AWS SDK credential providers
vi.mock("@aws-sdk/credential-providers", () => {
	const mockFromIni = vi.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	})
	return { fromIni: mockFromIni }
})

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
import {
	BEDROCK_1M_CONTEXT_MODEL_IDS,
	BEDROCK_SERVICE_TIER_MODEL_IDS,
	bedrockModels,
	ApiProviderError,
} from "@roo-code/types"

import type { Anthropic } from "@anthropic-ai/sdk"

describe("AwsBedrockHandler", () => {
	let handler: AwsBedrockHandler

	beforeEach(() => {
		// Clear all mocks before each test
		vi.clearAllMocks()

		handler = new AwsBedrockHandler({
			apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
		})
	})

	describe("getModel", () => {
		it("should return the correct model info for a standard model", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBeDefined()
			expect(modelInfo.info.contextWindow).toBeDefined()
		})

		it("should use custom ARN when provided", () => {
			// This test is incompatible with the refactored implementation
			// The implementation now extracts the model ID from the ARN instead of using the ARN directly
			// We'll update the test to match the new behavior
			const customArnHandler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsCustomArn: "arn:aws:bedrock:us-east-1::inference-profile/custom-model",
			})

			const modelInfo = customArnHandler.getModel()
			// Now we expect the model ID to be extracted from the ARN
			expect(modelInfo.id).toBe("arn:aws:bedrock:us-east-1::inference-profile/custom-model")
			expect(modelInfo.info).toBeDefined()
		})

		it("should use default prompt router model when prompt router arn is entered but no model can be identified from the ARN", () => {
			const customArnHandler = new AwsBedrockHandler({
				awsCustomArn:
					"arn:aws:bedrock:ap-northeast-3:123456789012:default-prompt-router/my_router_arn_no_model",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})
			const modelInfo = customArnHandler.getModel()
			expect(modelInfo.id).toBe(
				"arn:aws:bedrock:ap-northeast-3:123456789012:default-prompt-router/my_router_arn_no_model",
			)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(4096)
		})
	})

	describe("region mapping and cross-region inference", () => {
		describe("getPrefixForRegion", () => {
			it("should return correct prefix for US regions", () => {
				// Access private static method using type casting
				const getPrefixForRegion = (AwsBedrockHandler as any).getPrefixForRegion

				expect(getPrefixForRegion("us-east-1")).toBe("us.")
				expect(getPrefixForRegion("us-west-2")).toBe("us.")
				expect(getPrefixForRegion("us-gov-west-1")).toBe("ug.")
			})

			it("should return correct prefix for EU regions", () => {
				const getPrefixForRegion = (AwsBedrockHandler as any).getPrefixForRegion

				expect(getPrefixForRegion("eu-west-1")).toBe("eu.")
				expect(getPrefixForRegion("eu-central-1")).toBe("eu.")
				expect(getPrefixForRegion("eu-north-1")).toBe("eu.")
			})

			it("should return correct prefix for APAC regions", () => {
				const getPrefixForRegion = (AwsBedrockHandler as any).getPrefixForRegion

				// Australia regions (Sydney and Melbourne) get au. prefix
				expect(getPrefixForRegion("ap-southeast-2")).toBe("au.")
				expect(getPrefixForRegion("ap-southeast-4")).toBe("au.")
				// Japan regions (Tokyo and Osaka) get jp. prefix
				expect(getPrefixForRegion("ap-northeast-1")).toBe("jp.")
				expect(getPrefixForRegion("ap-northeast-3")).toBe("jp.")
				// Other APAC regions get apac. prefix
				expect(getPrefixForRegion("ap-southeast-1")).toBe("apac.")
				expect(getPrefixForRegion("ap-south-1")).toBe("apac.")
			})

			it("should return undefined for unsupported regions", () => {
				const getPrefixForRegion = (AwsBedrockHandler as any).getPrefixForRegion

				expect(getPrefixForRegion("unknown-region")).toBeUndefined()
				expect(getPrefixForRegion("")).toBeUndefined()
				expect(getPrefixForRegion("invalid")).toBeUndefined()
			})
		})

		describe("isSystemInferenceProfile", () => {
			it("should return true for AWS inference profile prefixes", () => {
				const isSystemInferenceProfile = (AwsBedrockHandler as any).isSystemInferenceProfile

				expect(isSystemInferenceProfile("us.")).toBe(true)
				expect(isSystemInferenceProfile("eu.")).toBe(true)
				expect(isSystemInferenceProfile("apac.")).toBe(true)
			})

			it("should return false for other prefixes", () => {
				const isSystemInferenceProfile = (AwsBedrockHandler as any).isSystemInferenceProfile

				expect(isSystemInferenceProfile("ap.")).toBe(false)
				expect(isSystemInferenceProfile("apne1.")).toBe(false)
				expect(isSystemInferenceProfile("use1.")).toBe(false)
				expect(isSystemInferenceProfile("custom.")).toBe(false)
				expect(isSystemInferenceProfile("")).toBe(false)
			})
		})

		describe("parseBaseModelId", () => {
			it("should remove defined inference profile prefixes", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
				})

				// Access private method using type casting
				const parseBaseModelId = (handler as any).parseBaseModelId.bind(handler)

				expect(parseBaseModelId("us.anthropic.claude-3-5-sonnet-20241022-v2:0")).toBe(
					"anthropic.claude-3-5-sonnet-20241022-v2:0",
				)
				expect(parseBaseModelId("eu.anthropic.claude-3-haiku-20240307-v1:0")).toBe(
					"anthropic.claude-3-haiku-20240307-v1:0",
				)
				expect(parseBaseModelId("apac.anthropic.claude-3-opus-20240229-v1:0")).toBe(
					"anthropic.claude-3-opus-20240229-v1:0",
				)
			})

			it("should not modify model IDs without defined prefixes", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
				})

				const parseBaseModelId = (handler as any).parseBaseModelId.bind(handler)

				expect(parseBaseModelId("anthropic.claude-3-5-sonnet-20241022-v2:0")).toBe(
					"anthropic.claude-3-5-sonnet-20241022-v2:0",
				)
				expect(parseBaseModelId("amazon.titan-text-express-v1")).toBe("amazon.titan-text-express-v1")
			})

			it("should not modify model IDs with other prefixes", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
				})

				const parseBaseModelId = (handler as any).parseBaseModelId.bind(handler)

				// Other prefixes should be preserved as part of the model ID
				expect(parseBaseModelId("ap.anthropic.claude-3-5-sonnet-20241022-v2:0")).toBe(
					"ap.anthropic.claude-3-5-sonnet-20241022-v2:0",
				)
				expect(parseBaseModelId("apne1.anthropic.claude-3-5-sonnet-20241022-v2:0")).toBe(
					"apne1.anthropic.claude-3-5-sonnet-20241022-v2:0",
				)
				expect(parseBaseModelId("use1.anthropic.claude-3-5-sonnet-20241022-v2:0")).toBe(
					"use1.anthropic.claude-3-5-sonnet-20241022-v2:0",
				)
			})
		})

		describe("cross-region inference integration", () => {
			it("should apply correct prefix when cross-region inference is enabled", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsUseCrossRegionInference: true,
				})

				const model = handler.getModel()
				expect(model.id).toBe("us.anthropic.claude-3-5-sonnet-20241022-v2:0")
			})

			it("should apply correct prefix for different regions", () => {
				const euHandler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "eu-west-1",
					awsUseCrossRegionInference: true,
				})

				const apacHandler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "ap-southeast-1",
					awsUseCrossRegionInference: true,
				})

				expect(euHandler.getModel().id).toBe("eu.anthropic.claude-3-5-sonnet-20241022-v2:0")
				expect(apacHandler.getModel().id).toBe("apac.anthropic.claude-3-5-sonnet-20241022-v2:0")
			})

			it("should not apply prefix when cross-region inference is disabled", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsUseCrossRegionInference: false,
				})

				const model = handler.getModel()
				expect(model.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
			})

			it("should not apply prefix for unsupported regions", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "unknown-region",
					awsUseCrossRegionInference: true,
				})

				const model = handler.getModel()
				expect(model.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
			})
		})

		describe("ARN parsing with inference profiles", () => {
			it("should detect cross-region inference from ARN model ID", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "test",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
				})

				const parseArn = (handler as any).parseArn.bind(handler)

				const result = parseArn(
					"arn:aws:bedrock:us-east-1:123456789012:foundation-model/us.anthropic.claude-3-5-sonnet-20241022-v2:0",
				)

				expect(result.isValid).toBe(true)
				expect(result.crossRegionInference).toBe(true)
				expect(result.modelId).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
			})

			it("should not detect cross-region inference for non-prefixed models", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "test",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
				})

				const parseArn = (handler as any).parseArn.bind(handler)

				const result = parseArn(
					"arn:aws:bedrock:us-east-1:123456789012:foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0",
				)

				expect(result.isValid).toBe(true)
				expect(result.crossRegionInference).toBe(false)
				expect(result.modelId).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
			})

			it("should detect cross-region inference for defined prefixes", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "test",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
				})

				const parseArn = (handler as any).parseArn.bind(handler)

				const euResult = parseArn(
					"arn:aws:bedrock:eu-west-1:123456789012:foundation-model/eu.anthropic.claude-3-5-sonnet-20241022-v2:0",
				)
				const apacResult = parseArn(
					"arn:aws:bedrock:ap-southeast-1:123456789012:foundation-model/apac.anthropic.claude-3-5-sonnet-20241022-v2:0",
				)

				expect(euResult.crossRegionInference).toBe(true)
				expect(euResult.modelId).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")

				expect(apacResult.crossRegionInference).toBe(true)
				expect(apacResult.modelId).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
			})

			it("should not detect cross-region inference for other prefixes", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "test",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
				})

				const parseArn = (handler as any).parseArn.bind(handler)

				// Other prefixes should not trigger cross-region inference detection
				const result = parseArn(
					"arn:aws:bedrock:us-east-1:123456789012:foundation-model/ap.anthropic.claude-3-5-sonnet-20241022-v2:0",
				)

				expect(result.crossRegionInference).toBe(false)
				expect(result.modelId).toBe("ap.anthropic.claude-3-5-sonnet-20241022-v2:0") // Should be preserved as-is
			})
		})

		describe("AWS GovCloud and China partition support", () => {
			it("should parse AWS GovCloud ARNs (arn:aws-us-gov:bedrock:...)", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "test",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-gov-west-1",
				})

				const parseArn = (handler as any).parseArn.bind(handler)

				const result = parseArn(
					"arn:aws-us-gov:bedrock:us-gov-west-1:123456789012:inference-profile/us-gov.anthropic.claude-sonnet-4-5-20250929-v1:0",
				)

				expect(result.isValid).toBe(true)
				expect(result.region).toBe("us-gov-west-1")
				expect(result.modelType).toBe("inference-profile")
			})

			it("should parse AWS China ARNs (arn:aws-cn:bedrock:...)", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "test",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "cn-north-1",
				})

				const parseArn = (handler as any).parseArn.bind(handler)

				const result = parseArn(
					"arn:aws-cn:bedrock:cn-north-1:123456789012:inference-profile/anthropic.claude-3-sonnet-20240229-v1:0",
				)

				expect(result.isValid).toBe(true)
				expect(result.region).toBe("cn-north-1")
				expect(result.modelType).toBe("inference-profile")
			})

			it("should accept GovCloud custom ARN in handler constructor", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "us-gov-west-1",
					awsCustomArn:
						"arn:aws-us-gov:bedrock:us-gov-west-1:123456789012:inference-profile/us-gov.anthropic.claude-sonnet-4-5-20250929-v1:0",
				})

				// Should not throw and should return valid model info
				const modelInfo = handler.getModel()
				expect(modelInfo.id).toBe(
					"arn:aws-us-gov:bedrock:us-gov-west-1:123456789012:inference-profile/us-gov.anthropic.claude-sonnet-4-5-20250929-v1:0",
				)
				expect(modelInfo.info).toBeDefined()
			})

			it("should accept China region custom ARN in handler constructor", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "cn-north-1",
					awsCustomArn:
						"arn:aws-cn:bedrock:cn-north-1:123456789012:inference-profile/anthropic.claude-3-sonnet-20240229-v1:0",
				})

				// Should not throw and should return valid model info
				const modelInfo = handler.getModel()
				expect(modelInfo.id).toBe(
					"arn:aws-cn:bedrock:cn-north-1:123456789012:inference-profile/anthropic.claude-3-sonnet-20240229-v1:0",
				)
				expect(modelInfo.info).toBeDefined()
			})

			it("should detect region mismatch in GovCloud ARN", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: "test",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
				})

				const parseArn = (handler as any).parseArn.bind(handler)

				// Region in ARN (us-gov-west-1) doesn't match provided region (us-east-1)
				const result = parseArn(
					"arn:aws-us-gov:bedrock:us-gov-west-1:123456789012:inference-profile/us-gov.anthropic.claude-sonnet-4-5-20250929-v1:0",
					"us-east-1",
				)

				expect(result.isValid).toBe(true)
				expect(result.region).toBe("us-gov-west-1")
				expect(result.errorMessage).toContain("Region mismatch")
			})
		})
	})

	describe("image handling", () => {
		const mockImageData = Buffer.from("test-image-data").toString("base64")

		function setupMockStreamText() {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "I see an image" }
			}
			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})
		}

		it("should properly pass image content through to streamText via AI SDK messages", async () => {
			setupMockStreamText()

			const messages: any[] = [
				{
					role: "user",
					content: [
						{
							type: "image",
							image: `data:image/jpeg;base64,${mockImageData}`,
							mimeType: "image/jpeg",
						},
						{
							type: "text",
							text: "What's in this image?",
						},
					],
				},
			]

			const generator = handler.createMessage("", messages)
			const chunks: unknown[] = []
			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			// Verify streamText was called
			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// Verify messages were converted to AI SDK format with image parts
			const aiSdkMessages = callArgs.messages
			expect(aiSdkMessages).toBeDefined()
			expect(aiSdkMessages.length).toBeGreaterThan(0)

			// Find the user message containing image content
			const userMsg = aiSdkMessages.find((m: { role: string }) => m.role === "user")
			expect(userMsg).toBeDefined()
			expect(Array.isArray(userMsg.content)).toBe(true)

			// Messages are already in AI SDK ImagePart format
			const imagePart = userMsg.content.find((p: { type: string }) => p.type === "image")
			expect(imagePart).toBeDefined()
			expect(imagePart.image).toContain("data:image/jpeg;base64,")
			expect(imagePart.mimeType).toBe("image/jpeg")

			const textPart = userMsg.content.find((p: { type: string }) => p.type === "text")
			expect(textPart).toBeDefined()
			expect(textPart.text).toBe("What's in this image?")
		})

		it("should handle multiple images in a single message", async () => {
			setupMockStreamText()

			const messages: any[] = [
				{
					role: "user",
					content: [
						{
							type: "image",
							image: `data:image/jpeg;base64,${mockImageData}`,
							mimeType: "image/jpeg",
						},
						{
							type: "text",
							text: "First image",
						},
						{
							type: "image",
							image: `data:image/png;base64,${mockImageData}`,
							mimeType: "image/png",
						},
						{
							type: "text",
							text: "Second image",
						},
					],
				},
			]

			const generator = handler.createMessage("", messages)
			const chunks: unknown[] = []
			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			// Verify streamText was called
			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// Verify messages contain both images
			const userMsg = callArgs.messages.find((m: { role: string }) => m.role === "user")
			expect(userMsg).toBeDefined()

			const imageParts = userMsg.content.filter((p: { type: string }) => p.type === "image")
			expect(imageParts).toHaveLength(2)
			expect(imageParts[0].image).toContain("data:image/jpeg;base64,")
			expect(imageParts[0].mimeType).toBe("image/jpeg")
			expect(imageParts[1].image).toContain("data:image/png;base64,")
			expect(imageParts[1].mimeType).toBe("image/png")
		})
	})

	describe("error handling and validation", () => {
		it("should handle invalid regions gracefully", () => {
			expect(() => {
				new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "", // Empty region
				})
			}).not.toThrow()
		})

		it("should validate ARN format and provide helpful error messages", () => {
			expect(() => {
				new AwsBedrockHandler({
					apiModelId: "test",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsCustomArn: "invalid-arn-format",
				})
			}).toThrow(/INVALID_ARN_FORMAT/)
		})

		it("should handle malformed ARNs with missing components", () => {
			expect(() => {
				new AwsBedrockHandler({
					apiModelId: "test",
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsCustomArn: "arn:aws:bedrock:us-east-1",
				})
			}).toThrow(/INVALID_ARN_FORMAT/)
		})
	})

	describe("model information and configuration", () => {
		it("should preserve model information after applying cross-region prefixes", () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
				awsUseCrossRegionInference: true,
			})

			const model = handler.getModel()

			// Model ID should have prefix
			expect(model.id).toBe("us.anthropic.claude-3-5-sonnet-20241022-v2:0")

			// But model info should remain the same
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should handle model configuration overrides correctly", () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
				modelMaxTokens: 4096,
				awsModelContextWindow: 100_000,
			})

			const model = handler.getModel()

			// Should use override values
			expect(model.info.maxTokens).toBe(4096)
			expect(model.info.contextWindow).toBe(100_000)
		})

		it("should handle unknown models with sensible defaults", () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "unknown.model.id",
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
			})

			const model = handler.getModel()

			// Should fall back to default model info
			expect(model.info.maxTokens).toBeDefined()
			expect(model.info.contextWindow).toBeDefined()
			expect(typeof model.info.supportsImages).toBe("boolean")
			expect(typeof model.info.supportsPromptCache).toBe("boolean")
		})
	})

	describe("1M context beta feature", () => {
		function setupMockStreamText() {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}
			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})
		}

		it("should enable 1M context window when awsBedrock1MContext is true for Claude Sonnet 4", () => {
			const handler = new AwsBedrockHandler({
				apiModelId: BEDROCK_1M_CONTEXT_MODEL_IDS[0],
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
				awsBedrock1MContext: true,
			})

			const model = handler.getModel()

			// Should have 1M context window when enabled
			expect(model.info.contextWindow).toBe(1_000_000)
		})

		it("should use default context window when awsBedrock1MContext is false for Claude Sonnet 4", () => {
			const handler = new AwsBedrockHandler({
				apiModelId: BEDROCK_1M_CONTEXT_MODEL_IDS[0],
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
				awsBedrock1MContext: false,
			})

			const model = handler.getModel()

			// Should use default context window (200k)
			expect(model.info.contextWindow).toBe(200_000)
		})

		it("should not affect context window for non-Claude Sonnet 4 models", () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
				awsBedrock1MContext: true,
			})

			const model = handler.getModel()

			// Should use default context window for non-Sonnet 4 models
			expect(model.info.contextWindow).toBe(200_000)
		})

		it("should include anthropicBeta in providerOptions when 1M context is enabled", async () => {
			setupMockStreamText()

			const handler = new AwsBedrockHandler({
				apiModelId: BEDROCK_1M_CONTEXT_MODEL_IDS[0],
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
				awsBedrock1MContext: true,
			})

			const messages: RooMessage[] = [
				{
					role: "user",
					content: "Test message",
				},
			]

			const generator = handler.createMessage("", messages)
			const chunks: unknown[] = []
			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// Should include anthropicBeta in providerOptions.bedrock with 1M context
			const bedrockOpts = callArgs.providerOptions?.bedrock as Record<string, unknown> | undefined
			expect(bedrockOpts).toBeDefined()
			expect(bedrockOpts!.anthropicBeta).toContain("context-1m-2025-08-07")
		})

		it("should not include 1M context beta when 1M context is disabled", async () => {
			setupMockStreamText()

			const handler = new AwsBedrockHandler({
				apiModelId: BEDROCK_1M_CONTEXT_MODEL_IDS[0],
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
				awsBedrock1MContext: false,
			})

			const messages: RooMessage[] = [
				{
					role: "user",
					content: "Test message",
				},
			]

			const generator = handler.createMessage("", messages)
			const chunks: unknown[] = []
			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// Should NOT include anthropicBeta with 1M context
			const bedrockOpts = callArgs.providerOptions?.bedrock as Record<string, unknown> | undefined
			if (bedrockOpts?.anthropicBeta) {
				expect(bedrockOpts.anthropicBeta).not.toContain("context-1m-2025-08-07")
			}
		})

		it("should not include 1M context beta for non-Claude Sonnet 4 models", async () => {
			setupMockStreamText()

			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
				awsBedrock1MContext: true,
			})

			const messages: RooMessage[] = [
				{
					role: "user",
					content: "Test message",
				},
			]

			const generator = handler.createMessage("", messages)
			const chunks: unknown[] = []
			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// Should NOT include anthropicBeta with 1M context for non-Sonnet 4 models
			const bedrockOpts = callArgs.providerOptions?.bedrock as Record<string, unknown> | undefined
			if (bedrockOpts?.anthropicBeta) {
				expect(bedrockOpts.anthropicBeta).not.toContain("context-1m-2025-08-07")
			}
		})

		it("should enable 1M context window with cross-region inference for Claude Sonnet 4", () => {
			const handler = new AwsBedrockHandler({
				apiModelId: BEDROCK_1M_CONTEXT_MODEL_IDS[0],
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
				awsUseCrossRegionInference: true,
				awsBedrock1MContext: true,
			})

			const model = handler.getModel()

			// Should have 1M context window even with cross-region prefix
			expect(model.info.contextWindow).toBe(1_000_000)
			// Model ID should have cross-region prefix
			expect(model.id).toBe(`us.${BEDROCK_1M_CONTEXT_MODEL_IDS[0]}`)
		})

		it("should include anthropicBeta with cross-region inference for Claude Sonnet 4", async () => {
			setupMockStreamText()

			const handler = new AwsBedrockHandler({
				apiModelId: BEDROCK_1M_CONTEXT_MODEL_IDS[0],
				awsAccessKey: "test",
				awsSecretKey: "test",
				awsRegion: "us-east-1",
				awsUseCrossRegionInference: true,
				awsBedrock1MContext: true,
			})

			const messages: RooMessage[] = [
				{
					role: "user",
					content: "Test message",
				},
			]

			const generator = handler.createMessage("", messages)
			const chunks: unknown[] = []
			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// Should include anthropicBeta in providerOptions.bedrock with 1M context
			const bedrockOpts = callArgs.providerOptions?.bedrock as Record<string, unknown> | undefined
			expect(bedrockOpts).toBeDefined()
			expect(bedrockOpts!.anthropicBeta).toContain("context-1m-2025-08-07")
		})
	})

	describe("service tier feature", () => {
		const supportedModelId = BEDROCK_SERVICE_TIER_MODEL_IDS[0] // amazon.nova-lite-v1:0

		function setupMockStreamText() {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}
			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})
		}

		describe("pricing multipliers in getModel()", () => {
			it("should apply FLEX tier pricing with 50% discount", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: supportedModelId,
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsBedrockServiceTier: "FLEX",
				})

				const model = handler.getModel()
				const baseModel = bedrockModels[supportedModelId as keyof typeof bedrockModels] as {
					inputPrice: number
					outputPrice: number
				}

				// FLEX tier should apply 0.5 multiplier (50% discount)
				expect(model.info.inputPrice).toBe(baseModel.inputPrice * 0.5)
				expect(model.info.outputPrice).toBe(baseModel.outputPrice * 0.5)
			})

			it("should apply PRIORITY tier pricing with 75% premium", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: supportedModelId,
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsBedrockServiceTier: "PRIORITY",
				})

				const model = handler.getModel()
				const baseModel = bedrockModels[supportedModelId as keyof typeof bedrockModels] as {
					inputPrice: number
					outputPrice: number
				}

				// PRIORITY tier should apply 1.75 multiplier (75% premium)
				expect(model.info.inputPrice).toBe(baseModel.inputPrice * 1.75)
				expect(model.info.outputPrice).toBe(baseModel.outputPrice * 1.75)
			})

			it("should not modify pricing for STANDARD tier", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: supportedModelId,
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsBedrockServiceTier: "STANDARD",
				})

				const model = handler.getModel()
				const baseModel = bedrockModels[supportedModelId as keyof typeof bedrockModels] as {
					inputPrice: number
					outputPrice: number
				}

				// STANDARD tier should not modify pricing (1.0 multiplier)
				expect(model.info.inputPrice).toBe(baseModel.inputPrice)
				expect(model.info.outputPrice).toBe(baseModel.outputPrice)
			})

			it("should not apply service tier pricing for unsupported models", () => {
				const unsupportedModelId = "anthropic.claude-3-5-sonnet-20241022-v2:0"
				const handler = new AwsBedrockHandler({
					apiModelId: unsupportedModelId,
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsBedrockServiceTier: "FLEX", // Try to apply FLEX tier
				})

				const model = handler.getModel()
				const baseModel = bedrockModels[unsupportedModelId as keyof typeof bedrockModels] as {
					inputPrice: number
					outputPrice: number
				}

				// Pricing should remain unchanged for unsupported models
				expect(model.info.inputPrice).toBe(baseModel.inputPrice)
				expect(model.info.outputPrice).toBe(baseModel.outputPrice)
			})
		})

		describe("service_tier parameter in API requests", () => {
			it("should include service_tier in providerOptions.bedrock.additionalModelRequestFields for supported models", async () => {
				setupMockStreamText()

				const handler = new AwsBedrockHandler({
					apiModelId: supportedModelId,
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsBedrockServiceTier: "PRIORITY",
				})

				const messages: RooMessage[] = [
					{
						role: "user",
						content: "Test message",
					},
				]

				const generator = handler.createMessage("", messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				expect(mockStreamText).toHaveBeenCalledTimes(1)
				const callArgs = mockStreamText.mock.calls[0][0]

				// service_tier should be passed through providerOptions.bedrock.additionalModelRequestFields
				const bedrockOpts = callArgs.providerOptions?.bedrock as Record<string, unknown> | undefined
				expect(bedrockOpts).toBeDefined()
				const additionalFields = bedrockOpts!.additionalModelRequestFields as
					| Record<string, unknown>
					| undefined
				expect(additionalFields).toBeDefined()
				expect(additionalFields!.service_tier).toBe("PRIORITY")
			})

			it("should include service_tier FLEX in providerOptions", async () => {
				setupMockStreamText()

				const handler = new AwsBedrockHandler({
					apiModelId: supportedModelId,
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsBedrockServiceTier: "FLEX",
				})

				const messages: RooMessage[] = [
					{
						role: "user",
						content: "Test message",
					},
				]

				const generator = handler.createMessage("", messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				expect(mockStreamText).toHaveBeenCalledTimes(1)
				const callArgs = mockStreamText.mock.calls[0][0]

				const bedrockOpts = callArgs.providerOptions?.bedrock as Record<string, unknown> | undefined
				expect(bedrockOpts).toBeDefined()
				const additionalFields = bedrockOpts!.additionalModelRequestFields as
					| Record<string, unknown>
					| undefined
				expect(additionalFields).toBeDefined()
				expect(additionalFields!.service_tier).toBe("FLEX")
			})

			it("should NOT include service_tier for unsupported models", async () => {
				setupMockStreamText()

				const unsupportedModelId = "anthropic.claude-3-5-sonnet-20241022-v2:0"
				const handler = new AwsBedrockHandler({
					apiModelId: unsupportedModelId,
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsBedrockServiceTier: "PRIORITY", // Try to apply PRIORITY tier
				})

				const messages: RooMessage[] = [
					{
						role: "user",
						content: "Test message",
					},
				]

				const generator = handler.createMessage("", messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				expect(mockStreamText).toHaveBeenCalledTimes(1)
				const callArgs = mockStreamText.mock.calls[0][0]

				// Service tier should NOT be included for unsupported models
				const bedrockOpts = callArgs.providerOptions?.bedrock as Record<string, unknown> | undefined
				if (bedrockOpts?.additionalModelRequestFields) {
					const additionalFields = bedrockOpts.additionalModelRequestFields as Record<string, unknown>
					expect(additionalFields.service_tier).toBeUndefined()
				}
			})

			it("should NOT include service_tier when not specified", async () => {
				setupMockStreamText()

				const handler = new AwsBedrockHandler({
					apiModelId: supportedModelId,
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					// No awsBedrockServiceTier specified
				})

				const messages: RooMessage[] = [
					{
						role: "user",
						content: "Test message",
					},
				]

				const generator = handler.createMessage("", messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				expect(mockStreamText).toHaveBeenCalledTimes(1)
				const callArgs = mockStreamText.mock.calls[0][0]

				// Service tier should NOT be included when not specified
				const bedrockOpts = callArgs.providerOptions?.bedrock as Record<string, unknown> | undefined
				if (bedrockOpts?.additionalModelRequestFields) {
					const additionalFields = bedrockOpts.additionalModelRequestFields as Record<string, unknown>
					expect(additionalFields.service_tier).toBeUndefined()
				}
			})
		})

		describe("service tier with cross-region inference", () => {
			it("should apply service tier pricing with cross-region inference prefix", () => {
				const handler = new AwsBedrockHandler({
					apiModelId: supportedModelId,
					awsAccessKey: "test",
					awsSecretKey: "test",
					awsRegion: "us-east-1",
					awsUseCrossRegionInference: true,
					awsBedrockServiceTier: "FLEX",
				})

				const model = handler.getModel()
				const baseModel = bedrockModels[supportedModelId as keyof typeof bedrockModels] as {
					inputPrice: number
					outputPrice: number
				}

				// Model ID should have cross-region prefix
				expect(model.id).toBe(`us.${supportedModelId}`)

				// FLEX tier pricing should still be applied
				expect(model.info.inputPrice).toBe(baseModel.inputPrice * 0.5)
				expect(model.info.outputPrice).toBe(baseModel.outputPrice * 0.5)
			})
		})
	})

	describe("error telemetry", () => {
		beforeEach(() => {
			mockCaptureException.mockClear()
		})

		it("should capture telemetry on createMessage error", async () => {
			// Mock streamText to throw an error
			mockStreamText.mockImplementation(() => {
				throw new Error("Bedrock API error")
			})

			const errorHandler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})

			const messages: RooMessage[] = [
				{
					role: "user",
					content: "Hello",
				},
			]

			const generator = errorHandler.createMessage("You are a helpful assistant", messages)

			// Consume the generator - it should throw
			await expect(async () => {
				for await (const _chunk of generator) {
					// Should throw before or during iteration
				}
			}).rejects.toThrow()

			// Verify telemetry was captured
			expect(mockCaptureException).toHaveBeenCalledTimes(1)
			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Bedrock API error",
					provider: "Bedrock",
					modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					operation: "createMessage",
				}),
			)

			// Verify it's an ApiProviderError
			const capturedError = mockCaptureException.mock.calls[0][0]
			expect(capturedError).toBeInstanceOf(ApiProviderError)
		})

		it("should capture telemetry on completePrompt error", async () => {
			// Mock generateText to throw an error
			mockGenerateText.mockRejectedValueOnce(new Error("Bedrock completion error"))

			const errorHandler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})

			// Call completePrompt - it should throw
			await expect(errorHandler.completePrompt("Test prompt")).rejects.toThrow()

			// Verify telemetry was captured
			expect(mockCaptureException).toHaveBeenCalledTimes(1)
			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Bedrock completion error",
					provider: "Bedrock",
					modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					operation: "completePrompt",
				}),
			)

			// Verify it's an ApiProviderError
			const capturedError = mockCaptureException.mock.calls[0][0]
			expect(capturedError).toBeInstanceOf(ApiProviderError)
		})

		it("should still throw the error after capturing telemetry", async () => {
			// Mock streamText to throw an error
			mockStreamText.mockImplementation(() => {
				throw new Error("Test error for throw verification")
			})

			const errorHandler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})

			const messages: RooMessage[] = [
				{
					role: "user",
					content: "Hello",
				},
			]

			const generator = errorHandler.createMessage("You are a helpful assistant", messages)

			// Verify the error is still thrown after telemetry capture
			await expect(async () => {
				for await (const _chunk of generator) {
					// Should throw
				}
			}).rejects.toThrow()

			// Telemetry should have been captured before the error was thrown
			expect(mockCaptureException).toHaveBeenCalled()
		})
	})

	describe("AI SDK v6 usage field paths", () => {
		const systemPrompt = "You are a helpful assistant"
		const messages: RooMessage[] = [
			{
				role: "user",
				content: "Hello",
			},
		]

		function setupStream(usage: Record<string, unknown>, providerMetadata: Record<string, unknown> = {}) {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "reply" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve(usage),
				providerMetadata: Promise.resolve(providerMetadata),
			})
		}

		describe("cache tokens", () => {
			it("should read cache tokens from v6 top-level cachedInputTokens", async () => {
				setupStream({ inputTokens: 100, outputTokens: 50, cachedInputTokens: 30 })

				const generator = handler.createMessage(systemPrompt, messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				const usageChunk = chunks.find((c: any) => c.type === "usage") as any
				expect(usageChunk).toBeDefined()
				expect(usageChunk.cacheReadTokens).toBe(30)
			})

			it("should read cache tokens from v6 inputTokenDetails.cacheReadTokens", async () => {
				setupStream({
					inputTokens: 100,
					outputTokens: 50,
					inputTokenDetails: { cacheReadTokens: 25 },
				})

				const generator = handler.createMessage(systemPrompt, messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				const usageChunk = chunks.find((c: any) => c.type === "usage") as any
				expect(usageChunk).toBeDefined()
				expect(usageChunk.cacheReadTokens).toBe(25)
			})

			it("should prefer v6 top-level cachedInputTokens over providerMetadata.bedrock", async () => {
				setupStream(
					{ inputTokens: 100, outputTokens: 50, cachedInputTokens: 30 },
					{ bedrock: { usage: { cacheReadInputTokens: 20 } } },
				)

				const generator = handler.createMessage(systemPrompt, messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				const usageChunk = chunks.find((c: any) => c.type === "usage") as any
				expect(usageChunk).toBeDefined()
				expect(usageChunk.cacheReadTokens).toBe(30)
			})

			it("should fall back to providerMetadata.bedrock.usage.cacheReadInputTokens", async () => {
				setupStream(
					{ inputTokens: 100, outputTokens: 50 },
					{ bedrock: { usage: { cacheReadInputTokens: 20 } } },
				)

				const generator = handler.createMessage(systemPrompt, messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				const usageChunk = chunks.find((c: any) => c.type === "usage") as any
				expect(usageChunk).toBeDefined()
				expect(usageChunk.cacheReadTokens).toBe(20)
			})

			it("should read cacheWriteTokens from v6 inputTokenDetails.cacheWriteTokens", async () => {
				setupStream({
					inputTokens: 100,
					outputTokens: 50,
					inputTokenDetails: { cacheWriteTokens: 15 },
				})

				const generator = handler.createMessage(systemPrompt, messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				const usageChunk = chunks.find((c: any) => c.type === "usage") as any
				expect(usageChunk).toBeDefined()
				expect(usageChunk.cacheWriteTokens).toBe(15)
			})
		})

		describe("reasoning tokens", () => {
			it("should read reasoning tokens from v6 top-level reasoningTokens", async () => {
				setupStream({ inputTokens: 100, outputTokens: 50, reasoningTokens: 40 })

				const generator = handler.createMessage(systemPrompt, messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				const usageChunk = chunks.find((c: any) => c.type === "usage") as any
				expect(usageChunk).toBeDefined()
				expect(usageChunk.reasoningTokens).toBe(40)
			})

			it("should read reasoning tokens from v6 outputTokenDetails.reasoningTokens", async () => {
				setupStream({
					inputTokens: 100,
					outputTokens: 50,
					outputTokenDetails: { reasoningTokens: 35 },
				})

				const generator = handler.createMessage(systemPrompt, messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				const usageChunk = chunks.find((c: any) => c.type === "usage") as any
				expect(usageChunk).toBeDefined()
				expect(usageChunk.reasoningTokens).toBe(35)
			})

			it("should prefer v6 top-level reasoningTokens over outputTokenDetails", async () => {
				setupStream({
					inputTokens: 100,
					outputTokens: 50,
					reasoningTokens: 40,
					outputTokenDetails: { reasoningTokens: 15 },
				})

				const generator = handler.createMessage(systemPrompt, messages)
				const chunks: unknown[] = []
				for await (const chunk of generator) {
					chunks.push(chunk)
				}

				const usageChunk = chunks.find((c: any) => c.type === "usage") as any
				expect(usageChunk).toBeDefined()
				expect(usageChunk.reasoningTokens).toBe(40)
			})
		})
	})
})
