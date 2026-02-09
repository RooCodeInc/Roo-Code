// cd src && npx vitest run api/providers/__tests__/openai-codex-native-tool-calls.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockCreateOpenAI, mockCaptureException } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockCreateOpenAI: vi.fn(),
	mockCaptureException: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
	}
})

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: mockCreateOpenAI.mockImplementation(() => ({
		responses: vi.fn(() => ({
			modelId: "gpt-5.2-2025-12-11",
			provider: "openai.responses",
		})),
	})),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: (...args: unknown[]) => mockCaptureException(...args),
		},
	},
}))

import { beforeEach, describe, expect, it, vi } from "vitest"

import { OpenAiCodexHandler } from "../openai-codex"
import type { ApiHandlerOptions } from "../../../shared/api"
import { NativeToolCallParser } from "../../../core/assistant-message/NativeToolCallParser"
import { openAiCodexOAuthManager } from "../../../integrations/openai-codex/oauth"

describe("OpenAiCodexHandler native tool calls", () => {
	let handler: OpenAiCodexHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		vi.clearAllMocks()
		NativeToolCallParser.clearRawChunkState()
		NativeToolCallParser.clearAllStreamingToolCalls()

		mockOptions = {
			apiModelId: "gpt-5.2-2025-12-11",
			// minimal settings; OAuth is mocked below
		}
		handler = new OpenAiCodexHandler(mockOptions)
	})

	it("yields tool_call_start and tool_call_delta chunks when API returns function_call-only response", async () => {
		vi.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue("test-token")
		vi.spyOn(openAiCodexOAuthManager, "getAccountId").mockResolvedValue("acct_test")

		// Mock AI SDK streamText to return tool-call stream parts
		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "tool-input-start" as const, id: "call_1", toolName: "attempt_completion" }
				yield { type: "tool-input-delta" as const, id: "call_1", delta: '{"result":"hi"}' }
			})(),
			usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

		const stream = handler.createMessage("system", [{ role: "user", content: "hello" } as any], {
			taskId: "t",
			tools: [],
		})

		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
			if (chunk.type === "tool_call_partial") {
				// Simulate Task.ts behavior so finish_reason handling can emit tool_call_end elsewhere
				NativeToolCallParser.processRawChunk({
					index: chunk.index,
					id: chunk.id,
					name: chunk.name,
					arguments: chunk.arguments,
				})
			}
		}

		// AI SDK emits tool-input-start → tool_call_start, tool-input-delta → tool_call_delta
		const toolStartChunks = chunks.filter((c) => c.type === "tool_call_start")
		const toolDeltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
		expect(toolStartChunks.length).toBeGreaterThan(0)
		expect(toolStartChunks[0]).toMatchObject({
			type: "tool_call_start",
			id: "call_1",
			name: "attempt_completion",
		})
		expect(toolDeltaChunks.length).toBeGreaterThan(0)
		expect(toolDeltaChunks[0]).toMatchObject({
			type: "tool_call_delta",
			id: "call_1",
			delta: '{"result":"hi"}',
		})
	})
})
