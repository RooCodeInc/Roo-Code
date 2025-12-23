import OpenAI from "openai"

import { OpenAiHandler } from "../openai"

describe("OpenAiHandler native tools", () => {
	it("includes tools in request when model supports native tools and tools are provided", async () => {
		const mockCreate = vi.fn().mockImplementationOnce(() => ({
			[Symbol.asyncIterator]: async function* () {
				yield {
					choices: [{ delta: { content: "Test response" } }],
				}
			},
		}))

		const handler = new OpenAiHandler({
			openAiApiKey: "test-key",
			openAiBaseUrl: "https://example.com/v1",
			openAiModelId: "test-model",
		} as unknown as import("../../../shared/api").ApiHandlerOptions)

		// Patch the OpenAI client call
		const mockClient = {
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		} as unknown as OpenAI
		;(handler as unknown as { client: OpenAI }).client = mockClient

		const tools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "test_tool",
					description: "test",
					parameters: { type: "object", properties: {} },
				},
			},
		]

		const stream = handler.createMessage("system", [], {
			taskId: "test-task-id",
			tools,
			toolProtocol: "native",
		})
		await stream.next()

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.arrayContaining([
					expect.objectContaining({
						type: "function",
						function: expect.objectContaining({ name: "test_tool" }),
					}),
				]),
				parallel_tool_calls: false,
			}),
			expect.anything(),
		)
	})
})
