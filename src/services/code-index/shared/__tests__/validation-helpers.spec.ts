import { sanitizeErrorMessage, handleValidationError } from "../validation-helpers"

vi.mock("../../../../i18n", () => ({
	t: (key: string) => {
		// Return the key itself for testing purposes
		const translations: Record<string, string> = {
			"common:errors.api.invalidKeyInvalidChars": "API key contains invalid characters.",
			"embeddings:validation.connectionFailed": "Connection failed",
			"embeddings:validation.invalidResponse": "Invalid response",
			"embeddings:validation.configurationError": "Configuration error",
			"embeddings:validation.authenticationFailed": "Authentication failed",
			"embeddings:validation.modelNotAvailable": "Model not available",
			"embeddings:validation.invalidEndpoint": "Invalid endpoint",
			"embeddings:validation.serviceUnavailable": "Service unavailable",
		}
		return translations[key] || key
	},
}))

describe("sanitizeErrorMessage", () => {
	it("should sanitize Unix-style file paths", () => {
		const input = "Error reading file /Users/username/projects/myapp/src/index.ts"
		const expected = "Error reading file [REDACTED_PATH]"
		expect(sanitizeErrorMessage(input)).toBe(expected)
	})

	it("should sanitize Windows-style file paths", () => {
		const input = "Cannot access C:\\Users\\username\\Documents\\project\\file.js"
		const expected = "Cannot access [REDACTED_PATH]"
		expect(sanitizeErrorMessage(input)).toBe(expected)
	})

	it("should sanitize relative file paths", () => {
		const input = "File not found: ./src/components/Button.tsx"
		const expected = "File not found: [REDACTED_PATH]"
		expect(sanitizeErrorMessage(input)).toBe(expected)

		const input2 = "Cannot read ../config/settings.json"
		const expected2 = "Cannot read [REDACTED_PATH]"
		expect(sanitizeErrorMessage(input2)).toBe(expected2)
	})

	it("should sanitize URLs with various protocols", () => {
		const input = "Failed to connect to http://localhost:11434/api/embed"
		const expected = "Failed to connect to [REDACTED_URL]"
		expect(sanitizeErrorMessage(input)).toBe(expected)

		const input2 = "Error fetching https://api.example.com:8080/v1/embeddings"
		const expected2 = "Error fetching [REDACTED_URL]"
		expect(sanitizeErrorMessage(input2)).toBe(expected2)
	})

	it("should sanitize IP addresses", () => {
		const input = "Connection refused at 192.168.1.100"
		const expected = "Connection refused at [REDACTED_IP]"
		expect(sanitizeErrorMessage(input)).toBe(expected)
	})

	it("should sanitize port numbers", () => {
		const input = "Server running on :8080 failed"
		const expected = "Server running on :[REDACTED_PORT] failed"
		expect(sanitizeErrorMessage(input)).toBe(expected)
	})

	it("should sanitize email addresses", () => {
		const input = "User john.doe@example.com not found"
		const expected = "User [REDACTED_EMAIL] not found"
		expect(sanitizeErrorMessage(input)).toBe(expected)
	})

	it("should sanitize paths in quotes", () => {
		const input = 'Cannot open file "/home/user/documents/secret.txt"'
		const expected = 'Cannot open file "[REDACTED_PATH]"'
		expect(sanitizeErrorMessage(input)).toBe(expected)
	})

	it("should handle complex error messages with multiple sensitive items", () => {
		const input = "Failed to fetch http://localhost:11434 from /Users/john/project at 192.168.1.1:3000"
		const expected = "Failed to fetch [REDACTED_URL] from [REDACTED_PATH] at [REDACTED_IP]:[REDACTED_PORT]"
		expect(sanitizeErrorMessage(input)).toBe(expected)
	})

	it("should handle non-string inputs gracefully", () => {
		expect(sanitizeErrorMessage(null as any)).toBe("null")
		expect(sanitizeErrorMessage(undefined as any)).toBe("undefined")
		expect(sanitizeErrorMessage(123 as any)).toBe("123")
		expect(sanitizeErrorMessage({} as any)).toBe("[object Object]")
	})

	it("should preserve non-sensitive error messages", () => {
		const input = "Invalid JSON format"
		expect(sanitizeErrorMessage(input)).toBe(input)

		const input2 = "Connection timeout"
		expect(sanitizeErrorMessage(input2)).toBe(input2)
	})

	it("should handle file paths with special characters", () => {
		const input = 'Error in "/path/to/file with spaces.txt"'
		const expected = 'Error in "[REDACTED_PATH]"'
		expect(sanitizeErrorMessage(input)).toBe(expected)
	})

	it("should sanitize multiple occurrences of sensitive data", () => {
		const input = "Copy from /src/file1.js to /dest/file2.js failed"
		const expected = "Copy from [REDACTED_PATH] to [REDACTED_PATH] failed"
		expect(sanitizeErrorMessage(input)).toBe(expected)
	})
})

