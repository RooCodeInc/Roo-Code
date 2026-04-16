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

	it("should pass enable_thinking: false in the request", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: "Enhanced text",
					},
				},
			],
		})

		await handler.completePrompt("Enhance this prompt")

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				enable_thinking: false,
			}),
		)
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

	it("should fall back to reasoning_content when content is empty", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: "",
						reasoning_content: "The actual enhanced prompt text from reasoning.",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("The actual enhanced prompt text from reasoning.")
	})

	it("should fall back to reasoning_content when content is null", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: null,
						reasoning_content: "Enhanced prompt from reasoning_content field.",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("Enhanced prompt from reasoning_content field.")
	})

	it("should return empty string when both content and reasoning_content are empty", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: "",
						reasoning_content: "",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("")
	})

	it("should handle response with only <think> blocks (content becomes empty after stripping)", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: "<think>Only thinking, no actual content</think>",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("")
	})

	it("should handle multiline <think> blocks", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content:
							"<think>\nStep 1: Analyze the prompt\nStep 2: Enhance it\nStep 3: Return result\n</think>\nHere is the enhanced prompt.",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("Here is the enhanced prompt.")
	})

	it("should prefer content over reasoning_content when content is non-empty", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: "The actual content response.",
						reasoning_content: "Some reasoning that should be ignored.",
					},
				},
			],
		})

		const result = await handler.completePrompt("Enhance this prompt")
		expect(result).toBe("The actual content response.")
	})
})
