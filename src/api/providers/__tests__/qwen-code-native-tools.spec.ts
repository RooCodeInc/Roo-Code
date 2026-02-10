import type { RooMessage } from "../../../core/task-persistence/rooMessage"
// npx vitest run api/providers/__tests__/qwen-code-native-tools.spec.ts

const {
	mockStreamText,
	mockGenerateText,
	mockWrapLanguageModel,
	mockExtractReasoningMiddleware,
	mockCreateOpenAICompatible,
	mockSafeWriteJson,
} = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockWrapLanguageModel: vi.fn((opts: { model: unknown }) => opts.model),
	mockExtractReasoningMiddleware: vi.fn(() => ({})),
	mockCreateOpenAICompatible: vi.fn(),
	mockSafeWriteJson: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
		wrapLanguageModel: mockWrapLanguageModel,
		extractReasoningMiddleware: mockExtractReasoningMiddleware,
	}
})

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: mockCreateOpenAICompatible,
}))

vi.mock("node:fs", () => ({
	promises: {
		readFile: vi.fn(),
	},
}))

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: mockSafeWriteJson,
}))

import type { Anthropic } from "@anthropic-ai/sdk"
import { qwenCodeDefaultModelId, qwenCodeModels, type QwenCodeModelId } from "@roo-code/types"

import { promises as fs } from "node:fs"
import * as path from "node:path"

import { QwenCodeHandler, type QwenCodeHandlerOptions } from "../qwen-code"
import { safeWriteJson } from "../../../utils/safeWriteJson"

type QwenCredentials = {
	access_token: string
	refresh_token: string
	token_type: string
	expiry_date: number
	resource_url?: string
}

type MutableQwenHandler = {
	credentials: QwenCredentials | null
}

class TestableQwenCodeHandler extends QwenCodeHandler {
	public getLanguageModelForTest() {
		return this.getLanguageModel()
	}
}

function buildCredentials(overrides: Partial<QwenCredentials> = {}): QwenCredentials {
	return {
		access_token: "test-access-token",
		refresh_token: "test-refresh-token",
		token_type: "Bearer",
		expiry_date: Date.now() + 60 * 60 * 1000,
		resource_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		...overrides,
	}
}

function createFetchResponse(params: {
	ok: boolean
	status?: number
	statusText?: string
	jsonBody?: unknown
	textBody?: string
}): Response {
	return {
		ok: params.ok,
		status: params.status ?? (params.ok ? 200 : 500),
		statusText: params.statusText ?? "",
		json: async () => params.jsonBody,
		text: async () => params.textBody ?? "",
	} as unknown as Response
}

function createFullStream(parts: unknown[]): AsyncGenerator<unknown, void, unknown> {
	return (async function* () {
		for (const part of parts) {
			yield part
		}
	})()
}

async function collectStreamChunks(stream: AsyncGenerator<unknown, void, unknown>): Promise<unknown[]> {
	const chunks: unknown[] = []
	for await (const chunk of stream) {
		chunks.push(chunk)
	}
	return chunks
}

