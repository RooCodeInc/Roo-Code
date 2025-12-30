// npx vitest run api/providers/__tests__/native-ollama-logging.spec.ts

import { NativeOllamaHandler } from "../native-ollama"
import type { ApiHandlerOptions } from "../../../shared/api"
import { ApiInferenceLogger } from "../../logging/ApiInferenceLogger"
import { getOllamaModels } from "../fetchers/ollama"

const mockChat = vitest.fn()
vitest.mock("ollama", () => {
	return {
		Ollama: vitest.fn().mockImplementation(() => ({
			chat: mockChat,
		})),
		Message: vitest.fn(),
	}
})

vitest.mock("../fetchers/ollama", () => ({
	getOllamaModels: vitest.fn(),
}))

describe("NativeOllamaHandler API logging", () => {
	beforeEach(() => {
		vitest.clearAllMocks()
		vitest.spyOn(ApiInferenceLogger, "isEnabled").mockReturnValue(true)
		vitest.spyOn(ApiInferenceLogger, "logRaw").mockImplementation(() => {})
		vitest.spyOn(ApiInferenceLogger, "logRawError").mockImplementation(() => {})

		vitest.mocked(getOllamaModels).mockResolvedValue({
			llama2: {
				contextWindow: 4096,
				maxTokens: 4096,
				supportsImages: false,
				supportsPromptCache: false,
			},
		})
	})

	it("logs request + streaming response", async () => {
		mockChat.mockImplementation(async function* () {
			yield { message: { content: "Hello" } }
			yield { message: { content: " world" }, eval_count: 2, prompt_eval_count: 10 }
		})

		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			ollamaModelId: "llama2",
			ollamaBaseUrl: "http://localhost:11434",
		}
		const handler = new NativeOllamaHandler(options)

		const stream = handler.createMessage("system", [{ role: "user", content: "hi" }])
		for await (const _ of stream) {
			// consume
		}

		expect(ApiInferenceLogger.logRaw).toHaveBeenCalledWith(
			expect.stringMatching(/^\[API\]\[request\]\[Ollama\]\[llama2\]$/),
			expect.objectContaining({
				model: "llama2",
				stream: true,
				messages: expect.any(Array),
			}),
		)

		expect(ApiInferenceLogger.logRaw).toHaveBeenCalledWith(
			expect.stringMatching(/^\[API\]\[response\]\[Ollama\]\[llama2\]\[\d+ms\]\[streaming\]$/),
			expect.objectContaining({
				model: "llama2",
				message: expect.objectContaining({
					role: "assistant",
					content: "Hello world",
				}),
				usage: expect.objectContaining({ inputTokens: 10, outputTokens: 2 }),
			}),
		)
	})
})
