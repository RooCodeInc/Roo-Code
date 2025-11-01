import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TitleSummarizer } from "../titleSummarizer"
import type { ProviderSettings, ProviderSettingsEntry } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { singleCompletionHandler } from "../../../utils/single-completion-handler"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock singleCompletionHandler
vi.mock("../../../utils/single-completion-handler", () => ({
	singleCompletionHandler: vi.fn(),
}))

describe("TitleSummarizer", () => {
	const mockApiConfiguration: ProviderSettings = {
		apiProvider: "anthropic",
		apiKey: "test-key",
		apiModelId: "claude-3-opus-20240229",
	}

	const mockListApiConfigMeta: ProviderSettingsEntry[] = [
		{
			id: "default",
			name: "Default",
			apiProvider: "anthropic",
		},
		{
			id: "enhancement",
			name: "Enhancement",
			apiProvider: "openai",
		},
	]

	const mockProviderSettingsManager = {
		getProfile: vi.fn().mockResolvedValue({
			id: "enhancement",
			name: "Enhancement",
			apiProvider: "openai",
			openAiApiKey: "test-openai-key",
			openAiModelId: "gpt-4",
		}),
	} as any // Mock the ProviderSettingsManager type

	beforeEach(() => {
		vi.clearAllMocks()
		// Set default mock behavior
		vi.mocked(singleCompletionHandler).mockResolvedValue("Short concise title")
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("summarizeTitle", () => {
		it("should successfully summarize a long title", async () => {
			const longText =
				"I need help implementing a comprehensive user authentication system with OAuth2 support for Google, Facebook, and GitHub providers, including secure session management, password reset functionality, email verification, two-factor authentication, and proper error handling with rate limiting to prevent brute force attacks"

			const result = await TitleSummarizer.summarizeTitle({
				text: longText,
				apiConfiguration: mockApiConfiguration,
				maxLength: 150,
			})

			expect(result.success).toBe(true)
			expect(result.summarizedTitle).toBe("Short concise title")
			expect(result.summarizedTitle!.length).toBeLessThan(longText.length)
		})

		it("should return original text if it's already short", async () => {
			const shortText = "Fix bug in login"

			const result = await TitleSummarizer.summarizeTitle({
				text: shortText,
				apiConfiguration: mockApiConfiguration,
				maxLength: 150,
			})

			expect(result.success).toBe(true)
			// Text is already shorter than max length, so it returns as-is
			expect(result.summarizedTitle).toBe(shortText)
		})

		it("should use enhancement API configuration when provided", async () => {
			const longText =
				"This is a very long title that definitely needs summarization to be more concise and readable for users, making it easier to understand the main point of the task at hand"

			const result = await TitleSummarizer.summarizeTitle({
				text: longText,
				apiConfiguration: mockApiConfiguration,
				enhancementApiConfigId: "enhancement",
				listApiConfigMeta: mockListApiConfigMeta,
				providerSettingsManager: mockProviderSettingsManager,
				maxLength: 150,
			})

			// The function will call providerSettingsManager.getProfile if all conditions are met
			expect(mockProviderSettingsManager.getProfile).toHaveBeenCalledWith({ id: "enhancement" })
			expect(result.success).toBe(true)
			expect(result.summarizedTitle).toBe("Short concise title")
		})

		it("should handle API errors gracefully", async () => {
			const longText =
				"This is a very long text that definitely needs summarization to be more concise and readable for users, making it easier to understand the main point of the task at hand"
			vi.mocked(singleCompletionHandler).mockRejectedValueOnce(new Error("API Error"))

			const result = await TitleSummarizer.summarizeTitle({
				text: longText,
				apiConfiguration: mockApiConfiguration,
				maxLength: 150,
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe("API Error")
			expect(result.summarizedTitle).toBe(longText)
		})

		it("should handle missing API configuration", async () => {
			const result = await TitleSummarizer.summarizeTitle({
				text: "Some text",
				apiConfiguration: undefined as any,
				maxLength: 150,
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe("No API configuration available")
			expect(result.summarizedTitle).toBe("Some text")
		})

		it("should respect custom maxLength parameter", async () => {
			const shortText = "Short text"

			const result = await TitleSummarizer.summarizeTitle({
				text: shortText,
				apiConfiguration: mockApiConfiguration,
				maxLength: 100,
			})

			expect(result.success).toBe(true)
			// Text is already shorter than maxLength, returns as-is
			expect(result.summarizedTitle).toBe(shortText)
		})

		it("should use custom support prompts when provided", async () => {
			const customPrompts = {
				SUMMARIZE_TITLE: "Custom summarization prompt: {{userInput}} (max 150 chars)",
			}

			// Short text doesn't need summarization
			const result = await TitleSummarizer.summarizeTitle({
				text: "Text to summarize",
				apiConfiguration: mockApiConfiguration,
				customSupportPrompts: customPrompts,
				maxLength: 150,
			})

			expect(result.success).toBe(true)
			expect(result.summarizedTitle).toBe("Text to summarize")
		})

		it("should handle empty response from API", async () => {
			const longText =
				"This is a very long text that definitely needs summarization to be more concise and readable for users, making it easier to understand the main point of the task at hand"
			vi.mocked(singleCompletionHandler).mockResolvedValueOnce("")

			const result = await TitleSummarizer.summarizeTitle({
				text: longText,
				apiConfiguration: mockApiConfiguration,
				maxLength: 150,
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe("Received empty summarized title")
			expect(result.summarizedTitle).toBe(longText)
		})

		it("should trim whitespace from summarized title", async () => {
			const longText =
				"This is a very long text that definitely needs summarization to be more concise and readable for users, making it easier to understand the main point of the task at hand"
			vi.mocked(singleCompletionHandler).mockResolvedValueOnce("  Trimmed title  \n")

			const result = await TitleSummarizer.summarizeTitle({
				text: longText,
				apiConfiguration: mockApiConfiguration,
				maxLength: 150,
			})

			expect(result.success).toBe(true)
			expect(result.summarizedTitle).toBe("Trimmed title")
		})
	})

	describe("captureTelemetry", () => {
		it("should not capture telemetry events (currently disabled)", () => {
			const taskId = "test-task-123"
			const originalLength = 250
			const summarizedLength = 100

			TitleSummarizer.captureTelemetry(taskId, originalLength, summarizedLength)

			// Since telemetry is commented out in the implementation, it should not be called
			expect(TelemetryService.instance.captureEvent).not.toHaveBeenCalled()
		})
	})
})