describe("handleValidationError", () => {
	it("should handle ByteString conversion error with user-friendly message", () => {
		const error = new Error(
			"Cannot convert argument to a ByteString because the character at index 8 has a value of 1040 which is greater than 255",
		)
		const result = handleValidationError(error, "openai-compatible")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("API key contains invalid characters.")
	})

	it("should handle ByteString error with various character indices", () => {
		const error = new Error(
			"Cannot convert argument to a ByteString because the character at index 0 has a value of 256",
		)
		const result = handleValidationError(error, "openai")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("API key contains invalid characters.")
	})

	it("should handle connection refused errors", () => {
		const error = new Error("ECONNREFUSED 127.0.0.1:11434")
		const result = handleValidationError(error, "ollama")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Connection failed")
	})

	it("should handle ENOTFOUND errors", () => {
		const error = new Error("getaddrinfo ENOTFOUND api.example.com")
		const result = handleValidationError(error, "openai")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Connection failed")
	})

	it("should handle timeout errors", () => {
		const error = new Error("ETIMEDOUT")
		const result = handleValidationError(error, "openai")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Connection failed")
	})

	it("should handle invalid JSON response errors", () => {
		const error = new Error("Failed to parse response JSON")
		const result = handleValidationError(error, "openai")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Invalid response")
	})

	it("should preserve generic error messages", () => {
		const error = new Error("Something went wrong")
		const result = handleValidationError(error, "openai")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Something went wrong")
	})

	it("should handle errors with status codes", () => {
		const error = { status: 401, message: "Unauthorized" }
		const result = handleValidationError(error, "openai")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Authentication failed")
	})

	it("should handle 404 errors for openai provider", () => {
		const error = { status: 404, message: "Not Found" }
		const result = handleValidationError(error, "openai")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Model not available")
	})

	it("should handle 404 errors for non-openai providers", () => {
		const error = { status: 404, message: "Not Found" }
		const result = handleValidationError(error, "ollama")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Invalid endpoint")
	})

	it("should handle rate limit errors", () => {
		const error = { status: 429, message: "Too Many Requests" }
		const result = handleValidationError(error, "openai")
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Service unavailable")
	})

	it("should allow custom handlers to override standard handling", () => {
		const error = new Error("Custom error")
		const customHandlers = {
			beforeStandardHandling: () => ({ valid: false, error: "Custom handled error" }),
		}
		const result = handleValidationError(error, "openai", customHandlers)
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Custom handled error")
	})

	it("should continue with standard handling if custom handler returns undefined", () => {
		const error = new Error("ECONNREFUSED")
		const customHandlers = {
			beforeStandardHandling: () => undefined,
		}
		const result = handleValidationError(error, "openai", customHandlers)
		expect(result.valid).toBe(false)
		expect(result.error).toBe("Connection failed")
	})
})
