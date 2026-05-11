import { redactSensitiveInfo, redactDiagnosticsData } from "../redact"

describe("redactSensitiveInfo", () => {
	it("should return non-string inputs unchanged", () => {
		expect(redactSensitiveInfo(null as any)).toBe(null)
		expect(redactSensitiveInfo(undefined as any)).toBe(undefined)
		expect(redactSensitiveInfo("" as any)).toBe("")
	})

	it("should redact Anthropic API keys", () => {
		const input = "Using key sk-ant-api03-abcdefghijklmnopqrst1234567890"
		const result = redactSensitiveInfo(input)
		expect(result).toContain("[ANTHROPIC_API_KEY]")
		expect(result).not.toContain("sk-ant-api03")
	})

	it("should redact OpenAI API keys", () => {
		const input = "My key is sk-abcdefghijklmnopqrstuvwxyz1234567890"
		const result = redactSensitiveInfo(input)
		expect(result).toContain("[OPENAI_API_KEY]")
		expect(result).not.toContain("sk-abcdefghijklmnopqrstuvwxyz")
	})

	it("should redact OpenRouter API keys", () => {
		const input = "Using sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890"
		const result = redactSensitiveInfo(input)
		expect(result).toContain("[OPENROUTER_API_KEY]")
		expect(result).not.toContain("sk-or-v1-abcdefghijklmnopqrstuvwxyz")
	})

	it("should redact GitHub tokens", () => {
		const input = "Token: ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"
		const result = redactSensitiveInfo(input)
		expect(result).toContain("[GITHUB_TOKEN]")
		expect(result).not.toContain("ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ")
	})

	it("should redact Bearer tokens", () => {
		const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0"
		const result = redactSensitiveInfo(input)
		expect(result).toContain("[BEARER_TOKEN]")
		expect(result).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
	})

	it("should redact Google API keys", () => {
		const input = "Using AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz0123456"
		const result = redactSensitiveInfo(input)
		expect(result).toContain("[GOOGLE_API_KEY]")
		expect(result).not.toContain("AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz")
	})

	it("should redact AWS access keys", () => {
		const input = "AWS key: AKIAIOSFODNN7EXAMPLE"
		const result = redactSensitiveInfo(input)
		expect(result).toContain("[AWS_ACCESS_KEY]")
		expect(result).not.toContain("AKIAIOSFODNN7EXAMPLE")
	})

	it("should redact environment variable assignments with secret-like names", () => {
		const input = "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz1234567890"
		const result = redactSensitiveInfo(input)
		expect(result).toContain("OPENAI_API_KEY=[REDACTED]")
		expect(result).not.toContain("sk-abcdefghijklmnopqrstuvwxyz")
	})

	it("should redact quoted environment variable assignments", () => {
		const input = 'export MY_SECRET_TOKEN="supersecretvalue123456"'
		const result = redactSensitiveInfo(input)
		expect(result).toContain("[REDACTED]")
		expect(result).not.toContain("supersecretvalue123456")
	})

	it("should redact key-value pairs in JSON-like strings", () => {
		const input = '"api_key": "abcdef1234567890abcdef1234567890ab"'
		const result = redactSensitiveInfo(input)
		expect(result).toContain("[REDACTED_SECRET]")
		expect(result).not.toContain("abcdef1234567890abcdef1234567890ab")
	})

	it("should not redact normal text", () => {
		const input = "This is a normal conversation about code review and testing."
		const result = redactSensitiveInfo(input)
		expect(result).toBe(input)
	})

	it("should handle multiple sensitive values in the same string", () => {
		const input = "Keys: sk-ant-api03-abcdefghijklmnopqrst1234567890 and ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"
		const result = redactSensitiveInfo(input)
		expect(result).toContain("[ANTHROPIC_API_KEY]")
		expect(result).toContain("[GITHUB_TOKEN]")
	})
})

describe("redactDiagnosticsData", () => {
	it("should return null/undefined unchanged", () => {
		expect(redactDiagnosticsData(null)).toBe(null)
		expect(redactDiagnosticsData(undefined)).toBe(undefined)
	})

	it("should return numbers and booleans unchanged", () => {
		expect(redactDiagnosticsData(42)).toBe(42)
		expect(redactDiagnosticsData(true)).toBe(true)
	})

	it("should redact strings", () => {
		const result = redactDiagnosticsData("key: sk-ant-api03-abcdefghijklmnopqrst1234567890")
		expect(result).toContain("[ANTHROPIC_API_KEY]")
	})

	it("should redact values in objects with secret-like keys", () => {
		const input = {
			apiKey: "some-secret-value",
			model: "gpt-4",
			api_key: "another-secret",
		}
		const result = redactDiagnosticsData(input) as Record<string, unknown>
		expect(result.apiKey).toBe("[REDACTED]")
		expect(result.api_key).toBe("[REDACTED]")
		expect(result.model).toBe("gpt-4")
	})

	it("should recursively redact nested objects", () => {
		const input = {
			error: {
				details: "Failed with sk-ant-api03-abcdefghijklmnopqrst1234567890",
			},
			history: [
				{
					role: "user",
					content: "My token is ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789",
				},
			],
		}
		const result = redactDiagnosticsData(input) as any
		expect(result.error.details).toContain("[ANTHROPIC_API_KEY]")
		expect(result.history[0].content).toContain("[GITHUB_TOKEN]")
	})

	it("should redact known secret field names regardless of value pattern", () => {
		const input = {
			password: "mysimplepassword",
			token: "short-but-secret",
			authorization: "Basic dXNlcjpwYXNz",
		}
		const result = redactDiagnosticsData(input) as Record<string, unknown>
		expect(result.password).toBe("[REDACTED]")
		expect(result.token).toBe("[REDACTED]")
		expect(result.authorization).toBe("[REDACTED]")
	})

	it("should not redact empty string values for secret keys", () => {
		const input = {
			apiKey: "",
			password: "",
		}
		const result = redactDiagnosticsData(input) as Record<string, unknown>
		// Empty strings are kept as-is (no secret to redact)
		expect(result.apiKey).toBe("")
		expect(result.password).toBe("")
	})

	it("should handle deeply nested arrays", () => {
		const input = [
			[
				{
					content: [{ type: "text", text: "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghijklmnop" }],
				},
			],
		]
		const result = redactDiagnosticsData(input) as any
		expect(result[0][0].content[0].text).toContain("[BEARER_TOKEN]")
	})

	it("should handle a realistic diagnostics payload", () => {
		const diagnostics = {
			error: {
				timestamp: "2025-01-01T00:00:00.000Z",
				version: "1.2.3",
				provider: "anthropic",
				model: "claude-sonnet-4-20250514",
				details: "API error occurred",
			},
			history: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Please use my API key sk-ant-api03-abcdefghijklmnopqrst1234567890 to make the request",
						},
					],
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: "I'll help with that request.",
						},
					],
				},
			],
		}
		const result = redactDiagnosticsData(diagnostics) as any
		// Error metadata should be preserved
		expect(result.error.timestamp).toBe("2025-01-01T00:00:00.000Z")
		expect(result.error.version).toBe("1.2.3")
		expect(result.error.provider).toBe("anthropic")
		// Sensitive data in history should be redacted
		expect(result.history[0].content[0].text).toContain("[ANTHROPIC_API_KEY]")
		expect(result.history[0].content[0].text).not.toContain("sk-ant-api03")
		// Normal text should be preserved
		expect(result.history[1].content[0].text).toBe("I'll help with that request.")
	})
})
