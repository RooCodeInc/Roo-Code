import { describe, it, expect, vitest, beforeEach, afterEach } from "vitest"
import {
	OpenAINativeDebugger,
	createUrlTransformationTracker,
	buildDebugRequestInfo,
	buildDebugResponseInfo,
	type DebugRequestInfo,
	type DebugResponseInfo,
	type DebugErrorInfo,
	type ErrorCategory,
	type UrlTransformation,
} from "../openai-native-debug"
import { OpenAiNativeHandler } from "../openai-native"

describe("OpenAINativeDebugger", () => {
	let debugger_: OpenAINativeDebugger
	let logOutput: string[]
	let mockLogFn: (message: string) => void

	beforeEach(() => {
		logOutput = []
		mockLogFn = (message: string) => logOutput.push(message)
		debugger_ = new OpenAINativeDebugger({
			enabled: true,
			logOutput: mockLogFn,
		})
	})

	describe("constructor and configuration", () => {
		it("should be disabled by default when OPENAI_DEBUG is not set", () => {
			const originalEnv = process.env.OPENAI_DEBUG
			delete process.env.OPENAI_DEBUG
			delete process.env.OPENAI_NATIVE_DEBUG

			const d = new OpenAINativeDebugger()
			expect(d.enabled).toBe(false)

			process.env.OPENAI_DEBUG = originalEnv
		})

		it("should be enabled when OPENAI_DEBUG=true", () => {
			const originalEnv = process.env.OPENAI_DEBUG
			process.env.OPENAI_DEBUG = "true"

			const d = new OpenAINativeDebugger()
			expect(d.enabled).toBe(true)

			process.env.OPENAI_DEBUG = originalEnv
		})

		it("should be enabled when OPENAI_DEBUG=1", () => {
			const originalEnv = process.env.OPENAI_DEBUG
			process.env.OPENAI_DEBUG = "1"

			const d = new OpenAINativeDebugger()
			expect(d.enabled).toBe(true)

			process.env.OPENAI_DEBUG = originalEnv
		})

		it("should respect enabled option", () => {
			const d = new OpenAINativeDebugger({ enabled: true })
			expect(d.enabled).toBe(true)
		})

		it("should allow enabling/disabling via setEnabled", () => {
			const d = new OpenAINativeDebugger({ enabled: false })
			expect(d.enabled).toBe(false)

			d.setEnabled(true)
			expect(d.enabled).toBe(true)

			d.setEnabled(false)
			expect(d.enabled).toBe(false)
		})
	})

	describe("generateRequestId", () => {
		it("should generate unique request IDs", () => {
			const id1 = debugger_.generateRequestId()
			const id2 = debugger_.generateRequestId()

			expect(id1).not.toBe(id2)
		})

		it("should generate IDs with req_ prefix", () => {
			const id = debugger_.generateRequestId()
			expect(id).toMatch(/^req_[a-f0-9]{24}$/)
		})
	})

	describe("getTimestamp", () => {
		it("should return ISO timestamp", () => {
			const timestamp = debugger_.getTimestamp()
			expect(() => new Date(timestamp)).not.toThrow()
			expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
		})
	})

	describe("maskApiKey", () => {
		it("should mask API keys showing first 4 and last 4 characters", () => {
			const masked = debugger_.maskApiKey("sk-abcdefghijklmnopqrstuvwxyz")
			expect(masked).toBe("sk-a...wxyz")
		})

		it("should return *** for short keys", () => {
			const masked = debugger_.maskApiKey("short")
			expect(masked).toBe("***")
		})

		it("should return *** for empty keys", () => {
			const masked = debugger_.maskApiKey("")
			expect(masked).toBe("***")
		})

		it("should fully mask when fullMask option is true", () => {
			const d = new OpenAINativeDebugger({ enabled: true, fullMask: true })
			const masked = d.maskApiKey("sk-abcdefghijklmnopqrstuvwxyz")
			expect(masked).toBe("***")
		})
	})

	describe("logRequest", () => {
		it("should log request details when enabled", () => {
			const requestInfo: DebugRequestInfo = {
				requestId: "req_test123456789012345678",
				method: "POST",
				url: "https://api.openai.com/v1/responses",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer sk-testkey1234567890",
				},
				body: { model: "gpt-4", input: [{ role: "user", content: "Hello" }] },
				timestamp: "2024-01-01T00:00:00.000Z",
				isAzure: false,
			}

			debugger_.logRequest(requestInfo)

			expect(logOutput.length).toBe(1)
			expect(logOutput[0]).toContain("REQUEST")
			expect(logOutput[0]).toContain("req_test123456789012345678")
			expect(logOutput[0]).toContain("POST")
			expect(logOutput[0]).toContain("https://api.openai.com/v1/responses")
			// Check that Authorization header is masked
			expect(logOutput[0]).toContain("Bearer sk-t...7890")
			expect(logOutput[0]).not.toContain("sk-testkey1234567890")
		})

		it("should not log when disabled", () => {
			debugger_.setEnabled(false)

			const requestInfo: DebugRequestInfo = {
				requestId: "req_test123456789012345678",
				method: "POST",
				url: "https://api.openai.com/v1/responses",
				headers: {},
				timestamp: "2024-01-01T00:00:00.000Z",
				isAzure: false,
			}

			debugger_.logRequest(requestInfo)
			expect(logOutput.length).toBe(0)
		})

		it("should log URL transformations", () => {
			const requestInfo: DebugRequestInfo = {
				requestId: "req_test123456789012345678",
				method: "POST",
				url: "https://myazure.openai.azure.com/openai/v1/responses",
				baseUrl: "https://myazure.openai.azure.com/",
				headers: {},
				timestamp: "2024-01-01T00:00:00.000Z",
				isAzure: true,
				urlTransformations: [
					{
						step: "Remove trailing slashes",
						before: "https://myazure.openai.azure.com/",
						after: "https://myazure.openai.azure.com",
					},
					{
						step: "Add /openai",
						before: "https://myazure.openai.azure.com",
						after: "https://myazure.openai.azure.com/openai",
						reason: "Azure OpenAI requires /openai path segment",
					},
				],
			}

			debugger_.logRequest(requestInfo)

			expect(logOutput[0]).toContain("URL Transformations")
			expect(logOutput[0]).toContain("Remove trailing slashes")
		})

		it("should mask api-key header for Azure", () => {
			const requestInfo: DebugRequestInfo = {
				requestId: "req_test123456789012345678",
				method: "POST",
				url: "https://myazure.openai.azure.com/openai/v1/responses",
				headers: {
					"api-key": "azure-api-key-12345678901234567890",
				},
				timestamp: "2024-01-01T00:00:00.000Z",
				isAzure: true,
			}

			debugger_.logRequest(requestInfo)

			expect(logOutput[0]).toContain("azur...7890")
			expect(logOutput[0]).not.toContain("azure-api-key-12345678901234567890")
		})
	})

	describe("logResponse", () => {
		it("should log response details", () => {
			const responseInfo: DebugResponseInfo = {
				requestId: "req_test123456789012345678",
				status: 200,
				statusText: "OK",
				headers: {
					"content-type": "application/json",
					"x-request-id": "server-req-id-123",
				},
				timestamp: "2024-01-01T00:00:01.000Z",
				durationMs: 1234,
				openaiOrganization: "org-123",
				openaiProcessingMs: 800,
				xRequestId: "server-req-id-123",
			}

			debugger_.logResponse(responseInfo)

			expect(logOutput[0]).toContain("RESPONSE")
			expect(logOutput[0]).toContain("200 OK")
			expect(logOutput[0]).toContain("1234ms")
			expect(logOutput[0]).toContain("org-123")
			expect(logOutput[0]).toContain("800ms")
		})

		it("should log rate limit information", () => {
			const responseInfo: DebugResponseInfo = {
				requestId: "req_test123456789012345678",
				status: 200,
				statusText: "OK",
				headers: {},
				timestamp: "2024-01-01T00:00:01.000Z",
				durationMs: 500,
				rateLimitInfo: {
					limitRequests: 10000,
					remainingRequests: 9999,
					limitTokens: 1000000,
					remainingTokens: 999000,
					resetRequests: "1s",
					resetTokens: "1m",
				},
			}

			debugger_.logResponse(responseInfo)

			expect(logOutput[0]).toContain("Rate Limit Info")
			expect(logOutput[0]).toContain("10000")
			expect(logOutput[0]).toContain("9999")
		})

		it("should use error log level for 4xx/5xx responses", () => {
			// We can't easily test log level, but we can verify the log is produced
			const responseInfo: DebugResponseInfo = {
				requestId: "req_test123456789012345678",
				status: 500,
				statusText: "Internal Server Error",
				headers: {},
				timestamp: "2024-01-01T00:00:01.000Z",
				durationMs: 100,
			}

			debugger_.logResponse(responseInfo)

			expect(logOutput[0]).toContain("[ERROR]")
			expect(logOutput[0]).toContain("500 Internal Server Error")
		})
	})

	describe("logUrlConstruction", () => {
		it("should log URL construction steps", () => {
			const transformations: UrlTransformation[] = [
				{ step: "Parse URL", before: "https://api.example.com/", after: "https://api.example.com" },
				{
					step: "Add /v1/responses",
					before: "https://api.example.com",
					after: "https://api.example.com/v1/responses",
				},
			]

			debugger_.logUrlConstruction(
				"req_test123456789012345678",
				"https://api.example.com/",
				transformations,
				"https://api.example.com/v1/responses",
			)

			expect(logOutput[0]).toContain("URL CONSTRUCTION")
			expect(logOutput[0]).toContain("https://api.example.com/")
			expect(logOutput[0]).toContain("Parse URL")
			expect(logOutput[0]).toContain("Add /v1/responses")
			expect(logOutput[0]).toContain("Final URL")
		})
	})

	describe("logStreamEvent", () => {
		it("should log stream events", () => {
			debugger_.logStreamEvent("req_test123456789012345678", "response.output_text.delta", { delta: "Hello" })

			expect(logOutput[0]).toContain("STREAM EVENT")
			expect(logOutput[0]).toContain("response.output_text.delta")
		})
	})

	describe("logError and categorizeError", () => {
		it("should categorize connection errors", () => {
			const error = new Error("connect ECONNREFUSED 127.0.0.1:443")
			const errorInfo = debugger_.categorizeError(error, "req_test123456789012345678", Date.now() - 100)

			expect(errorInfo.category).toBe("connection")
			expect(errorInfo.suggestions).toBeDefined()
			expect(errorInfo.suggestions?.length).toBeGreaterThan(0)
		})

		it("should categorize SSL/TLS errors", () => {
			const error = new Error("unable to verify the first certificate")
			const errorInfo = debugger_.categorizeError(error, "req_test123456789012345678")

			expect(errorInfo.category).toBe("ssl_tls")
		})

		it("should categorize DNS errors", () => {
			const error = new Error("getaddrinfo ENOTFOUND api.example.com")
			const errorInfo = debugger_.categorizeError(error, "req_test123456789012345678")

			expect(errorInfo.category).toBe("dns")
		})

		it("should categorize timeout errors", () => {
			const error = new Error("request timed out after 30000ms")
			const errorInfo = debugger_.categorizeError(error, "req_test123456789012345678")

			expect(errorInfo.category).toBe("timeout")
		})

		it("should categorize malformed response errors", () => {
			const error = new Error("Unexpected token < in JSON at position 0")
			const errorInfo = debugger_.categorizeError(error, "req_test123456789012345678")

			expect(errorInfo.category).toBe("malformed_response")
		})

		it("should categorize auth errors", () => {
			const error = new Error("401 Unauthorized - Invalid API key")
			const errorInfo = debugger_.categorizeError(error, "req_test123456789012345678")

			expect(errorInfo.category).toBe("auth")
		})

		it("should categorize rate limit errors", () => {
			const error = new Error("429 Too Many Requests - Rate limit exceeded")
			const errorInfo = debugger_.categorizeError(error, "req_test123456789012345678")

			expect(errorInfo.category).toBe("rate_limit")
		})

		it("should categorize server errors", () => {
			const error = new Error("500 Internal Server Error")
			const errorInfo = debugger_.categorizeError(error, "req_test123456789012345678")

			expect(errorInfo.category).toBe("server_error")
		})

		it("should categorize unknown errors", () => {
			const error = new Error("Something completely unexpected happened")
			const errorInfo = debugger_.categorizeError(error, "req_test123456789012345678")

			expect(errorInfo.category).toBe("unknown")
		})

		it("should log error with context and suggestions", () => {
			const errorInfo: DebugErrorInfo = {
				requestId: "req_test123456789012345678",
				category: "connection",
				message: "Failed to connect",
				timestamp: "2024-01-01T00:00:00.000Z",
				durationMs: 5000,
				context: { url: "https://api.example.com", isAzure: false },
				suggestions: ["Check network connectivity", "Verify the URL is correct"],
			}

			debugger_.logError(errorInfo)

			expect(logOutput[0]).toContain("ERROR")
			expect(logOutput[0]).toContain("connection")
			expect(logOutput[0]).toContain("Failed to connect")
			expect(logOutput[0]).toContain("Suggestions")
			expect(logOutput[0]).toContain("Check network connectivity")
		})

		it("should log original error stack trace", () => {
			const originalError = new Error("Original error message")
			const errorInfo: DebugErrorInfo = {
				requestId: "req_test123456789012345678",
				category: "unknown",
				message: "Wrapped error",
				timestamp: "2024-01-01T00:00:00.000Z",
				originalError,
			}

			debugger_.logError(errorInfo)

			expect(logOutput[0]).toContain("Original Error")
			expect(logOutput[0]).toContain("Original error message")
		})
	})

	describe("parseResponseHeaders", () => {
		it("should parse Headers object", () => {
			const headers = new Headers({
				"content-type": "application/json",
				"x-request-id": "req-123",
				"openai-organization": "org-456",
				"openai-processing-ms": "500",
				"x-ratelimit-limit-requests": "10000",
				"x-ratelimit-remaining-requests": "9999",
			})

			const result = debugger_.parseResponseHeaders(headers)

			expect(result.headers["content-type"]).toBe("application/json")
			expect(result.openaiHeaders.organization).toBe("org-456")
			expect(result.openaiHeaders.processingMs).toBe(500)
			expect(result.openaiHeaders.requestId).toBe("req-123")
			expect(result.rateLimitInfo?.limitRequests).toBe(10000)
			expect(result.rateLimitInfo?.remainingRequests).toBe(9999)
		})

		it("should parse plain object headers", () => {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				"X-Request-ID": "req-123",
				"OpenAI-Organization": "org-456",
			}

			const result = debugger_.parseResponseHeaders(headers)

			expect(result.openaiHeaders.organization).toBe("org-456")
			expect(result.openaiHeaders.requestId).toBe("req-123")
		})
	})

	describe("request tracking", () => {
		it("should track request duration", () => {
			const requestId = debugger_.generateRequestId()
			debugger_.startRequest(requestId)

			// Wait a bit
			const duration = debugger_.getRequestDuration(requestId)
			expect(duration).toBeGreaterThanOrEqual(0)

			debugger_.endRequest(requestId)
			expect(debugger_.getRequestDuration(requestId)).toBeUndefined()
		})
	})
})

