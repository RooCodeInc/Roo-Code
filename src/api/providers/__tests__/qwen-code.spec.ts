import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { QwenCodeHandler } from "../qwen-code"
import { promises as fs } from "node:fs"
import OpenAI from "openai"

// Mock fs module
vi.mock("node:fs", () => ({
	promises: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
}))

// Mock OpenAI
vi.mock("openai", () => {
	const mockCreate = vi.fn()
	return {
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		})),
	}
})

// Mock fetch for OAuth token refresh
global.fetch = vi.fn()

describe("QwenCodeHandler", () => {
	let handler: QwenCodeHandler
	const mockCredentials = {
		access_token: "test-access-token",
		refresh_token: "test-refresh-token",
		token_type: "Bearer",
		expiry_date: Date.now() + 3600000, // 1 hour from now
		resource_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
	}

	beforeEach(() => {
		vi.clearAllMocks()
		// Mock reading credentials file
		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCredentials))
		vi.mocked(fs.writeFile).mockResolvedValue(undefined)

		handler = new QwenCodeHandler({
			apiModelId: "qwen-max",
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Error Handling", () => {
		it("should handle 400 errors with user-friendly message", async () => {
			const mockClient = new OpenAI({ apiKey: "test" })
			const mockError = {
				status: 400,
				message: "Invalid request format",
			}

			vi.mocked(mockClient.chat.completions.create).mockRejectedValue(mockError)

			// Override the ensureClient method to return our mock
			handler["client"] = mockClient

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"Qwen API Error (400): Invalid request format. This may be due to invalid input format, unsupported file type, or request size limits.",
			)
		})

		it("should handle 401 errors and attempt token refresh", async () => {
			const mockClient = new OpenAI({ apiKey: "test" })
			const mockError = {
				status: 401,
				message: "Unauthorized",
			}

			// First call fails with 401, second succeeds after refresh
			vi.mocked(mockClient.chat.completions.create)
				.mockRejectedValueOnce(mockError)
				.mockResolvedValueOnce({
					choices: [{ message: { content: "Success after refresh" } }],
				} as any)

			// Mock successful token refresh
			vi.mocked(global.fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					access_token: "new-access-token",
					token_type: "Bearer",
					expires_in: 3600,
					refresh_token: "new-refresh-token",
				}),
			} as any)

			handler["client"] = mockClient

			const result = await handler.completePrompt("test prompt")
			expect(result).toBe("Success after refresh")
			expect(global.fetch).toHaveBeenCalledTimes(1)
		})

		it("should handle 403 errors with permission message", async () => {
			const mockClient = new OpenAI({ apiKey: "test" })
			const mockError = {
				status: 403,
				message: "Access denied",
			}

			vi.mocked(mockClient.chat.completions.create).mockRejectedValue(mockError)
			handler["client"] = mockClient

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"Qwen API Error (403): Access denied. Please check your API permissions.",
			)
		})

		it("should handle 429 rate limit errors", async () => {
			const mockClient = new OpenAI({ apiKey: "test" })
			const mockError = {
				status: 429,
				message: "Too many requests",
			}

			vi.mocked(mockClient.chat.completions.create).mockRejectedValue(mockError)
			handler["client"] = mockClient

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"Qwen API Error (429): Too many requests. Please wait before making more requests.",
			)
		})

		it("should handle 500+ server errors", async () => {
			const mockClient = new OpenAI({ apiKey: "test" })
			const mockError = {
				status: 503,
				message: "Service unavailable",
			}

			vi.mocked(mockClient.chat.completions.create).mockRejectedValue(mockError)
			handler["client"] = mockClient

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"Qwen API Error (503): Service unavailable. The Qwen service may be temporarily unavailable.",
			)
		})

		it("should handle generic errors with context", async () => {
			const mockClient = new OpenAI({ apiKey: "test" })
			const mockError = new Error("Network timeout")

			vi.mocked(mockClient.chat.completions.create).mockRejectedValue(mockError)
			handler["client"] = mockClient

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"Failed to complete prompt with Qwen model: Network timeout",
			)
		})

		it("should preserve already formatted Qwen API errors", async () => {
			const mockClient = new OpenAI({ apiKey: "test" })
			const mockError = new Error("Qwen API Error (400): Already formatted error")

			vi.mocked(mockClient.chat.completions.create).mockRejectedValue(mockError)
			handler["client"] = mockClient

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"Qwen API Error (400): Already formatted error",
			)
		})
	})

	describe("Model Configuration", () => {
		it("should return correct model info", () => {
			const model = handler.getModel()
			expect(model.id).toBe("qwen-max")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBeGreaterThan(0)
		})

		it("should use default model when not specified", () => {
			const defaultHandler = new QwenCodeHandler({})
			const model = defaultHandler.getModel()
			expect(model.id).toBeDefined()
			expect(model.info).toBeDefined()
		})
	})
})
