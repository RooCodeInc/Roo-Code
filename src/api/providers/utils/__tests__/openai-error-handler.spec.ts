import { describe, it, expect, vi, beforeEach } from "vitest"
import { handleOpenAIError } from "../openai-error-handler"

// Mock the i18n module
vi.mock("../../../../i18n/setup", () => ({
	default: {
		t: (key: string) => {
			// Return the actual error messages from common.json for testing
			const translations: Record<string, string> = {
				"common:errors.api.invalidKeyInvalidChars": "API key contains invalid characters.",
				"common:errors.api.dnsResolutionFailed":
					"Cannot resolve hostname. This usually means you need to connect to your corporate VPN to access internal services. If you're using an internal API endpoint, please verify your VPN connection is active.",
				"common:errors.api.connectionRefused":
					"Service refused connection. The API endpoint is reachable but not accepting connections. Please verify the service is running and the port is correct.",
				"common:errors.api.connectionTimeout":
					"Request timed out. The API endpoint may be unreachable or experiencing issues. If using an internal service, verify your VPN connection is stable.",
			}
			return translations[key] || key
		},
	},
}))

describe("handleOpenAIError", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(console, "error").mockImplementation(() => {})
	})

	describe("VPN-related error messages", () => {
		it("should handle ENOTFOUND errors with VPN guidance", () => {
			const error = new Error("getaddrinfo ENOTFOUND api.internal.company.com")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toContain("TestProvider connection error:")
			expect(result.message).toContain("Cannot resolve hostname")
			expect(result.message).toContain("corporate VPN")
		})

		it("should handle 'Could not resolve host' errors", () => {
			const error = new Error("Could not resolve host: mskongai.use.ucdp.net")

			const result = handleOpenAIError(error, "KongAI")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toContain("KongAI connection error:")
			expect(result.message).toContain("Cannot resolve hostname")
		})

		it("should handle getaddrinfo errors", () => {
			const error = new Error("getaddrinfo EAI_AGAIN internal-api.company.com")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toContain("Cannot resolve hostname")
		})

		it("should handle ECONNREFUSED errors with service verification guidance", () => {
			const error = new Error("connect ECONNREFUSED 127.0.0.1:11434")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toContain("TestProvider connection error:")
			expect(result.message).toContain("Service refused connection")
			expect(result.message).toContain("verify the service is running")
		})

		it("should handle Connection refused errors", () => {
			const error = new Error("Connection refused by server")

			const result = handleOpenAIError(error, "Ollama")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toContain("Service refused connection")
		})

		it("should handle ETIMEDOUT errors with VPN stability guidance", () => {
			const error = new Error("connect ETIMEDOUT")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toContain("TestProvider connection error:")
			expect(result.message).toContain("Request timed out")
			expect(result.message).toContain("VPN connection is stable")
		})

		it("should handle generic timeout errors", () => {
			const error = new Error("Request timeout after 30 seconds")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toContain("timed out")
		})
	})

	describe("Existing error handling", () => {
		it("should handle ByteString conversion errors", () => {
			const error = new Error(
				"Cannot convert argument to a ByteString because the character at index 5 has value 65533",
			)

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe("API key contains invalid characters.")
		})

		it("should handle generic Connection error without refused", () => {
			const error = new Error("Connection error occurred during request")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toContain("Cannot resolve hostname")
		})

		it("should handle generic errors with provider prefix", () => {
			const error = new Error("Some other API error")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe("TestProvider completion error: Some other API error")
		})

		it("should handle non-Error objects", () => {
			const error = "String error"

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe("TestProvider completion error: String error")
		})

		it("should handle null error", () => {
			const error = null

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe("TestProvider completion error: null")
		})

		it("should handle undefined error", () => {
			const error = undefined

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe("TestProvider completion error: undefined")
		})
	})

	describe("Error pattern detection", () => {
		it("should prioritize ByteString errors over other patterns", () => {
			const error = new Error(
				"Cannot convert argument to a ByteString and also ENOTFOUND occurred",
			)

			const result = handleOpenAIError(error, "TestProvider")

			expect(result.message).toBe("API key contains invalid characters.")
		})

		it("should prioritize DNS errors over connection errors when both present", () => {
			const error = new Error("ENOTFOUND and Connection error both occurred")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result.message).toContain("Cannot resolve hostname")
		})

		it("should distinguish between connection refused and other connection errors", () => {
			const error = new Error("ECONNREFUSED - Connection error")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result.message).toContain("Service refused connection")
		})

		it("should handle EAI_AGAIN DNS errors", () => {
			const error = new Error("EAI_AGAIN dns lookup failed")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result.message).toContain("Cannot resolve hostname")
		})
	})

	describe("Console logging", () => {
		it("should log Error instances to console with details", () => {
			const error = new Error("Test error")
			const consoleErrorSpy = vi.spyOn(console, "error")

			handleOpenAIError(error, "TestProvider")

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[TestProvider] API error:",
				expect.objectContaining({
					message: "Test error",
					name: "Error",
				}),
			)
		})

		it("should log non-Error exceptions to console", () => {
			const error = { custom: "error object" }
			const consoleErrorSpy = vi.spyOn(console, "error")

			handleOpenAIError(error, "TestProvider")

			expect(consoleErrorSpy).toHaveBeenCalledWith("[TestProvider] Non-Error exception:", error)
		})
	})

	describe("Provider name integration", () => {
		it("should include provider name in DNS errors", () => {
			const error = new Error("ENOTFOUND")

			const result = handleOpenAIError(error, "OpenRouter")

			expect(result.message).toContain("OpenRouter connection error:")
		})

		it("should include provider name in connection refused errors", () => {
			const error = new Error("ECONNREFUSED")

			const result = handleOpenAIError(error, "Anthropic")

			expect(result.message).toContain("Anthropic connection error:")
		})

		it("should include provider name in timeout errors", () => {
			const error = new Error("ETIMEDOUT")

			const result = handleOpenAIError(error, "OpenAI")

			expect(result.message).toContain("OpenAI connection error:")
		})

		it("should include provider name in generic errors", () => {
			const error = new Error("Unknown error")

			const result = handleOpenAIError(error, "Gemini")

			expect(result.message).toContain("Gemini completion error:")
		})
	})
})