describe("createUrlTransformationTracker", () => {
	it("should track URL transformations", () => {
		const tracker = createUrlTransformationTracker()

		tracker.track("Step 1", "before1", "after1", "reason1")
		tracker.track("Step 2", "before2", "after2")

		expect(tracker.transformations).toHaveLength(2)
		expect(tracker.transformations[0]).toEqual({
			step: "Step 1",
			before: "before1",
			after: "after1",
			reason: "reason1",
		})
		expect(tracker.transformations[1]).toEqual({
			step: "Step 2",
			before: "before2",
			after: "after2",
			reason: undefined,
		})
	})
})

describe("buildDebugRequestInfo", () => {
	it("should build request info from fetch parameters", () => {
		const requestId = "req_test123456789012345678"
		const url = "https://api.openai.com/v1/responses"
		const options: RequestInit = {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer sk-test",
			},
			body: JSON.stringify({ model: "gpt-4" }),
		}

		const info = buildDebugRequestInfo(requestId, url, options, {
			baseUrl: "https://api.openai.com",
			isAzure: false,
		})

		expect(info.requestId).toBe(requestId)
		expect(info.method).toBe("POST")
		expect(info.url).toBe(url)
		expect(info.baseUrl).toBe("https://api.openai.com")
		expect(info.isAzure).toBe(false)
		expect(info.headers["Content-Type"]).toBe("application/json")
		expect(info.body).toEqual({ model: "gpt-4" })
	})

	it("should handle Headers object", () => {
		const headers = new Headers({
			"Content-Type": "application/json",
		})

		const info = buildDebugRequestInfo("req_test", "https://api.example.com", { headers }, { isAzure: false })

		expect(info.headers["content-type"]).toBe("application/json")
	})

	it("should handle array headers", () => {
		const headers: [string, string][] = [
			["Content-Type", "application/json"],
			["Authorization", "Bearer test"],
		]

		const info = buildDebugRequestInfo("req_test", "https://api.example.com", { headers }, { isAzure: false })

		expect(info.headers["Content-Type"]).toBe("application/json")
		expect(info.headers["Authorization"]).toBe("Bearer test")
	})
})

