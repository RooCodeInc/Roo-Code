import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { Anthropic } from "@anthropic-ai/sdk"

import type { ApiStreamChunk } from "../../transform/stream"
import type { ApiHandlerCreateMessageMetadata } from "../../index"
import type { ApiHandlerOptions } from "../../../shared/api"
import { OpenAiNativeHandler } from "../openai-native"

const createSessionMock = vi.hoisted(() => vi.fn())

vi.mock("openai", () => {
	return {
		__esModule: true,
		default: vi.fn().mockImplementation(() => ({
			responses: {
				create: vi.fn(),
			},
		})),
	}
})

vi.mock("../../../integrations/codex/run", () => ({
	CodexCliSession: {
		create: createSessionMock,
	},
}))

import { CodexHandler } from "../codex"

const systemPrompt = "You are Codex."

const defaultOptions: ApiHandlerOptions = {
	apiModelId: "gpt-5-codex",
	openAiNativeApiKey: "test-api-key",
}

const metadata: ApiHandlerCreateMessageMetadata = {
	taskId: "task-123",
}

const makeSession = (chunks: ApiStreamChunk[]) => ({
	runTurn: vi.fn().mockResolvedValue(asyncGeneratorFromChunks(chunks)),
	shutdown: vi.fn().mockResolvedValue(undefined),
})

function asyncGeneratorFromChunks(chunks: ApiStreamChunk[]): AsyncGenerator<ApiStreamChunk> {
	return (async function* () {
		for (const chunk of chunks) {
			yield chunk
		}
	})()
}

describe("CodexHandler", () => {
	let handler: CodexHandler
	let fallbackSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		createSessionMock.mockReset()
		fallbackSpy = vi.spyOn(OpenAiNativeHandler.prototype, "createMessage").mockImplementation(async function* () {
			yield { type: "text", text: "[fallback]" }
		})
		handler = new CodexHandler(defaultOptions)
	})

	afterEach(() => {
		fallbackSpy.mockRestore()
	})

	it("omits duplicate prefix chunks before streaming new Codex output", async () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{ role: "user", content: "Initial request" },
			{ role: "assistant", content: "Task completed successfully." },
			{ role: "user", content: "Please continue" },
		]

		createSessionMock.mockResolvedValueOnce(
			makeSession([
				{ type: "text", text: "Task completed successfully." },
				{ type: "text", text: "Here are the next steps." },
				{ type: "usage", inputTokens: 10, outputTokens: 5 },
			]),
		)

		const stream = handler.createMessage(systemPrompt, messages, metadata)
		const chunks: ApiStreamChunk[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		const textChunks = chunks.filter((chunk) => chunk.type === "text")
		expect(textChunks).toHaveLength(1)
		expect(textChunks[0].text).toBe("Here are the next steps.")
		const usageChunk = chunks.find((chunk) => chunk.type === "usage")
		expect(usageChunk).toBeTruthy()
		expect(fallbackSpy).not.toHaveBeenCalled()
	})

	it("replays the turn without the prior assistant message when Codex repeats itself", async () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{ role: "user", content: "Initial request" },
			{ role: "assistant", content: "Task completed successfully." },
			{ role: "user", content: "Please continue" },
		]

		createSessionMock
			.mockResolvedValueOnce(
				makeSession([
					{ type: "text", text: "Task completed successfully." },
					{ type: "usage", inputTokens: 10, outputTokens: 2 },
				]),
			)
			.mockResolvedValueOnce(
				makeSession([
					{ type: "text", text: "Continuing with the follow-up work." },
					{ type: "usage", inputTokens: 12, outputTokens: 6 },
				]),
			)

		const stream = handler.createMessage(systemPrompt, messages, metadata)
		const chunks: ApiStreamChunk[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		const textChunks = chunks.filter((chunk) => chunk.type === "text")
		expect(textChunks).toHaveLength(1)
		expect(textChunks[0].text).toBe("Continuing with the follow-up work.")
		expect(createSessionMock).toHaveBeenCalledTimes(2)
		expect(fallbackSpy).not.toHaveBeenCalled()
	})
})
