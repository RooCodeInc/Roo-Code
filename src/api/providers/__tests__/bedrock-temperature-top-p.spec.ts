// npx vitest run src/api/providers/__tests__/bedrock-temperature-top-p.spec.ts

import { vi, describe, it, expect, beforeEach } from "vitest"
import { AwsBedrockHandler } from "../bedrock"
import { ConverseStreamCommand, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"
import type { Anthropic } from "@anthropic-ai/sdk"

// Mock AWS SDK credential providers
vi.mock("@aws-sdk/credential-providers", () => ({
	fromIni: vi.fn().mockReturnValue({
		accessKeyId: "test-access-key",
		secretAccessKey: "test-secret-key",
	}),
}))

// Mock BedrockRuntimeClient
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
	const mockSend = vi.fn().mockResolvedValue({
		stream: [],
		output: {
			message: {
				content: [{ text: "Test response" }],
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

const mockConverseStreamCommand = vi.mocked(ConverseStreamCommand)
const mockConverseCommand = vi.mocked(ConverseCommand)

describe("Bedrock temperature and topP handling", () => {
	let handler: AwsBedrockHandler

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Claude Sonnet 4.5 (3.5 v2) model", () => {
		beforeEach(() => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-sonnet-4-5-20250929-v1:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				modelTemperature: 0.7,
			})
		})

		it("should only send temperature and not topP in createMessage when thinking is disabled", async () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Test message",
				},
			]

			const generator = handler.createMessage("", messages)
			await generator.next()

			expect(mockConverseStreamCommand).toHaveBeenCalled()
			const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

			// Should have temperature but not topP
			expect(commandArg.inferenceConfig).toBeDefined()
			expect(commandArg.inferenceConfig.temperature).toBe(0.7)
			expect(commandArg.inferenceConfig.topP).toBeUndefined()
		})

		it("should only send temperature and not topP in completePrompt", async () => {
			await handler.completePrompt("Test prompt")

			expect(mockConverseCommand).toHaveBeenCalled()
			const commandArg = mockConverseCommand.mock.calls[0][0] as any

			// Should have temperature but not topP
			expect(commandArg.inferenceConfig).toBeDefined()
			expect(commandArg.inferenceConfig.temperature).toBe(0.7)
			expect(commandArg.inferenceConfig.topP).toBeUndefined()
		})
	})

	describe("Other Bedrock models", () => {
		beforeEach(() => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				modelTemperature: 0.7,
			})
		})

		it("should only send temperature and not topP for Claude 3.5 Sonnet", async () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Test message",
				},
			]

			const generator = handler.createMessage("", messages)
			await generator.next()

			expect(mockConverseStreamCommand).toHaveBeenCalled()
			const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

			// Should have temperature but not topP
			expect(commandArg.inferenceConfig).toBeDefined()
			expect(commandArg.inferenceConfig.temperature).toBe(0.7)
			expect(commandArg.inferenceConfig.topP).toBeUndefined()
		})
	})

	describe("Models with thinking enabled", () => {
		beforeEach(() => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				modelTemperature: 0.7,
				enableReasoningEffort: true,
			})
		})

		it("should only send temperature when thinking is enabled", async () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Test message",
				},
			]

			const metadata = {
				taskId: "test-task-id",
				thinking: {
					enabled: true,
					maxThinkingTokens: 4096,
				},
			}

			const generator = handler.createMessage("", messages, metadata as any)
			await generator.next()

			expect(mockConverseStreamCommand).toHaveBeenCalled()
			const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

			// Should have temperature but not topP when thinking is enabled
			expect(commandArg.inferenceConfig).toBeDefined()
			// Temperature is overridden to 1.0 when reasoning is enabled
			expect(commandArg.inferenceConfig.temperature).toBe(1.0)
			expect(commandArg.inferenceConfig.topP).toBeUndefined()
		})
	})

	describe("Default temperature handling", () => {
		it("should use default temperature when not specified", async () => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-sonnet-4-5-20250929-v1:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				// No modelTemperature specified
			})

			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Test message",
				},
			]

			const generator = handler.createMessage("", messages)
			await generator.next()

			expect(mockConverseStreamCommand).toHaveBeenCalled()
			const commandArg = mockConverseStreamCommand.mock.calls[0][0] as any

			// Should have default temperature (0.3) but not topP
			expect(commandArg.inferenceConfig).toBeDefined()
			expect(commandArg.inferenceConfig.temperature).toBe(0.3) // BEDROCK_DEFAULT_TEMPERATURE
			expect(commandArg.inferenceConfig.topP).toBeUndefined()
		})
	})
})
