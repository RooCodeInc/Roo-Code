import { ApiInferenceLogger } from "../ApiInferenceLogger"

describe("ApiInferenceLogger", () => {
	let mockSink: ReturnType<typeof vi.fn>

	beforeEach(() => {
		mockSink = vi.fn()
		// Reset the logger to disabled state before each test
		ApiInferenceLogger.configure({ enabled: false, sink: () => {} })
	})

	describe("configure", () => {
		it("should enable logging when configured with enabled=true", () => {
			ApiInferenceLogger.configure({ enabled: true, sink: mockSink })
			expect(ApiInferenceLogger.isEnabled()).toBe(true)
		})

		it("should disable logging when configured with enabled=false", () => {
			ApiInferenceLogger.configure({ enabled: false, sink: mockSink })
			expect(ApiInferenceLogger.isEnabled()).toBe(false)
		})

		it("should not log when disabled", () => {
			ApiInferenceLogger.configure({ enabled: false, sink: mockSink })
			const handle = ApiInferenceLogger.start(
				{ provider: "test", operation: "createMessage" },
				{ test: "payload" },
			)
			handle.success({ response: "data" })
			expect(mockSink).not.toHaveBeenCalled()
		})
	})

	describe("start", () => {
		beforeEach(() => {
			ApiInferenceLogger.configure({ enabled: true, sink: mockSink })
		})

		it("should emit a request log with simplified label format", () => {
			ApiInferenceLogger.start({ provider: "OpenAI", operation: "createMessage" }, { model: "gpt-4" })

			expect(mockSink).toHaveBeenCalledTimes(1)
			expect(mockSink).toHaveBeenCalledWith("[API][request][OpenAI][gpt-4]", { model: "gpt-4" })
		})

		it("should use context.model in the request label", () => {
			ApiInferenceLogger.start(
				{
					provider: "Anthropic",
					operation: "createMessage",
					model: "claude-3",
					taskId: "task-123",
					requestId: "req-456",
				},
				{ test: "data" },
			)

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][Anthropic][claude-3]",
				expect.objectContaining({ test: "data" }),
			)
		})

		it("should fall back to payload.model when context.model is missing", () => {
			ApiInferenceLogger.start(
				{
					provider: "OpenAI",
					operation: "createMessage",
				},
				{ model: "gpt-4", foo: "bar" },
			)

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][OpenAI][gpt-4]",
				expect.objectContaining({ model: "gpt-4", foo: "bar" }),
			)
		})
	})

	describe("success", () => {
		beforeEach(() => {
			ApiInferenceLogger.configure({ enabled: true, sink: mockSink })
		})

		it("should emit a response log with simplified label format", () => {
			const handle = ApiInferenceLogger.start({ provider: "OpenAI", operation: "createMessage" }, {})
			mockSink.mockClear()

			handle.success({ text: "Hello world", usage: { inputTokens: 10, outputTokens: 20 } })

			expect(mockSink).toHaveBeenCalledTimes(1)
			expect(mockSink).toHaveBeenCalledWith(
				expect.stringMatching(/^\[API\]\[response\]\[OpenAI\]\[unknown\]\[\d+ms\]$/),
				expect.objectContaining({
					text: "Hello world",
					usage: { inputTokens: 10, outputTokens: 20 },
				}),
			)
		})
	})

	describe("error", () => {
		beforeEach(() => {
			ApiInferenceLogger.configure({ enabled: true, sink: mockSink })
		})

		it("should emit an error log with simplified label format", () => {
			const handle = ApiInferenceLogger.start({ provider: "OpenAI", operation: "createMessage" }, {})
			mockSink.mockClear()

			handle.error(new Error("API request failed"))

			expect(mockSink).toHaveBeenCalledTimes(1)
			expect(mockSink).toHaveBeenCalledWith(
				expect.stringMatching(/^\[API\]\[error\]\[OpenAI\]\[unknown\]\[\d+ms\]$/),
				expect.objectContaining({
					name: "Error",
					message: "API request failed",
				}),
			)
		})

		it("should handle non-Error objects", () => {
			const handle = ApiInferenceLogger.start({ provider: "test", operation: "test" }, {})
			mockSink.mockClear()

			handle.error({ status: 401, message: "Unauthorized" })

			expect(mockSink).toHaveBeenCalledWith(
				expect.stringMatching(/^\[API\]\[error\]\[test\]\[unknown\]\[\d+ms\]$/),
				expect.objectContaining({
					status: 401,
					message: "Unauthorized",
				}),
			)
		})
	})

	describe("secret redaction", () => {
		beforeEach(() => {
			ApiInferenceLogger.configure({ enabled: true, sink: mockSink })
		})

		it("should redact Authorization header", () => {
			ApiInferenceLogger.start(
				{ provider: "test", operation: "test" },
				{ headers: { Authorization: "Bearer sk-secret-key-12345" } },
			)

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					headers: { Authorization: "[REDACTED]" },
				}),
			)
		})

		it("should redact apiKey field", () => {
			ApiInferenceLogger.start({ provider: "test", operation: "test" }, { apiKey: "sk-secret-12345" })

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					apiKey: "[REDACTED]",
				}),
			)
		})

		it("should redact nested secret fields", () => {
			ApiInferenceLogger.start(
				{ provider: "test", operation: "test" },
				{
					config: {
						auth: {
							access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
							api_key: "secret-api-key",
						},
					},
				},
			)

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					config: {
						auth: {
							access_token: "[REDACTED]",
							api_key: "[REDACTED]",
						},
					},
				}),
			)
		})

		it("should redact secret fields in arrays", () => {
			ApiInferenceLogger.start(
				{ provider: "test", operation: "test" },
				{
					items: [{ apiKey: "secret1" }, { apiKey: "secret2" }],
				},
			)

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					items: [{ apiKey: "[REDACTED]" }, { apiKey: "[REDACTED]" }],
				}),
			)
		})

		it("should not redact non-secret fields", () => {
			ApiInferenceLogger.start(
				{ provider: "test", operation: "test" },
				{ model: "gpt-4", messages: [{ role: "user", content: "Hello" }] },
			)

			expect(mockSink).toHaveBeenCalledWith("[API][request][test][gpt-4]", {
				model: "gpt-4",
				messages: [{ role: "user", content: "Hello" }],
			})
		})
	})

	describe("payload size limiting", () => {
		beforeEach(() => {
			ApiInferenceLogger.configure({ enabled: true, sink: mockSink })
		})

		it("should truncate strings longer than 10,000 characters", () => {
			const longString = "x".repeat(15_000)
			ApiInferenceLogger.start({ provider: "test", operation: "test" }, { content: longString })

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					content: "[Truncated len=15000]",
				}),
			)
		})

		it("should not truncate strings within the limit", () => {
			const normalString = "x".repeat(5_000)
			ApiInferenceLogger.start({ provider: "test", operation: "test" }, { content: normalString })

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					content: normalString,
				}),
			)
		})

		it("should replace base64 image data with placeholder", () => {
			const imageData =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
			ApiInferenceLogger.start({ provider: "test", operation: "test" }, { image: imageData })

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					image: expect.stringMatching(/^\[ImageData len=\d+\]$/),
				}),
			)
		})

		it("should replace base64 image data for various image types", () => {
			ApiInferenceLogger.start(
				{ provider: "test", operation: "test" },
				{
					png: "data:image/png;base64,abc123",
					jpeg: "data:image/jpeg;base64,abc123",
					gif: "data:image/gif;base64,abc123",
					webp: "data:image/webp;base64,abc123",
				},
			)

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					png: expect.stringMatching(/^\[ImageData len=\d+\]$/),
					jpeg: expect.stringMatching(/^\[ImageData len=\d+\]$/),
					gif: expect.stringMatching(/^\[ImageData len=\d+\]$/),
					webp: expect.stringMatching(/^\[ImageData len=\d+\]$/),
				}),
			)
		})

		it("should cap arrays longer than 200 entries", () => {
			const longArray = Array.from({ length: 250 }, (_, i) => ({ id: i }))
			ApiInferenceLogger.start({ provider: "test", operation: "test" }, { items: longArray })

			const call = mockSink.mock.calls[0]
			const payload = call[1] as { items: any[] }

			expect(payload.items.length).toBe(201)
			expect(payload.items[200]).toBe("[...50 more items]")
		})

		it("should not cap arrays within the limit", () => {
			const normalArray = Array.from({ length: 50 }, (_, i) => ({ id: i }))
			ApiInferenceLogger.start({ provider: "test", operation: "test" }, { items: normalArray })

			const call = mockSink.mock.calls[0]
			const payload = call[1] as { items: any[] }

			expect(payload.items.length).toBe(50)
		})

		it("should cap objects with more than 200 keys", () => {
			const bigObject: Record<string, number> = {}
			for (let i = 0; i < 250; i++) {
				bigObject[`key${i}`] = i
			}
			ApiInferenceLogger.start({ provider: "test", operation: "test" }, bigObject)

			const call = mockSink.mock.calls[0]
			const payload = call[1] as Record<string, unknown>

			const keys = Object.keys(payload)
			expect(keys.length).toBe(201)
			expect(payload["[...]"]).toBe("50 more keys omitted")
		})

		it("should apply size limiting recursively in nested objects", () => {
			const nested = {
				level1: {
					longString: "x".repeat(15_000),
					level2: {
						imageData: "data:image/png;base64,abc123",
					},
				},
			}
			ApiInferenceLogger.start({ provider: "test", operation: "test" }, nested)

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					level1: expect.objectContaining({
						longString: "[Truncated len=15000]",
						level2: expect.objectContaining({
							imageData: expect.stringMatching(/^\[ImageData len=\d+\]$/),
						}),
					}),
				}),
			)
		})

		it("should apply size limiting recursively in arrays", () => {
			const messages = [
				{ role: "user", content: "x".repeat(15_000) },
				{ role: "assistant", content: "data:image/png;base64,abc123" },
			]
			ApiInferenceLogger.start({ provider: "test", operation: "test" }, { messages })

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					messages: [
						expect.objectContaining({
							role: "user",
							content: "[Truncated len=15000]",
						}),
						expect.objectContaining({
							role: "assistant",
							content: expect.stringMatching(/^\[ImageData len=\d+\]$/),
						}),
					],
				}),
			)
		})
	})

	describe("edge cases", () => {
		beforeEach(() => {
			ApiInferenceLogger.configure({ enabled: true, sink: mockSink })
		})

		it("should handle null and undefined values", () => {
			expect(() => {
				ApiInferenceLogger.start({ provider: "test", operation: "test" }, { value: null, other: undefined })
			}).not.toThrow()

			expect(mockSink).toHaveBeenCalledWith(
				"[API][request][test][unknown]",
				expect.objectContaining({
					value: null,
					other: undefined,
				}),
			)
		})

		it("should handle empty objects", () => {
			expect(() => {
				ApiInferenceLogger.start({ provider: "test", operation: "test" }, {})
			}).not.toThrow()
		})

		it("should not throw on circular references", () => {
			const obj: any = { name: "test" }
			obj.self = obj

			expect(() => {
				ApiInferenceLogger.start({ provider: "test", operation: "test" }, obj)
			}).not.toThrow()
		})

		it("should handle primitive values in payload", () => {
			expect(() => {
				ApiInferenceLogger.start({ provider: "test", operation: "test" }, "string payload" as any)
			}).not.toThrow()
		})

		it("should handle functions in payload without throwing", () => {
			expect(() => {
				ApiInferenceLogger.start(
					{ provider: "test", operation: "test" },
					{ callback: () => console.log("test") },
				)
			}).not.toThrow()
		})

		it("should handle BigInt values without throwing", () => {
			expect(() => {
				ApiInferenceLogger.start(
					{ provider: "test", operation: "test" },
					{ bigValue: BigInt(9007199254740991) },
				)
			}).not.toThrow()
		})
	})

	describe("sink error handling", () => {
		it("should not throw if sink throws an error", () => {
			const throwingSink = vi.fn(() => {
				throw new Error("Sink error")
			})
			ApiInferenceLogger.configure({ enabled: true, sink: throwingSink })

			expect(() => {
				ApiInferenceLogger.start({ provider: "test", operation: "test" }, {})
			}).not.toThrow()
		})
	})
})
