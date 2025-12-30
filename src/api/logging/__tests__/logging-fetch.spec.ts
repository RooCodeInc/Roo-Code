import { ApiInferenceLogger } from "../ApiInferenceLogger"
import { createLoggingFetch } from "../logging-fetch"

describe("createLoggingFetch", () => {
	beforeEach(() => {
		ApiInferenceLogger.configure({ enabled: true, sink: vi.fn() })
	})

	afterEach(() => {
		ApiInferenceLogger.configure({ enabled: false, sink: () => {} })
	})

	it("logs request and JSON response with expected labels", async () => {
		const sink = vi.fn()
		ApiInferenceLogger.configure({ enabled: true, sink })

		const baseFetch: typeof fetch = async (_input, init) => {
			expect(init?.method).toBe("POST")
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})
		}

		const loggingFetch = createLoggingFetch({ provider: "TestProvider" }, baseFetch)
		await loggingFetch("https://example.com/v1/test", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ model: "test-model", foo: "bar" }),
		})

		expect(sink).toHaveBeenCalledWith(
			"[API][request][TestProvider][test-model]",
			expect.objectContaining({ model: "test-model", foo: "bar" }),
		)

		expect(sink).toHaveBeenCalledWith(
			expect.stringMatching(/^\[API\]\[response\]\[TestProvider\]\[test-model\]\[\d+ms\]$/),
			expect.objectContaining({ ok: true }),
		)
	})

	it("tees SSE responses so the consumer can still read the stream", async () => {
		const sink = vi.fn()
		ApiInferenceLogger.configure({ enabled: true, sink })

		const encoder = new TextEncoder()

		const events = [
			{
				id: "1",
				model: "test-model",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: { role: "assistant", content: "He" } }],
			},
			{
				id: "1",
				model: "test-model",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: { content: "llo" } }],
			},
			{
				id: "1",
				model: "test-model",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [
								{
									index: 0,
									id: "tc_1",
									type: "function",
									function: { name: "do", arguments: '{"a":' },
								},
							],
						},
					},
				],
			},
			{
				id: "1",
				model: "test-model",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [{ index: 0, id: "tc_1", type: "function", function: { arguments: "1}" } }],
						},
					},
				],
			},
			{
				id: "1",
				model: "test-model",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
				usage: { prompt_tokens: 1, completion_tokens: 2 },
			},
		]

		const sse =
			`: OPENROUTER PROCESSING\n\n` +
			events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") +
			`data: [DONE]\n\n`
		const baseFetch: typeof fetch = async () => {
			return new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode(sse))
						controller.close()
					},
				}),
				{
					status: 200,
					headers: { "content-type": "text/event-stream" },
				},
			)
		}

		const loggingFetch = createLoggingFetch({ provider: "TestProvider" }, baseFetch)
		const res = await loggingFetch("https://example.com/v1/stream", {
			method: "POST",
			body: JSON.stringify({ model: "test-model" }),
		})

		// Consumer still receives the body.
		const consumerText = await res.text()
		expect(consumerText).toContain("data:")

		// Logger gets a streaming label.
		expect(sink).toHaveBeenCalledWith(
			expect.stringMatching(/^\[API\]\[response\]\[TestProvider\]\[test-model\]\[\d+ms\]\[streaming\]$/),
			expect.objectContaining({
				object: "chat.completion",
				model: "test-model",
				choices: [
					expect.objectContaining({
						index: 0,
						finish_reason: "tool_calls",
						message: expect.objectContaining({
							role: "assistant",
							content: "Hello",
						}),
					}),
				],
				usage: expect.objectContaining({ prompt_tokens: 1, completion_tokens: 2 }),
				__sse: expect.objectContaining({
					format: "sse",
					__rawSse: expect.anything(),
					events: expect.any(Array),
				}),
			}),
		)
	})

	it("logs non-OpenAI SSE in a structured preview object", async () => {
		const sink = vi.fn()
		ApiInferenceLogger.configure({ enabled: true, sink })

		const encoder = new TextEncoder()
		const sse =
			`event: ping\n` +
			`data: {"type":"ping","t":123}\n\n` +
			`event: custom\n` +
			`data: hello world\n\n` +
			`data: [DONE]\n\n`

		const baseFetch: typeof fetch = async () => {
			return new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode(sse))
						controller.close()
					},
				}),
				{
					status: 200,
					headers: { "content-type": "text/event-stream" },
				},
			)
		}

		const loggingFetch = createLoggingFetch({ provider: "TestProvider" }, baseFetch)
		const res = await loggingFetch("https://example.com/v1/stream", {
			method: "POST",
			body: JSON.stringify({ model: "test-model" }),
		})

		// Drain the consumer stream and allow the async logger to finish.
		await res.text()
		await new Promise((r) => setTimeout(r, 0))

		expect(sink).toHaveBeenCalledWith(
			expect.stringMatching(/^\[API\]\[response\]\[TestProvider\]\[test-model\]\[\d+ms\]\[streaming\]$/),
			expect.objectContaining({
				format: "sse",
				__rawSse: expect.anything(),
				events: expect.arrayContaining([
					expect.objectContaining({ event: "ping", data: expect.objectContaining({ type: "ping" }) }),
					expect.objectContaining({ event: "custom" }),
				]),
			}),
		)
	})

	it("assembles Anthropic Messages SSE into a final message object", async () => {
		const sink = vi.fn()
		ApiInferenceLogger.configure({ enabled: true, sink })

		const encoder = new TextEncoder()
		const sse =
			`event: message_start\n` +
			`data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-test","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":0}}}\n\n` +
			`event: content_block_start\n` +
			`data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}\n\n` +
			`event: content_block_delta\n` +
			`data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Hello"}}\n\n` +
			`event: content_block_delta\n` +
			`data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig_123"}}\n\n` +
			`event: content_block_stop\n` +
			`data: {"type":"content_block_stop","index":0}\n\n` +
			`event: message_delta\n` +
			`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}\n\n` +
			`event: message_stop\n` +
			`data: {"type":"message_stop"}\n\n`

		const baseFetch: typeof fetch = async () => {
			return new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode(sse))
						controller.close()
					},
				}),
				{
					status: 200,
					headers: { "content-type": "text/event-stream" },
				},
			)
		}

		const loggingFetch = createLoggingFetch({ provider: "Anthropic" }, baseFetch)
		const res = await loggingFetch("https://example.com/v1/messages", {
			method: "POST",
			body: JSON.stringify({ model: "claude-test" }),
		})
		await res.text()
		await new Promise((r) => setTimeout(r, 0))

		expect(sink).toHaveBeenCalledWith(
			expect.stringMatching(/^\[API\]\[response\]\[Anthropic\]\[claude-test\]\[\d+ms\]\[streaming\]$/),
			expect.objectContaining({
				type: "message",
				id: "msg_1",
				model: "claude-test",
				role: "assistant",
				stop_reason: "end_turn",
				usage: expect.objectContaining({ input_tokens: 1, output_tokens: 2 }),
				content: [expect.objectContaining({ type: "thinking", thinking: "Hello", signature: "sig_123" })],
				__sse: expect.objectContaining({
					format: "sse",
					__rawSse: expect.anything(),
					events: expect.any(Array),
				}),
			}),
		)
	})
})
