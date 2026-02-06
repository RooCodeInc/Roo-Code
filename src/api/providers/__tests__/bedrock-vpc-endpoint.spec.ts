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

// Mock createAmazonBedrock so we can inspect how it was called
const { mockCreateAmazonBedrock } = vi.hoisted(() => ({
	mockCreateAmazonBedrock: vi.fn(() => vi.fn(() => ({ modelId: "test", provider: "bedrock" }))),
}))

vi.mock("@ai-sdk/amazon-bedrock", () => ({
	createAmazonBedrock: mockCreateAmazonBedrock,
}))

import { AwsBedrockHandler } from "../bedrock"

describe("Amazon Bedrock VPC Endpoint Functionality", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	// Test Scenario 1: Input Validation Test
	describe("VPC Endpoint URL Validation", () => {
		it("should configure provider with baseURL when both URL and enabled flag are provided", () => {
			new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsBedrockEndpoint: "https://bedrock-vpc.example.com",
				awsBedrockEndpointEnabled: true,
			})

			expect(mockCreateAmazonBedrock).toHaveBeenCalledWith(
				expect.objectContaining({
					region: "us-east-1",
					baseURL: "https://bedrock-vpc.example.com",
				}),
			)
		})

		it("should not configure provider with baseURL when URL is provided but enabled flag is false", () => {
			new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsBedrockEndpoint: "https://bedrock-vpc.example.com",
				awsBedrockEndpointEnabled: false,
			})

			expect(mockCreateAmazonBedrock).toHaveBeenCalledWith(
				expect.objectContaining({
					region: "us-east-1",
				}),
			)

			const providerSettings = (mockCreateAmazonBedrock.mock.calls as unknown[][])[0][0] as Record<
				string,
				unknown
			>
			expect(providerSettings).not.toHaveProperty("baseURL")
		})
	})

	// Test Scenario 2: Edge Case Tests
	describe("Edge Cases", () => {
		it("should handle empty endpoint URL gracefully", () => {
			new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsBedrockEndpoint: "",
				awsBedrockEndpointEnabled: true,
			})

			expect(mockCreateAmazonBedrock).toHaveBeenCalledWith(
				expect.objectContaining({
					region: "us-east-1",
				}),
			)

			// Empty string is falsy, so baseURL should not be set
			const providerSettings = (mockCreateAmazonBedrock.mock.calls as unknown[][])[0][0] as Record<
				string,
				unknown
			>
			expect(providerSettings).not.toHaveProperty("baseURL")
		})

		it("should handle undefined endpoint URL gracefully", () => {
			new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsBedrockEndpoint: undefined,
				awsBedrockEndpointEnabled: true,
			})

			expect(mockCreateAmazonBedrock).toHaveBeenCalledWith(
				expect.objectContaining({
					region: "us-east-1",
				}),
			)

			const providerSettings = (mockCreateAmazonBedrock.mock.calls as unknown[][])[0][0] as Record<
				string,
				unknown
			>
			expect(providerSettings).not.toHaveProperty("baseURL")
		})
	})

	// Test Scenario 3: Error Handling Tests
	describe("Error Handling", () => {
		it("should handle invalid endpoint URLs by passing them directly to the provider", () => {
			new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsBedrockEndpoint: "invalid-url-format",
				awsBedrockEndpointEnabled: true,
			})

			// The invalid URL is passed directly; the provider/SDK will handle validation
			expect(mockCreateAmazonBedrock).toHaveBeenCalledWith(
				expect.objectContaining({
					region: "us-east-1",
					baseURL: "invalid-url-format",
				}),
			)
		})
	})

	// Test Scenario 4: Persistence Tests
	describe("Persistence", () => {
		it("should maintain consistent behavior across multiple requests", async () => {
			mockGenerateText.mockResolvedValue({
				text: "test response",
				usage: { promptTokens: 10, completionTokens: 5 },
			})

			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsBedrockEndpoint: "https://bedrock-vpc.example.com",
				awsBedrockEndpointEnabled: true,
			})

			// Verify the provider was configured with the endpoint
			expect(mockCreateAmazonBedrock).toHaveBeenCalledWith(
				expect.objectContaining({
					region: "us-east-1",
					baseURL: "https://bedrock-vpc.example.com",
				}),
			)

			// Make a request to ensure the endpoint configuration persists
			try {
				await handler.completePrompt("Test prompt")
			} catch {
				// Ignore errors — we're just testing the provider configuration persistence
			}

			// The provider factory should have been called exactly once (during construction)
			expect(mockCreateAmazonBedrock).toHaveBeenCalledTimes(1)
		})
	})
})
