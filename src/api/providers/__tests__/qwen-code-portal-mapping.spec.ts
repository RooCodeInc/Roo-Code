// npx vitest run api/providers/__tests__/qwen-code-portal-mapping.spec.ts

// Mock filesystem - must come before other imports
vi.mock("node:fs", () => ({
	promises: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
}))

// Track the OpenAI client configuration
let capturedApiKey: string | undefined
let capturedBaseURL: string | undefined

const mockCreate = vi.fn()
vi.mock("openai", () => {
	return {
		__esModule: true,
		default: vi.fn().mockImplementation(() => {
			const instance = {
				_apiKey: "dummy-key-will-be-replaced",
				_baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
				get apiKey() {
					return this._apiKey
				},
				set apiKey(val: string) {
					this._apiKey = val
					capturedApiKey = val
				},
				get baseURL() {
					return this._baseURL
				},
				set baseURL(val: string) {
					this._baseURL = val
					capturedBaseURL = val
				},
				chat: {
					completions: {
						create: mockCreate,
					},
				},
			}
			return instance
		}),
	}
})

// Mock global fetch for token refresh
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

import { promises as fs } from "node:fs"
import { QwenCodeHandler } from "../qwen-code"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("QwenCodeHandler Portal URL Mapping", () => {
	let handler: QwenCodeHandler

	beforeEach(() => {
		vi.clearAllMocks()
		capturedApiKey = undefined
		capturedBaseURL = undefined
		;(fs.writeFile as any).mockResolvedValue(undefined)
	})

	function createHandlerWithCredentials(resourceUrl?: string) {
		const mockCredentials: Record<string, unknown> = {
			access_token: "test-access-token",
			refresh_token: "test-refresh-token",
			token_type: "Bearer",
			expiry_date: Date.now() + 3600000, // 1 hour from now (valid token)
		}
		if (resourceUrl !== undefined) {
			mockCredentials.resource_url = resourceUrl
		}
		;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockCredentials))

		const options: ApiHandlerOptions & { qwenCodeOauthPath?: string } = {
			apiModelId: "qwen3-coder-plus",
		}
		handler = new QwenCodeHandler(options)
		return handler
	}

	function setupStreamMock() {
		mockCreate.mockImplementationOnce(() => ({
			[Symbol.asyncIterator]: async function* () {
				yield {
					choices: [{ delta: { content: "Test response" } }],
				}
			},
		}))
	}

	describe("getBaseUrl mapping via createMessage", () => {
		it("should map portal.qwen.ai to dashscope-intl API endpoint", async () => {
			createHandlerWithCredentials("portal.qwen.ai")
			setupStreamMock()

			const stream = handler.createMessage("test prompt", [], { taskId: "test-task-id" })
			await stream.next()

			expect(capturedBaseURL).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
		})

		it("should map chat.qwen.ai to dashscope (China) API endpoint", async () => {
			createHandlerWithCredentials("chat.qwen.ai")
			setupStreamMock()

			const stream = handler.createMessage("test prompt", [], { taskId: "test-task-id" })
			await stream.next()

			expect(capturedBaseURL).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1")
		})

		it("should use default dashscope URL when resource_url is absent", async () => {
			createHandlerWithCredentials(undefined)
			setupStreamMock()

			const stream = handler.createMessage("test prompt", [], { taskId: "test-task-id" })
			await stream.next()

			expect(capturedBaseURL).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1")
		})

		it("should preserve existing dashscope URL in resource_url", async () => {
			createHandlerWithCredentials("https://dashscope.aliyuncs.com/compatible-mode/v1")
			setupStreamMock()

			const stream = handler.createMessage("test prompt", [], { taskId: "test-task-id" })
			await stream.next()

			expect(capturedBaseURL).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1")
		})

		it("should handle portal.qwen.ai with https:// prefix", async () => {
			createHandlerWithCredentials("https://portal.qwen.ai")
			setupStreamMock()

			const stream = handler.createMessage("test prompt", [], { taskId: "test-task-id" })
			await stream.next()

			expect(capturedBaseURL).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
		})
	})

	describe("OAuth token endpoint mapping via token refresh", () => {
		function createHandlerWithExpiredCredentials(resourceUrl?: string) {
			const mockCredentials: Record<string, unknown> = {
				access_token: "expired-access-token",
				refresh_token: "test-refresh-token",
				token_type: "Bearer",
				expiry_date: Date.now() - 60000, // Expired 1 minute ago
			}
			if (resourceUrl !== undefined) {
				mockCredentials.resource_url = resourceUrl
			}
			;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockCredentials))

			const options: ApiHandlerOptions & { qwenCodeOauthPath?: string } = {
				apiModelId: "qwen3-coder-plus",
			}
			handler = new QwenCodeHandler(options)
			return handler
		}

		function setupTokenRefreshMock() {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					access_token: "new-access-token",
					refresh_token: "new-refresh-token",
					token_type: "Bearer",
					expires_in: 3600,
				}),
			})
		}

		it("should use portal.qwen.ai token endpoint for portal.qwen.ai resource_url", async () => {
			createHandlerWithExpiredCredentials("portal.qwen.ai")
			setupTokenRefreshMock()
			setupStreamMock()

			const stream = handler.createMessage("test prompt", [], { taskId: "test-task-id" })
			await stream.next()

			expect(mockFetch).toHaveBeenCalledWith(
				"https://portal.qwen.ai/api/v1/oauth2/token",
				expect.objectContaining({
					method: "POST",
				}),
			)
		})

		it("should use chat.qwen.ai token endpoint for chat.qwen.ai resource_url", async () => {
			createHandlerWithExpiredCredentials("chat.qwen.ai")
			setupTokenRefreshMock()
			setupStreamMock()

			const stream = handler.createMessage("test prompt", [], { taskId: "test-task-id" })
			await stream.next()

			expect(mockFetch).toHaveBeenCalledWith(
				"https://chat.qwen.ai/api/v1/oauth2/token",
				expect.objectContaining({
					method: "POST",
				}),
			)
		})

		it("should use default chat.qwen.ai token endpoint when resource_url is absent", async () => {
			createHandlerWithExpiredCredentials(undefined)
			setupTokenRefreshMock()
			setupStreamMock()

			const stream = handler.createMessage("test prompt", [], { taskId: "test-task-id" })
			await stream.next()

			expect(mockFetch).toHaveBeenCalledWith(
				"https://chat.qwen.ai/api/v1/oauth2/token",
				expect.objectContaining({
					method: "POST",
				}),
			)
		})
	})
})
