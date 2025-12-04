import { vi, describe, it, expect, beforeEach } from "vitest"
import { AwsBedrockHandler } from "../bedrock"
import { BedrockRuntimeClient, ConverseStreamCommand, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"
import { fromIni } from "@aws-sdk/credential-providers"
import { ProviderSettings } from "@roo-code/types"

// Mock AWS SDK credential providers
vi.mock("@aws-sdk/credential-providers", () => {
	const mockFromIni = vi.fn()
	return { fromIni: mockFromIni }
})

// Mock BedrockRuntimeClient
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
	const mockSend = vi.fn()
	const BedrockRuntimeClient = vi.fn().mockImplementation(() => ({
		send: mockSend,
	}))
	const ConverseStreamCommand = vi.fn()
	const ConverseCommand = vi.fn()

	return {
		BedrockRuntimeClient,
		ConverseStreamCommand,
		ConverseCommand,
	}
})

// Mock logger to suppress log output during tests
vi.mock("../../../utils/logging", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

describe("AwsBedrockHandler - Credential Refresh", () => {
	let handler: AwsBedrockHandler
	let mockSend: any
	let mockFromIni: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Get the mocked functions
		mockFromIni = vi.mocked(fromIni)
		mockSend = vi.fn()

		// Setup BedrockRuntimeClient mock
		vi.mocked(BedrockRuntimeClient).mockImplementation(
			() =>
				({
					send: mockSend,
					config: { region: "us-east-1" },
				}) as any,
		)

		// Setup fromIni mock to return fresh credentials
		let credentialCallCount = 0
		mockFromIni.mockImplementation(() => {
			credentialCallCount++
			return {
				accessKeyId: `profile-access-key-${credentialCallCount}`,
				secretAccessKey: `profile-secret-key-${credentialCallCount}`,
			}
		})
	})

	it("should refresh credentials when receiving expired token error on streaming", async () => {
		// Setup handler with profile-based auth
		const options: ProviderSettings = {
			apiModelId: "anthropic.claude-3-sonnet-20240229-v1:0",
			awsRegion: "us-east-1",
			awsUseProfile: true,
			awsProfile: "test-profile",
		}

		handler = new AwsBedrockHandler(options)

		// First call fails with expired token error
		const expiredError = new Error("The security token included in the request is expired")
		mockSend.mockRejectedValueOnce(expiredError)

		// Second call succeeds with valid stream
		const mockStream = {
			stream: (async function* () {
				yield { messageStart: { role: "assistant" } }
				yield { contentBlockStart: { start: { text: "Hello" } } }
				yield { contentBlockDelta: { delta: { text: " world" } } }
				yield { metadata: { usage: { inputTokens: 10, outputTokens: 5 } } }
				yield { messageStop: { stopReason: "end_turn" } }
			})(),
		}
		mockSend.mockResolvedValueOnce(mockStream)

		// Execute createMessage
		const systemPrompt = "You are a helpful assistant"
		const messages = [{ role: "user" as const, content: "Hello" }]

		const chunks: any[] = []
		for await (const chunk of handler.createMessage(systemPrompt, messages)) {
			chunks.push(chunk)
		}

		// Verify that the client was recreated with fresh credentials
		expect(mockFromIni).toHaveBeenCalledTimes(2) // Initial creation + refresh
		expect(mockSend).toHaveBeenCalledTimes(2) // First failed attempt + successful retry
		expect(chunks).toContainEqual(expect.objectContaining({ type: "text", text: "Hello" }))
		expect(chunks).toContainEqual(expect.objectContaining({ type: "text", text: " world" }))
		expect(chunks).toContainEqual(expect.objectContaining({ type: "usage", inputTokens: 10, outputTokens: 5 }))
	})

	it("should refresh credentials when receiving expired token error on completePrompt", async () => {
		// Setup handler with profile-based auth
		const options: ProviderSettings = {
			apiModelId: "anthropic.claude-3-sonnet-20240229-v1:0",
			awsRegion: "us-east-1",
			awsUseProfile: true,
			awsProfile: "test-profile",
		}

		handler = new AwsBedrockHandler(options)

		// First call fails with expired token error
		const expiredError = new Error("Token has expired")
		mockSend.mockRejectedValueOnce(expiredError)

		// Second call succeeds
		mockSend.mockResolvedValueOnce({
			output: {
				message: {
					content: [{ text: "Test response" }],
				},
			},
		})

		// Execute completePrompt
		const result = await handler.completePrompt("Test prompt")

		// Verify that the client was recreated with fresh credentials
		expect(mockFromIni).toHaveBeenCalledTimes(2) // Initial creation + refresh
		expect(mockSend).toHaveBeenCalledTimes(2) // First failed attempt + successful retry
		expect(result).toBe("Test response")
	})

	it("should not refresh credentials for non-credential errors", async () => {
		// Setup handler with profile-based auth
		const options: ProviderSettings = {
			apiModelId: "anthropic.claude-3-sonnet-20240229-v1:0",
			awsRegion: "us-east-1",
			awsUseProfile: true,
			awsProfile: "test-profile",
		}

		handler = new AwsBedrockHandler(options)

		// Call fails with a different error
		const otherError = new Error("Service unavailable")
		mockSend.mockRejectedValueOnce(otherError)

		// Execute completePrompt and expect it to throw
		await expect(handler.completePrompt("Test prompt")).rejects.toThrow("Request was throttled")

		// Verify that the client was not recreated
		expect(mockFromIni).toHaveBeenCalledTimes(1) // Only initial creation
		expect(mockSend).toHaveBeenCalledTimes(1) // Only one attempt
	})

	it("should not refresh credentials when using direct credentials", async () => {
		// Setup handler with direct credentials (not profile-based)
		const options: ProviderSettings = {
			apiModelId: "anthropic.claude-3-sonnet-20240229-v1:0",
			awsRegion: "us-east-1",
			awsAccessKey: "direct-access-key",
			awsSecretKey: "direct-secret-key",
			awsSessionToken: "direct-session-token",
		}

		handler = new AwsBedrockHandler(options)

		// Call fails with expired token error
		const expiredError = new Error("The security token included in the request is expired")
		mockSend.mockRejectedValueOnce(expiredError)

		// Execute completePrompt and expect it to throw (no retry for direct credentials)
		await expect(handler.completePrompt("Test prompt")).rejects.toThrow("AWS credentials have expired")

		// Verify that the client was not recreated (fromIni not called at all since using direct creds)
		expect(mockFromIni).toHaveBeenCalledTimes(0)
		expect(mockSend).toHaveBeenCalledTimes(1) // Only one attempt
	})

	it("should handle multiple consecutive expired token errors", async () => {
		// Setup handler with profile-based auth
		const options: ProviderSettings = {
			apiModelId: "anthropic.claude-3-sonnet-20240229-v1:0",
			awsRegion: "us-east-1",
			awsUseProfile: true,
			awsProfile: "test-profile",
		}

		handler = new AwsBedrockHandler(options)

		// First two calls fail with expired token error
		const expiredError = new Error("The security token included in the request is expired")
		mockSend.mockRejectedValueOnce(expiredError)
		mockSend.mockRejectedValueOnce(expiredError)

		// Third call would succeed, but we shouldn't get there (max retries = 1)
		mockSend.mockResolvedValueOnce({
			output: {
				message: {
					content: [{ text: "Test response" }],
				},
			},
		})

		// Execute completePrompt and expect it to throw after max retries
		await expect(handler.completePrompt("Test prompt")).rejects.toThrow("AWS credentials have expired")

		// Verify that we only tried once to refresh
		expect(mockFromIni).toHaveBeenCalledTimes(2) // Initial creation + one refresh
		expect(mockSend).toHaveBeenCalledTimes(2) // Initial attempt + one retry
	})
})
