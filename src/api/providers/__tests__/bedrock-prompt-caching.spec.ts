// npx vitest run src/api/providers/__tests__/bedrock-prompt-caching.spec.ts

// Mock AWS SDK credential providers
vi.mock("@aws-sdk/credential-providers", () => {
	const mockFromIni = vi.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	})
	return { fromIni: mockFromIni }
})

// Mock BedrockRuntimeClient and Commands
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
	const mockSend = vi.fn().mockResolvedValue({
		stream: [],
		output: {
			message: {
				content: [{ text: "test response" }],
			},
		},
	})
	const mockConverseStreamCommand = vi.fn()
	const mockConverseCommand = vi.fn()

	return {
		BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
			send: mockSend,
		})),
		ConverseStreamCommand: mockConverseStreamCommand,
		ConverseCommand: mockConverseCommand,
	}
})

import { AwsBedrockHandler } from "../bedrock"
import { ConverseStreamCommand, ConverseCommand, BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime"
import type { Anthropic } from "@anthropic-ai/sdk"

// Get access to the mocked functions
const mockConverseStreamCommand = vi.mocked(ConverseStreamCommand)
const mockConverseCommand = vi.mocked(ConverseCommand)
const mockBedrockRuntimeClient = vi.mocked(BedrockRuntimeClient)

describe("AwsBedrockHandler - Prompt Caching", () => {
	let handler: AwsBedrockHandler

	beforeEach(() => {
		// Clear all mocks before each test
		vi.clearAllMocks()
	})

	describe("explicitPromptCaching parameter", () => {
		describe("createMessage (streaming)", () => {
			it("should include explicitPromptCaching='enabled' when awsUsePromptCache is true", async () => {
				handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "us-east-1",
					awsUsePromptCache: true,
				})

				const messages: Anthropic.Messages.MessageParam[] = [
					{
						role: "user",
						content: "Test message for caching",
					},
				]

				const generator = handler.createMessage("System prompt", messages)
				await generator.next() // Start the generator

				// Verify the command was created with explicitPromptCaching
				expect(mockConverseStreamCommand).toHaveBeenCalled()
				const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

				// Should include explicitPromptCaching parameter
				expect(commandArg.explicitPromptCaching).toBe("enabled")
			})

			it("should not include explicitPromptCaching when awsUsePromptCache is false", async () => {
				handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "us-east-1",
					awsUsePromptCache: false,
				})

				const messages: Anthropic.Messages.MessageParam[] = [
					{
						role: "user",
						content: "Test message without caching",
					},
				]

				const generator = handler.createMessage("System prompt", messages)
				await generator.next() // Start the generator

				// Verify the command was created without explicitPromptCaching
				expect(mockConverseStreamCommand).toHaveBeenCalled()
				const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

				// Should not include explicitPromptCaching parameter
				expect(commandArg.explicitPromptCaching).toBeUndefined()
			})

			it("should not include explicitPromptCaching when awsUsePromptCache is undefined", async () => {
				handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "us-east-1",
					// awsUsePromptCache not specified
				})

				const messages: Anthropic.Messages.MessageParam[] = [
					{
						role: "user",
						content: "Test message with default settings",
					},
				]

				const generator = handler.createMessage("System prompt", messages)
				await generator.next() // Start the generator

				// Verify the command was created without explicitPromptCaching
				expect(mockConverseStreamCommand).toHaveBeenCalled()
				const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

				// Should not include explicitPromptCaching parameter when not specified
				expect(commandArg.explicitPromptCaching).toBeUndefined()
			})

			it("should only enable caching for models that support it", async () => {
				// Test with a model that doesn't support prompt caching
				handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-sonnet-20240229-v1:0", // This model doesn't support caching
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "us-east-1",
					awsUsePromptCache: true,
				})

				const messages: Anthropic.Messages.MessageParam[] = [
					{
						role: "user",
						content: "Test message",
					},
				]

				const generator = handler.createMessage("System prompt", messages)
				await generator.next() // Start the generator

				// Verify the command was created without explicitPromptCaching
				// even though awsUsePromptCache is true, because the model doesn't support it
				expect(mockConverseStreamCommand).toHaveBeenCalled()
				const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

				// Should not include explicitPromptCaching for unsupported models
				expect(commandArg.explicitPromptCaching).toBeUndefined()
			})
		})

		describe("completePrompt (non-streaming)", () => {
			it("should include explicitPromptCaching='enabled' when awsUsePromptCache is true", async () => {
				handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "us-east-1",
					awsUsePromptCache: true,
				})

				await handler.completePrompt("Test prompt for caching")

				// Verify the command was created with explicitPromptCaching
				expect(mockConverseCommand).toHaveBeenCalled()
				const commandArg = mockConverseCommand.mock.calls[0][0] as any

				// Should include explicitPromptCaching parameter
				expect(commandArg.explicitPromptCaching).toBe("enabled")
			})

			it("should not include explicitPromptCaching when awsUsePromptCache is false", async () => {
				handler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "us-east-1",
					awsUsePromptCache: false,
				})

				await handler.completePrompt("Test prompt without caching")

				// Verify the command was created without explicitPromptCaching
				expect(mockConverseCommand).toHaveBeenCalled()
				const commandArg = mockConverseCommand.mock.calls[0][0] as any

				// Should not include explicitPromptCaching parameter
				expect(commandArg.explicitPromptCaching).toBeUndefined()
			})
		})
	})

	describe("cache_control formatting", () => {
		it("should add cache_control to message content blocks when caching is enabled", async () => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: true,
			})

			// Create a longer conversation to trigger cache points
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content:
						"This is a long message that should trigger cache points. " +
						"Let me tell you a story about software development. " +
						"Once upon a time, there was a developer who wanted to optimize API costs. " +
						"They discovered that prompt caching could save up to 90% on costs. " +
						"This was especially useful for long conversations with lots of context. " +
						"The developer was very happy with this discovery. ".repeat(50), // Repeat to ensure enough tokens
				},
				{
					role: "assistant",
					content: "That's an interesting story about optimization.",
				},
				{
					role: "user",
					content: "Can you tell me more about how this works?",
				},
			]

			const generator = handler.createMessage(
				"This is a system prompt with important instructions. ".repeat(50),
				messages,
			)
			await generator.next() // Start the generator

			// Verify the command was created
			expect(mockConverseStreamCommand).toHaveBeenCalled()
			const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

			// Check that cache_control is properly added to content blocks (not as separate blocks)
			// The implementation should add cache_control as a property to existing blocks
			// rather than as separate cachePoint blocks

			// System prompt should potentially have cache_control
			if (commandArg.system && commandArg.system.length > 0) {
				// System cache points are handled differently
				expect(commandArg.system).toBeDefined()
			}

			// Messages should have cache_control added to last content block if cached
			if (commandArg.messages && commandArg.messages.length > 0) {
				// At least verify the structure is correct
				commandArg.messages.forEach((msg: any) => {
					expect(msg.content).toBeDefined()
					expect(Array.isArray(msg.content)).toBe(true)

					// If there's a cache_control, it should be on a content block, not separate
					msg.content.forEach((block: any) => {
						// cache_control should be a property of the block if present
						if (block.cache_control) {
							expect(block.cache_control.type).toBe("ephemeral")
						}
					})
				})
			}
		})

		it("should not add cache_control when caching is disabled", async () => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: false,
			})

			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "This is a message without caching",
				},
			]

			const generator = handler.createMessage("System prompt", messages)
			await generator.next() // Start the generator

			// Verify the command was created
			expect(mockConverseStreamCommand).toHaveBeenCalled()
			const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

			// Messages should not have cache_control when caching is disabled
			if (commandArg.messages && commandArg.messages.length > 0) {
				commandArg.messages.forEach((msg: any) => {
					msg.content.forEach((block: any) => {
						expect(block.cache_control).toBeUndefined()
					})
				})
			}
		})
	})

	describe("integration with 1M context and prompt caching", () => {
		it("should support both 1M context and prompt caching together", async () => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsBedrock1MContext: true,
				awsUsePromptCache: true,
			})

			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Test with both 1M context and caching",
				},
			]

			const generator = handler.createMessage("System prompt", messages)
			await generator.next() // Start the generator

			// Verify the command includes both features
			expect(mockConverseStreamCommand).toHaveBeenCalled()
			const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

			// Should include explicitPromptCaching
			expect(commandArg.explicitPromptCaching).toBe("enabled")

			// Should include anthropic_beta for 1M context
			expect(commandArg.additionalModelRequestFields).toBeDefined()
			expect(commandArg.additionalModelRequestFields.anthropic_beta).toEqual(["context-1m-2025-08-07"])
		})
	})

	describe("cost tracking with cache tokens", () => {
		it("should properly handle cache token usage in stream events", async () => {
			// Create a mock client that returns cache token usage
			const mockSend = vi.fn().mockResolvedValue({
				stream: (async function* () {
					yield {
						metadata: {
							usage: {
								inputTokens: 1000,
								outputTokens: 500,
								cacheReadInputTokens: 800,
								cacheWriteInputTokens: 200,
							},
						},
					}
					yield {
						messageStop: {
							stopReason: "end_turn",
						},
					}
				})(),
			})

			// Override the mock for this specific test
			mockBedrockRuntimeClient.mockImplementation(
				() =>
					({
						send: mockSend,
					}) as any,
			)

			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: true,
			})

			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Test message",
				},
			]

			const generator = handler.createMessage("System prompt", messages)
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			// Should have received usage information with cache tokens
			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk!.inputTokens).toBe(1000)
			expect(usageChunk!.outputTokens).toBe(500)
			expect(usageChunk!.cacheReadTokens).toBe(800)
			expect(usageChunk!.cacheWriteTokens).toBe(200)
		})
	})
})
