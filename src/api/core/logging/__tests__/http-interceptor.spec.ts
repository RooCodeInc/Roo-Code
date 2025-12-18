/**
 * @fileoverview Tests for the HTTP interceptor logging module
 */

import { createLoggingFetch } from "../http-interceptor"
import * as envConfig from "../env-config"

// Mock the env-config module
vi.mock("../env-config", () => ({
	isLoggingEnabled: vi.fn(),
}))

describe("createLoggingFetch", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>
	let mockFetch: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		// Mock global fetch
		mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ result: "success" }), {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "application/json" },
			}),
		)
		vi.stubGlobal("fetch", mockFetch)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	describe("body parsing", () => {
		beforeEach(() => {
			vi.mocked(envConfig.isLoggingEnabled).mockReturnValue(true)
		})

		it("should parse JSON string body correctly", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")
			const body = JSON.stringify({ message: "hello" })

			await loggingFetch("https://api.example.com/test", {
				method: "POST",
				body,
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP REQUEST",
				expect.objectContaining({
					body: { message: "hello" },
				}),
			)
		})

		it("should handle plain string body", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")

			await loggingFetch("https://api.example.com/test", {
				method: "POST",
				body: "plain text content",
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP REQUEST",
				expect.objectContaining({
					body: "plain text content",
				}),
			)
		})

		it("should handle URLSearchParams body", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")
			const params = new URLSearchParams({ key: "value", foo: "bar" })

			await loggingFetch("https://api.example.com/test", {
				method: "POST",
				body: params,
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP REQUEST",
				expect.objectContaining({
					body: "key=value&foo=bar",
				}),
			)
		})

		it("should handle Blob body with placeholder", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")
			const blob = new Blob(["binary content"], { type: "application/octet-stream" })

			await loggingFetch("https://api.example.com/test", {
				method: "POST",
				body: blob,
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP REQUEST",
				expect.objectContaining({
					body: expect.stringMatching(/^\[Blob: \d+ bytes, type: application\/octet-stream\]$/),
				}),
			)
		})

		it("should handle ArrayBuffer body with placeholder", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")
			const buffer = new ArrayBuffer(16)

			await loggingFetch("https://api.example.com/test", {
				method: "POST",
				body: buffer,
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP REQUEST",
				expect.objectContaining({
					body: "[ArrayBuffer: 16 bytes]",
				}),
			)
		})

		it("should handle FormData body with placeholder", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")
			const formData = new FormData()
			formData.append("field", "value")

			await loggingFetch("https://api.example.com/test", {
				method: "POST",
				body: formData,
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP REQUEST",
				expect.objectContaining({
					body: "[FormData]",
				}),
			)
		})

		it("should handle undefined body", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")

			await loggingFetch("https://api.example.com/test", {
				method: "GET",
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP REQUEST",
				expect.objectContaining({
					body: undefined,
				}),
			)
		})

		it("should handle null body", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")

			await loggingFetch("https://api.example.com/test", {
				method: "POST",
				body: null,
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP REQUEST",
				expect.objectContaining({
					body: undefined,
				}),
			)
		})
	})

	describe("when logging is disabled", () => {
		it("should not log requests or responses", async () => {
			vi.mocked(envConfig.isLoggingEnabled).mockReturnValue(false)
			const loggingFetch = createLoggingFetch("TestProvider")

			await loggingFetch("https://api.example.com/test", {
				method: "POST",
				body: JSON.stringify({ test: true }),
			})

			expect(consoleSpy).not.toHaveBeenCalled()
		})
	})

	describe("header sanitization", () => {
		beforeEach(() => {
			vi.mocked(envConfig.isLoggingEnabled).mockReturnValue(true)
		})

		it("should mask authorization header values", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")

			await loggingFetch("https://api.example.com/test", {
				method: "GET",
				headers: {
					Authorization: "Bearer sk-1234567890abcdef",
				},
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP REQUEST",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bear...cdef",
					}),
				}),
			)
		})

		it("should mask x-api-key header values", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")

			await loggingFetch("https://api.example.com/test", {
				method: "GET",
				headers: {
					"x-api-key": "api-key-12345678",
				},
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP REQUEST",
				expect.objectContaining({
					headers: expect.objectContaining({
						"x-api-key": "api-...5678",
					}),
				}),
			)
		})
	})

	describe("response handling", () => {
		beforeEach(() => {
			vi.mocked(envConfig.isLoggingEnabled).mockReturnValue(true)
		})

		it("should log streaming responses without body", async () => {
			mockFetch.mockResolvedValueOnce(
				new Response("data: test\n\n", {
					status: 200,
					statusText: "OK",
					headers: { "content-type": "text/event-stream" },
				}),
			)

			const loggingFetch = createLoggingFetch("TestProvider")
			await loggingFetch("https://api.example.com/stream")

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP RESPONSE",
				expect.objectContaining({
					status: 200,
					streaming: true,
				}),
			)
		})

		it("should log non-streaming responses with body", async () => {
			const loggingFetch = createLoggingFetch("TestProvider")
			await loggingFetch("https://api.example.com/test")

			expect(consoleSpy).toHaveBeenCalledWith(
				"[TestProvider] RAW HTTP RESPONSE",
				expect.objectContaining({
					status: 200,
					body: { result: "success" },
				}),
			)
		})
	})
})
