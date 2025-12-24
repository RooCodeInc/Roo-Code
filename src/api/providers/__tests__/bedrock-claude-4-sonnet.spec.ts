// npx vitest run src/api/providers/__tests__/bedrock-claude-4-sonnet.spec.ts

import { AwsBedrockHandler } from "../bedrock"
import { describe, it, expect, vi } from "vitest"

// Mock AWS SDK
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
	return {
		BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
			send: vi.fn(),
		})),
		ConverseStreamCommand: vi.fn(),
		ConverseCommand: vi.fn(),
	}
})

describe("Bedrock Claude 4 Sonnet Model Handling", () => {
	// Helper function to create a handler with specific options
	const createHandler = (overrides: any = {}) => {
		const defaultOptions = {
			apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
			awsAccessKey: "test-key",
			awsSecretKey: "test-secret",
			awsRegion: "us-east-1",
			...overrides,
		}
		return new AwsBedrockHandler(defaultOptions)
	}

	describe("Claude 4 Sonnet Model Recognition", () => {
		it("should correctly handle anthropic.claude-sonnet-4-20250514-v1:0 model", () => {
			const handler = createHandler({
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
			})

			const model = handler.getModel()
			expect(model.id).toBe("anthropic.claude-sonnet-4-20250514-v1:0")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
			expect(model.info.supportsReasoningBudget).toBe(true)
		})

		it("should handle Claude 4 Sonnet with cross-region inference (US prefix)", () => {
			const handler = createHandler({
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsUseCrossRegionInference: true,
				awsRegion: "us-east-1",
			})

			const model = handler.getModel()
			// Model ID should have the US prefix
			expect(model.id).toBe("us.anthropic.claude-sonnet-4-20250514-v1:0")
			// Model info should still be correctly resolved
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
			expect(model.info.supportsReasoningBudget).toBe(true)
		})

		it("should handle Claude 4 Sonnet with cross-region inference (EU prefix)", () => {
			const handler = createHandler({
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsUseCrossRegionInference: true,
				awsRegion: "eu-west-1",
			})

			const model = handler.getModel()
			// Model ID should have the EU prefix
			expect(model.id).toBe("eu.anthropic.claude-sonnet-4-20250514-v1:0")
			// Model info should still be correctly resolved
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
		})

		it("should handle Claude 4 Sonnet with cross-region inference (APAC prefix)", () => {
			const handler = createHandler({
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsUseCrossRegionInference: true,
				awsRegion: "ap-southeast-1",
			})

			const model = handler.getModel()
			// Model ID should have the APAC prefix
			expect(model.id).toBe("apac.anthropic.claude-sonnet-4-20250514-v1:0")
			// Model info should still be correctly resolved
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
		})

		it("should handle Claude 4 Sonnet with global inference", () => {
			const handler = createHandler({
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsUseGlobalInference: true,
				awsRegion: "us-east-1",
			})

			const model = handler.getModel()
			// Model ID should have the global prefix
			expect(model.id).toBe("global.anthropic.claude-sonnet-4-20250514-v1:0")
			// Model info should still be correctly resolved
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
		})

		it("should handle Claude 4 Sonnet with 1M context enabled", () => {
			const handler = createHandler({
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsBedrock1MContext: true,
			})

			const model = handler.getModel()
			expect(model.id).toBe("anthropic.claude-sonnet-4-20250514-v1:0")
			// Context window should be updated to 1M
			expect(model.info.contextWindow).toBe(1_000_000)
		})

		it("should handle Claude 4 Sonnet with cross-region inference and 1M context", () => {
			const handler = createHandler({
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsUseCrossRegionInference: true,
				awsRegion: "us-west-2",
				awsBedrock1MContext: true,
			})

			const model = handler.getModel()
			// Model ID should have the US prefix
			expect(model.id).toBe("us.anthropic.claude-sonnet-4-20250514-v1:0")
			// Context window should be 1M
			expect(model.info.contextWindow).toBe(1_000_000)
			// Other properties should be preserved
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
			expect(model.info.supportsReasoningBudget).toBe(true)
		})

		it("should correctly parse base model ID from prefixed Claude 4 Sonnet", () => {
			const handler = createHandler()
			// Access private method through type casting
			const parseBaseModelId = (handler as any).parseBaseModelId.bind(handler)

			// Test various prefixed versions
			expect(parseBaseModelId("us.anthropic.claude-sonnet-4-20250514-v1:0")).toBe(
				"anthropic.claude-sonnet-4-20250514-v1:0",
			)
			expect(parseBaseModelId("eu.anthropic.claude-sonnet-4-20250514-v1:0")).toBe(
				"anthropic.claude-sonnet-4-20250514-v1:0",
			)
			expect(parseBaseModelId("apac.anthropic.claude-sonnet-4-20250514-v1:0")).toBe(
				"anthropic.claude-sonnet-4-20250514-v1:0",
			)
			expect(parseBaseModelId("global.anthropic.claude-sonnet-4-20250514-v1:0")).toBe(
				"anthropic.claude-sonnet-4-20250514-v1:0",
			)
			// Should not modify unprefixed model ID
			expect(parseBaseModelId("anthropic.claude-sonnet-4-20250514-v1:0")).toBe(
				"anthropic.claude-sonnet-4-20250514-v1:0",
			)
		})

		it("should handle getModelById for Claude 4 Sonnet with cross-region prefix", () => {
			const handler = createHandler()

			// Test with US prefix
			const modelWithUsPrefix = handler.getModelById("us.anthropic.claude-sonnet-4-20250514-v1:0")
			expect(modelWithUsPrefix.id).toBe("anthropic.claude-sonnet-4-20250514-v1:0")
			expect(modelWithUsPrefix.info.maxTokens).toBe(8192)
			expect(modelWithUsPrefix.info.contextWindow).toBe(200_000)
			expect(modelWithUsPrefix.info.supportsReasoningBudget).toBe(true)

			// Test with EU prefix
			const modelWithEuPrefix = handler.getModelById("eu.anthropic.claude-sonnet-4-20250514-v1:0")
			expect(modelWithEuPrefix.id).toBe("anthropic.claude-sonnet-4-20250514-v1:0")
			expect(modelWithEuPrefix.info.maxTokens).toBe(8192)
			expect(modelWithEuPrefix.info.contextWindow).toBe(200_000)

			// Test with global prefix
			const modelWithGlobalPrefix = handler.getModelById("global.anthropic.claude-sonnet-4-20250514-v1:0")
			expect(modelWithGlobalPrefix.id).toBe("anthropic.claude-sonnet-4-20250514-v1:0")
			expect(modelWithGlobalPrefix.info.maxTokens).toBe(8192)
			expect(modelWithGlobalPrefix.info.contextWindow).toBe(200_000)
		})

		it("should use guessModelInfoFromId for unknown Claude 4 variants", () => {
			const handler = createHandler({
				apiModelId: "anthropic.claude-sonnet-4-future-v1:0", // A hypothetical future model
			})

			const model = handler.getModel()
			// Should still recognize it as a Claude Sonnet 4 model based on pattern
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
			expect(model.info.supportsReasoningBudget).toBe(true)
		})
	})

	describe("Claude 4.5 Sonnet Model Recognition", () => {
		it("should correctly handle anthropic.claude-sonnet-4-5-20250929-v1:0 model", () => {
			const handler = createHandler({
				apiModelId: "anthropic.claude-sonnet-4-5-20250929-v1:0",
			})

			const model = handler.getModel()
			expect(model.id).toBe("anthropic.claude-sonnet-4-5-20250929-v1:0")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
			expect(model.info.supportsReasoningBudget).toBe(true)
		})
	})
})