describe("QwenCodeHandler (AI SDK)", () => {
	let fetchMock: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()

		fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)

		mockCreateOpenAICompatible.mockImplementation((config: { name: string; baseURL: string; apiKey: string }) => {
			return vi.fn((modelId: string) => ({
				modelId,
				provider: config.name,
				baseURL: config.baseURL,
				apiKey: config.apiKey,
			}))
		})

		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(buildCredentials()))
		vi.mocked(safeWriteJson).mockResolvedValue(undefined)
		mockGenerateText.mockResolvedValue({ text: "ok" })
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("constructs successfully with valid options", () => {
		const handler = new QwenCodeHandler({ apiModelId: "qwen3-coder-plus" })
		expect(handler).toBeInstanceOf(QwenCodeHandler)
	})

	it("getModel returns default model when apiModelId is not provided", () => {
		const handler = new QwenCodeHandler({})
		const model = handler.getModel()

		expect(model.id).toBe(qwenCodeDefaultModelId)
		expect(model.info).toEqual(qwenCodeModels[qwenCodeDefaultModelId as QwenCodeModelId])
	})

	it("getModel returns custom model ID and info", () => {
		const customModelId: QwenCodeModelId = "qwen3-coder-plus"
		const handler = new QwenCodeHandler({ apiModelId: customModelId })
		const model = handler.getModel()

		expect(model.id).toBe(customModelId)
		expect(model.info).toEqual(qwenCodeModels[customModelId])
	})

	it("isAiSdkProvider returns true", () => {
		const handler = new QwenCodeHandler({ apiModelId: "qwen3-coder-plus" })
		expect(handler.isAiSdkProvider()).toBe(true)
	})

	it("loads OAuth credentials from file before completing prompt", async () => {
		const oauthPath = "/tmp/qwen/oauth_creds.json"
		const handler = new QwenCodeHandler({
			apiModelId: "qwen3-coder-plus",
			qwenCodeOauthPath: oauthPath,
		})

		const result = await handler.completePrompt("Hello")

		expect(result).toBe("ok")
		expect(fs.readFile).toHaveBeenCalledWith(path.resolve(oauthPath), "utf-8")
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("refreshes access token when credentials are expired", async () => {
		const oauthPath = "/tmp/qwen/expired_creds.json"
		vi.mocked(fs.readFile).mockResolvedValue(
			JSON.stringify(
				buildCredentials({
					expiry_date: Date.now() - 60_000,
					resource_url: "dashscope.aliyuncs.com/compatible-mode",
				}),
			),
		)

		fetchMock.mockResolvedValue(
			createFetchResponse({
				ok: true,
				jsonBody: {
					access_token: "refreshed-access-token",
					refresh_token: "refreshed-refresh-token",
					token_type: "Bearer",
					expires_in: 3600,
				},
			}),
		)

		const handler = new QwenCodeHandler({ apiModelId: "qwen3-coder-plus", qwenCodeOauthPath: oauthPath })

		const result = await handler.completePrompt("Refresh now")
		expect(result).toBe("ok")

		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [refreshUrl, refreshInit] = fetchMock.mock.calls[0] as [string, RequestInit]
		expect(refreshUrl).toBe("https://chat.qwen.ai/api/v1/oauth2/token")
		expect(refreshInit.method).toBe("POST")
		expect(String(refreshInit.body)).toContain("grant_type=refresh_token")
		expect(String(refreshInit.body)).toContain("refresh_token=test-refresh-token")
		expect(String(refreshInit.body)).toContain("client_id=f0304373b74a44d2b584a3fb70ca9e56")

		expect(safeWriteJson).toHaveBeenCalledWith(
			path.resolve(oauthPath),
			expect.objectContaining({
				access_token: "refreshed-access-token",
				refresh_token: "refreshed-refresh-token",
				token_type: "Bearer",
			}),
		)

		expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
				apiKey: "refreshed-access-token",
			}),
		)
	})

	it("retries createMessage once after 401 by refreshing token", async () => {
		const oauthPath = "/tmp/qwen/retry_creds.json"
		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(buildCredentials({ access_token: "stale-token" })))

		fetchMock.mockResolvedValue(
			createFetchResponse({
				ok: true,
				jsonBody: {
					access_token: "fresh-token",
					refresh_token: "fresh-refresh-token",
					token_type: "Bearer",
					expires_in: 3600,
				},
			}),
		)

		const unauthorizedError = new Error("Unauthorized")
		Object.assign(unauthorizedError, { status: 401 })

		mockStreamText
			.mockImplementationOnce(() => {
				throw unauthorizedError
			})
			.mockReturnValueOnce({
				fullStream: createFullStream([{ type: "text-delta", text: "Recovered response" }]),
				usage: Promise.resolve({ inputTokens: 11, outputTokens: 7 }),
			})

		const handler = new QwenCodeHandler({ apiModelId: "qwen3-coder-plus", qwenCodeOauthPath: oauthPath })
		const messages: RooMessage[] = [{ role: "user", content: "Hi" }]

		const chunks = await collectStreamChunks(handler.createMessage("System", messages))

		expect(mockStreamText).toHaveBeenCalledTimes(2)
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(chunks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "text", text: "Recovered response" }),
				expect.objectContaining({ type: "usage", inputTokens: 11, outputTokens: 7 }),
			]),
		)
	})

	it("createMessage yields expected stream chunk types from AI SDK streamText", async () => {
		mockStreamText.mockReturnValue({
			fullStream: createFullStream([
				{ type: "reasoning-delta", text: "Thinking..." },
				{ type: "text-delta", text: "Answer" },
				{ type: "tool-input-start", id: "tool-1", toolName: "read_file" },
				{ type: "tool-input-delta", id: "tool-1", delta: '{"path":"a.ts"}' },
				{ type: "tool-input-end", id: "tool-1" },
				{ type: "finish", finishReason: "stop" },
			]),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
		})

		const handler = new QwenCodeHandler({ apiModelId: "qwen3-coder-plus" })
		const messages: RooMessage[] = [{ role: "user", content: "Hello" }]

		const chunks = await collectStreamChunks(handler.createMessage("System", messages))

		expect(chunks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "reasoning", text: "Thinking..." }),
				expect.objectContaining({ type: "text", text: "Answer" }),
				expect.objectContaining({ type: "tool_call_start", id: "tool-1", name: "read_file" }),
				expect.objectContaining({ type: "tool_call_delta", id: "tool-1", delta: '{"path":"a.ts"}' }),
				expect.objectContaining({ type: "tool_call_end", id: "tool-1" }),
				expect.objectContaining({ type: "usage", inputTokens: 10, outputTokens: 5 }),
			]),
		)
	})

	it("completePrompt returns generated text", async () => {
		mockGenerateText.mockResolvedValue({ text: "Completion text" })
		const handler = new QwenCodeHandler({ apiModelId: "qwen3-coder-plus" })

		const result = await handler.completePrompt("Complete this")

		expect(result).toBe("Completion text")
		expect(mockGenerateText).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: "Complete this",
			}),
		)
	})

	it("getLanguageModel creates a fresh provider using current OAuth credentials", () => {
		const handler = new TestableQwenCodeHandler({ apiModelId: "qwen3-coder-plus" })
		const mutable = handler as unknown as MutableQwenHandler

		mutable.credentials = buildCredentials({
			access_token: "token-1",
			resource_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		})
		handler.getLanguageModelForTest()

		mutable.credentials = buildCredentials({
			access_token: "token-2",
			resource_url: "dashscope.aliyuncs.com/compatible-mode",
		})
		handler.getLanguageModelForTest()

		expect(mockCreateOpenAICompatible).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				apiKey: "pending-oauth",
				baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			}),
		)
		expect(mockCreateOpenAICompatible).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				apiKey: "token-1",
				baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			}),
		)
		expect(mockCreateOpenAICompatible).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				apiKey: "token-2",
				baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			}),
		)
	})

	it("uses wrapLanguageModel with reasoning middleware", async () => {
		mockStreamText.mockReturnValue({
			fullStream: createFullStream([{ type: "text-delta", text: "ok" }]),
			usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }),
		})

		const handler = new QwenCodeHandler({ apiModelId: "qwen3-coder-plus" })
		const messages: RooMessage[] = [{ role: "user", content: "Hello" }]

		await collectStreamChunks(handler.createMessage("System", messages))

		expect(mockExtractReasoningMiddleware).toHaveBeenCalledWith({ tagName: "think" })
		expect(mockWrapLanguageModel).toHaveBeenCalledWith(
			expect.objectContaining({
				middleware: expect.any(Object),
			}),
		)
	})
})