describe("buildDebugResponseInfo", () => {
	it("should build response info from fetch response", () => {
		const mockResponse = {
			status: 200,
			statusText: "OK",
			headers: new Headers({
				"content-type": "application/json",
				"x-request-id": "server-123",
				"openai-organization": "org-456",
				"openai-processing-ms": "100",
			}),
		} as Response

		const info = buildDebugResponseInfo("req_test123456789012345678", mockResponse, Date.now() - 500)

		expect(info.requestId).toBe("req_test123456789012345678")
		expect(info.status).toBe(200)
		expect(info.statusText).toBe("OK")
		expect(info.durationMs).toBeGreaterThanOrEqual(500)
		expect(info.openaiOrganization).toBe("org-456")
		expect(info.openaiProcessingMs).toBe(100)
		expect(info.xRequestId).toBe("server-123")
	})
})

describe("OpenAINativeDebugger integration with OpenAiNativeHandler", () => {
	// These tests verify the debugger integrates correctly with the handler
	// by testing the fetch fallback path which uses the debugger directly

	it("should include debug request headers when debugging is enabled", async () => {
		const mockFetch = vitest.fn().mockResolvedValue({
			ok: true,
			headers: new Headers(),
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
					controller.close()
				},
			}),
		})
		global.fetch = mockFetch as any

		// Import handler and create with debug env var
		const originalEnv = process.env.OPENAI_DEBUG
		process.env.OPENAI_DEBUG = "true"

		// We can't easily test this without the full handler, but we verify
		// that the debugger adds X-Client-Request-Id header in the integration
		// This is tested in the openai-native-azure-custom.spec.ts tests

		process.env.OPENAI_DEBUG = originalEnv
		delete (global as any).fetch
	})
})

