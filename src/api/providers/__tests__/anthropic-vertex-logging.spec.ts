// npx vitest run api/providers/__tests__/anthropic-vertex-logging.spec.ts

import type { ApiHandlerOptions } from "../../../shared/api"
import { ApiInferenceLogger } from "../../logging/ApiInferenceLogger"

const mockMessagesCreate = vitest.fn()

vitest.mock("@anthropic-ai/vertex-sdk", () => {
	return {
		AnthropicVertex: vitest.fn().mockImplementation(() => ({
			messages: {
				create: mockMessagesCreate,
			},
		})),
	}
})

describe("AnthropicVertexHandler API logging", () => {
	beforeEach(() => {
		vitest.clearAllMocks()
		vitest.spyOn(ApiInferenceLogger, "isEnabled").mockReturnValue(true)
		vitest.spyOn(ApiInferenceLogger, "logRaw").mockImplementation(() => {})
		vitest.spyOn(ApiInferenceLogger, "logRawError").mockImplementation(() => {})
	})

	it("logs request + streaming response", async () => {
		mockMessagesCreate.mockResolvedValueOnce({
			async *[Symbol.asyncIterator]() {
				yield {
					type: "message_start",
					message: {
						usage: { input_tokens: 10, output_tokens: 5 },
					},
				}
				yield {
					type: "content_block_start",
					index: 0,
					content_block: { type: "text", text: "Hello" },
				}
				yield {
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: " world" },
				}
			},
		})

		const { AnthropicVertexHandler } = await import("../anthropic-vertex")
		const options: ApiHandlerOptions = {
			apiModelId: "claude-3-5-sonnet-v2@20241022",
			vertexProjectId: "test-project",
			vertexRegion: "us-central1",
		}
		const handler = new AnthropicVertexHandler(options)

		for await (const _ of handler.createMessage("system", [{ role: "user", content: "hi" }])) {
			// drain
		}

		expect(ApiInferenceLogger.logRaw).toHaveBeenCalledWith(
			expect.stringMatching(/^\[API\]\[request\]\[Anthropic Vertex\]\[.+\]$/),
			expect.objectContaining({
				model: expect.any(String),
				stream: true,
			}),
		)

		expect(ApiInferenceLogger.logRaw).toHaveBeenCalledWith(
			expect.stringMatching(/^\[API\]\[response\]\[Anthropic Vertex\]\[.+\]\[\d+ms\]\[streaming\]$/),
			expect.objectContaining({
				type: "message",
				model: expect.any(String),
				content: expect.any(Array),
			}),
		)
	})
})
