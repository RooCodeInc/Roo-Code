import { describe, it, expect, vi, beforeEach } from "vitest"
import { handleOpenAIError } from "../openai-error-handler"

// Mock the i18n module
vi.mock("../../../../i18n/setup", () => ({
	default: {
		t: (key: string) => key,
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
			;(error as any).code = "ENOTFOUND"

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe(
				"TestProvider: Cannot resolve hostname. If this is an internal service, please connect to your corporate VPN.",
			)
		})

		it("should handle ECONNREFUSED errors with service verification guidance", () => {
			const error = new Error("connect ECONNREFUSED 127.0.0.1:11434")
			;(error as any).code = "ECONNREFUSED"

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe(
				"TestProvider: Service refused connection. The API endpoint is reachable but not accepting connections. Please verify the service is running.",
			)
		})

		it("should handle ETIMEDOUT errors with VPN stability guidance", () => {
			const error = new Error("connect ETIMEDOUT")
			;(error as any).code = "ETIMEDOUT"

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe(
				"TestProvider: Request timed out. If using an internal service, verify your VPN connection is stable.",
			)
		})

		it("should handle ENETUNREACH errors with network/VPN guidance", () => {
			const error = new Error("connect ENETUNREACH")
			;(error as any).code = "ENETUNREACH"

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe(
				"TestProvider: Network unreachable. Please check your network connection and VPN status if accessing internal services.",
			)
		})

		it("should handle ECONNRESET errors with connection stability guidance", () => {
			const error = new Error("socket hang up")
			;(error as any).code = "ECONNRESET"

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe(
				"TestProvider: Connection was reset. This may indicate network instability or VPN disconnection.",
			)
		})

		it("should handle certificate errors with VPN/cert guidance", () => {
			const error = new Error("self signed certificate in certificate chain")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe(
				"TestProvider: SSL/TLS certificate error. This often occurs with internal services. Please verify your VPN connection and certificate configuration.",
			)
		})

		it("should handle fetch failed errors with network/VPN guidance", () => {
			const error = new Error("fetch failed")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe(
				"TestProvider: Network request failed. Please check your internet connection and VPN status if accessing internal services.",
			)
		})
	})

	describe("Existing error handling", () => {
		it("should handle ByteString conversion errors", () => {
			const error = new Error(
				"Cannot convert argument to a ByteString because the character at index 5 has value 65533",
			)

			const result = handleOpenAIError(error, "TestProvider")

			expect(result).toBeInstanceOf(Error)
			expect(result.message).toBe("common:errors.api.invalidKeyInvalidChars")
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
	})

	describe("Error detection from message content", () => {
		it("should detect ENOTFOUND in error message without code", () => {
			const error = new Error("Error: getaddrinfo ENOTFOUND internal.api.com")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result.message).toBe(
				"TestProvider: Cannot resolve hostname. If this is an internal service, please connect to your corporate VPN.",
			)
		})

		it("should detect ECONNREFUSED in error message without code", () => {
			const error = new Error("Error: connect ECONNREFUSED 10.0.0.1:8080")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result.message).toBe(
				"TestProvider: Service refused connection. The API endpoint is reachable but not accepting connections. Please verify the service is running.",
			)
		})

		it("should detect ETIMEDOUT in error message without code", () => {
			const error = new Error("Request failed: ETIMEDOUT")

			const result = handleOpenAIError(error, "TestProvider")

			expect(result.message).toBe(
				"TestProvider: Request timed out. If using an internal service, verify your VPN connection is stable.",
			)
		})
	})
})