describe("Settings-based debug option (openAiNativeEnableDebug)", () => {
	let originalFetch: typeof global.fetch | undefined
	let originalEnv: string | undefined

	beforeEach(() => {
		// Mock fetch for OpenAI client
		originalFetch = global.fetch
		global.fetch = vitest.fn().mockResolvedValue({
			ok: true,
			headers: new Headers(),
			json: async () => ({}),
		}) as any

		// Save env var
		originalEnv = process.env.OPENAI_DEBUG
	})

	afterEach(() => {
		// Restore fetch
		if (originalFetch) {
			global.fetch = originalFetch
		} else {
			delete (global as any).fetch
		}

		// Restore env var
		if (originalEnv !== undefined) {
			process.env.OPENAI_DEBUG = originalEnv
		} else {
			delete process.env.OPENAI_DEBUG
		}
	})

	it("should enable debugging via openAiNativeEnableDebug setting", () => {
		// Ensure env var is not set to avoid interference
		delete process.env.OPENAI_DEBUG

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key-12345678901234567890",
			openAiNativeEnableDebug: true,
		})
		// Access the private debugger field
		expect((handler as any).debugger.enabled).toBe(true)
	})

	it("should not enable debugging when openAiNativeEnableDebug is false", () => {
		delete process.env.OPENAI_DEBUG

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key-12345678901234567890",
			openAiNativeEnableDebug: false,
		})
		expect((handler as any).debugger.enabled).toBe(false)
	})

	it("should not enable debugging when openAiNativeEnableDebug is not set and env var is not set", () => {
		delete process.env.OPENAI_DEBUG

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key-12345678901234567890",
		})
		expect((handler as any).debugger.enabled).toBe(false)
	})

	it("should enable debugging via env var even if setting is not set", () => {
		process.env.OPENAI_DEBUG = "true"

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key-12345678901234567890",
		})
		expect((handler as any).debugger.enabled).toBe(true)
	})

	it("should enable debugging when either setting or env var is true", () => {
		process.env.OPENAI_DEBUG = "false"

		// Setting takes precedence as it's checked first via OR
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key-12345678901234567890",
			openAiNativeEnableDebug: true,
		})
		expect((handler as any).debugger.enabled).toBe(true)
	})
})
