import { sanitizeErrorMessage, getErrorMessageForStatus } from "../validation-helpers"

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

describe("getErrorMessageForStatus", () => {
	it("should return authenticationFailed for 401", () => {
		expect(getErrorMessageForStatus(401, "openai")).toBe("validation.authenticationFailed")
	})

	it("should return authenticationFailed for 403", () => {
		expect(getErrorMessageForStatus(403, "openai")).toBe("validation.authenticationFailed")
	})

	it("should return modelNotAvailable for 404 with openai embedder", () => {
		expect(getErrorMessageForStatus(404, "openai")).toBe("validation.modelNotAvailable")
	})

	it("should return invalidEndpoint for 404 with non-openai embedder", () => {
		expect(getErrorMessageForStatus(404, "ollama")).toBe("validation.invalidEndpoint")
	})

	it("should return rateLimitExceeded for 429", () => {
		expect(getErrorMessageForStatus(429, "openai")).toBe("validation.rateLimitExceeded")
	})

	it("should return badGateway for 502", () => {
		expect(getErrorMessageForStatus(502, "openai")).toBe("validation.badGateway")
	})

	it("should return serviceUnavailable for 503", () => {
		expect(getErrorMessageForStatus(503, "openai")).toBe("validation.serviceUnavailable")
	})

	it("should return gatewayTimeout for 504", () => {
		expect(getErrorMessageForStatus(504, "openai")).toBe("validation.gatewayTimeout")
	})

	it("should return serverError for other 5xx errors", () => {
		expect(getErrorMessageForStatus(500, "openai")).toBe("validation.serverError")
		expect(getErrorMessageForStatus(501, "openai")).toBe("validation.serverError")
		expect(getErrorMessageForStatus(505, "openai")).toBe("validation.serverError")
		expect(getErrorMessageForStatus(599, "openai")).toBe("validation.serverError")
	})

	it("should return undefined for unknown status", () => {
		expect(getErrorMessageForStatus(undefined, "openai")).toBeUndefined()
		expect(getErrorMessageForStatus(200, "openai")).toBeUndefined()
		expect(getErrorMessageForStatus(301, "openai")).toBeUndefined()
	})
})
