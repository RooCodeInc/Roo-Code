// npx vitest run api/providers/__tests__/qwen-code-complete-prompt.spec.ts

// Mock filesystem - must come before other imports
vi.mock("node:fs", () => ({
	promises: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
}))

const mockCreate = vi.fn()
vi.mock("openai", () => {
	return {
		__esModule: true,
		default: vi.fn().mockImplementation(() => ({
			apiKey: "test-key",
			baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		})),
	}
})

import { promises as fs } from "node:fs"
import { QwenCodeHandler } from "../qwen-code"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("QwenCodeHandler completePrompt", () => {
	let handler: QwenCodeHandler
	let mockOptions: ApiHandlerOptions & { qwenCodeOauthPath?: string }

	const validCredentials = {
		access_token: "test-access-token",
		refresh_token: "test-refresh-token",
		token_type: "Bearer",
		expiry_date: Date.now() + 3600000,
		resource_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
	}

	beforeEach(() => {
		vi.clearAllMocks()

		mockOptions = {
			apiModelId: "qwen3-coder-plus",
			qwenCodeOauthPath: "/tmp/test-creds.json",
		}

		handler = new QwenCodeHandler(mockOptions)
		;(fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(validCredentials))
	})

	it("should return plain text content as-is", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: "Here is your enhanced prompt with more details.",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("Here is your enhanced prompt with more details.")
	})

	it("should strip <think> blocks from response content", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content:
							"<think>Let me analyze this prompt and think about how to enhance it...</think>Here is your enhanced prompt with more details.",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("Here is your enhanced prompt with more details.")
	})

	it("should strip multiple <think> blocks from response content", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: "<think>First thought...</think>Part one. <think>Second thought...</think>Part two.",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("Part one. Part two.")
	})

	it("should handle multiline <think> blocks", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content:
							"<think>\nLet me think about this.\nI need to consider multiple things.\n</think>\nThe enhanced prompt.",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("The enhanced prompt.")
	})

	it("should return empty string when content is only a think block", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: "<think>Only thinking, no actual content.</think>",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("")
	})

	it("should return empty string when message content is null", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: null,
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("")
	})
})
