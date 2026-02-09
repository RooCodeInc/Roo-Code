// cd src && npx vitest run api/providers/__tests__/openai-codex-native-tool-calls.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: vi.fn(() => {
		const provider = vi.fn(() => ({
			modelId: "gpt-5.2-2025-12-11",
			provider: "openai",
		}))
		;(provider as any).responses = vi.fn(() => ({
			modelId: "gpt-5.2-2025-12-11",
			provider: "openai.responses",
		}))
		return provider
	}),
}))

import { OpenAiCodexHandler } from "../openai-codex"
import type { ApiHandlerOptions } from "../../../shared/api"
import { openAiCodexOAuthManager } from "../../../integrations/openai-codex/oauth"

describe("OpenAiCodexHandler native tool calls", () => {
	let handler: OpenAiCodexHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		vi.restoreAllMocks()

		mockOptions = {
			apiModelId: "gpt-5.2-2025-12-11",
		}
		handler = new OpenAiCodexHandler(mockOptions)
	})

	it("yields tool_call_start, tool_call_delta, and tool_call_end chunks for tool calls via AI SDK", async () => {
		vi.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue("test-token")
		vi.spyOn(openAiCodexOAuthManager, "getAccountId").mockResolvedValue("acct_test")

		async function* mockFullStream() {
			yield {
				type: "tool-input-start",
				id: "call_1",
				toolName: "attempt_completion",
			}
			yield {
				type: "tool-input-delta",
				id: "call_1",
				delta: '{"result":"hi"}',
			}
			yield {
				type: "tool-input-end",
				id: "call_1",
			}
		}

		mockStreamText.mockReturnValue({
			fullStream: mockFullStream(),
			usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }),
			providerMetadata: Promise.resolve({
				openai: { responseId: "resp_1" },
			}),
			content: Promise.resolve([]),
		})

		const stream = handler.createMessage("system", [{ role: "user", content: "hello" } as any], {
			taskId: "t",
			tools: [],
		})

		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		const startChunks = chunks.filter((c) => c.type === "tool_call_start")
		expect(startChunks.length).toBe(1)
		expect(startChunks[0]).toMatchObject({
			type: "tool_call_start",
			id: "call_1",
			name: "attempt_completion",
		})

		const deltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
		expect(deltaChunks.length).toBe(1)
		expect(deltaChunks[0]).toMatchObject({
			type: "tool_call_delta",
			id: "call_1",
			delta: '{"result":"hi"}',
		})

		const endChunks = chunks.filter((c) => c.type === "tool_call_end")
		expect(endChunks.length).toBe(1)
		expect(endChunks[0]).toMatchObject({
			type: "tool_call_end",
			id: "call_1",
		})
	})

	it("retries on auth failure and succeeds on second attempt", async () => {
		vi.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue("expired-token")
		vi.spyOn(openAiCodexOAuthManager, "getAccountId").mockResolvedValue("acct_test")
		vi.spyOn(openAiCodexOAuthManager, "forceRefreshAccessToken").mockResolvedValue("fresh-token")

		let callCount = 0
		mockStreamText.mockImplementation(() => {
			callCount++
			if (callCount === 1) {
				const error = new Error("unauthorized")
				;(error as any).status = 401
				throw error
			}

			async function* mockFullStream() {
				yield { type: "text-delta", text: "success" }
			}

			return {
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }),
				providerMetadata: Promise.resolve({
					openai: { responseId: "resp_retry" },
				}),
				content: Promise.resolve([]),
			}
		})

		const stream = handler.createMessage("system", [{ role: "user", content: "hello" } as any], {
			taskId: "t",
			tools: [],
		})

		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		expect(callCount).toBe(2)
		expect(openAiCodexOAuthManager.forceRefreshAccessToken).toHaveBeenCalledOnce()

		const textChunks = chunks.filter((c) => c.type === "text")
		expect(textChunks.length).toBe(1)
		expect(textChunks[0].text).toBe("success")
	})

	it("yields usage with totalCost 0 for subscription pricing", async () => {
		vi.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue("test-token")
		vi.spyOn(openAiCodexOAuthManager, "getAccountId").mockResolvedValue("acct_test")

		async function* mockFullStream() {
			yield { type: "text-delta", text: "response" }
		}

		mockStreamText.mockReturnValue({
			fullStream: mockFullStream(),
			usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
			providerMetadata: Promise.resolve({
				openai: { responseId: "resp_usage" },
			}),
			content: Promise.resolve([]),
		})

		const stream = handler.createMessage("system", [{ role: "user", content: "hello" } as any], {
			taskId: "t",
			tools: [],
		})

		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		const usageChunks = chunks.filter((c) => c.type === "usage")
		expect(usageChunks.length).toBe(1)
		expect(usageChunks[0]).toMatchObject({
			type: "usage",
			inputTokens: 100,
			outputTokens: 50,
			totalCost: 0,
		})
	})
})
