import { normalizeOpenAiBaseUrl } from "../normalizeOpenAiBaseUrl"

describe("normalizeOpenAiBaseUrl", () => {
	const defaultUrl = "https://api.openai.com"

	describe("when baseUrl is empty or undefined", () => {
		it("should return the normalized default URL when baseUrl is undefined", () => {
			expect(normalizeOpenAiBaseUrl(undefined, defaultUrl)).toBe(defaultUrl)
		})

		it("should return the normalized default URL when baseUrl is empty string", () => {
			expect(normalizeOpenAiBaseUrl("", defaultUrl)).toBe(defaultUrl)
		})

		it("should return the normalized default URL when baseUrl is whitespace", () => {
			expect(normalizeOpenAiBaseUrl("   ", defaultUrl)).toBe(defaultUrl)
		})
	})

	describe("when baseUrl does not have /v1 suffix", () => {
		it("should return the URL as-is for a simple URL", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example", defaultUrl)).toBe("https://my-host.example")
		})

		it("should remove trailing slash", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example/", defaultUrl)).toBe("https://my-host.example")
		})

		it("should remove multiple trailing slashes", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example///", defaultUrl)).toBe("https://my-host.example")
		})

		it("should handle URL with port", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example:8080", defaultUrl)).toBe(
				"https://my-host.example:8080",
			)
		})

		it("should handle URL with path", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example/api", defaultUrl)).toBe(
				"https://my-host.example/api",
			)
		})
	})

	describe("when baseUrl has /v1 suffix", () => {
		it("should strip /v1 suffix", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example/v1", defaultUrl)).toBe("https://my-host.example")
		})

		it("should strip /v1/ suffix with trailing slash", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example/v1/", defaultUrl)).toBe("https://my-host.example")
		})

		it("should strip /v1 suffix with multiple trailing slashes", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example/v1///", defaultUrl)).toBe("https://my-host.example")
		})

		it("should handle URL with port and /v1 suffix", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example:8080/v1", defaultUrl)).toBe(
				"https://my-host.example:8080",
			)
		})

		it("should handle URL with path and /v1 suffix", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example/api/v1", defaultUrl)).toBe(
				"https://my-host.example/api",
			)
		})

		it("should be case-insensitive for /v1 suffix", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example/V1", defaultUrl)).toBe("https://my-host.example")
		})
	})

	describe("when default URL has /v1 suffix", () => {
		it("should normalize default URL by stripping /v1", () => {
			expect(normalizeOpenAiBaseUrl(undefined, "https://api.openai.com/v1")).toBe("https://api.openai.com")
		})

		it("should normalize default URL by stripping /v1/", () => {
			expect(normalizeOpenAiBaseUrl("", "https://api.openai.com/v1/")).toBe("https://api.openai.com")
		})
	})

	describe("edge cases", () => {
		it("should handle localhost URLs", () => {
			expect(normalizeOpenAiBaseUrl("http://localhost:4000/v1", defaultUrl)).toBe("http://localhost:4000")
		})

		it("should handle IP address URLs", () => {
			expect(normalizeOpenAiBaseUrl("http://192.168.1.100:8080/v1", defaultUrl)).toBe("http://192.168.1.100:8080")
		})

		it("should trim whitespace from URL", () => {
			expect(normalizeOpenAiBaseUrl("  https://my-host.example/v1  ", defaultUrl)).toBe("https://my-host.example")
		})

		it("should not remove v1 from the middle of the path", () => {
			expect(normalizeOpenAiBaseUrl("https://my-host.example/v1/api", defaultUrl)).toBe(
				"https://my-host.example/v1/api",
			)
		})

		it("should not remove v1 if it is part of the hostname", () => {
			expect(normalizeOpenAiBaseUrl("https://api-v1.example.com", defaultUrl)).toBe("https://api-v1.example.com")
		})
	})

	describe("real-world scenarios", () => {
		it("should handle official OpenAI URL without /v1", () => {
			expect(normalizeOpenAiBaseUrl("https://api.openai.com", defaultUrl)).toBe("https://api.openai.com")
		})

		it("should handle official OpenAI URL with /v1", () => {
			expect(normalizeOpenAiBaseUrl("https://api.openai.com/v1", defaultUrl)).toBe("https://api.openai.com")
		})

		it("should handle Azure OpenAI URLs", () => {
			expect(normalizeOpenAiBaseUrl("https://myinstance.openai.azure.com", defaultUrl)).toBe(
				"https://myinstance.openai.azure.com",
			)
		})

		it("should handle custom proxy URLs", () => {
			expect(normalizeOpenAiBaseUrl("https://proxy.example.com/openai/v1", defaultUrl)).toBe(
				"https://proxy.example.com/openai",
			)
		})
	})
})
