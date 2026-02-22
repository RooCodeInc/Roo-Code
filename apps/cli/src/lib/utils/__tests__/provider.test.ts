import { getApiKeyFromEnv, getProviderAuthMode, providerRequiresApiKey, providerSupportsOAuth } from "../provider.js"

describe("getProviderAuthMode", () => {
	it("should return oauth for openai-codex", () => {
		expect(getProviderAuthMode("openai-codex")).toBe("oauth")
	})

	it("should return roo-token for roo", () => {
		expect(getProviderAuthMode("roo")).toBe("roo-token")
	})

	it.each(["anthropic", "openai-native", "gemini", "openrouter", "vercel-ai-gateway"] as const)(
		"should return api-key for %s",
		(provider) => {
			expect(getProviderAuthMode(provider)).toBe("api-key")
		},
	)
})

describe("providerRequiresApiKey", () => {
	it.each(["anthropic", "openai-native", "gemini", "openrouter", "vercel-ai-gateway"] as const)(
		"should require API key for %s",
		(provider) => {
			expect(providerRequiresApiKey(provider)).toBe(true)
		},
	)

	it("should not require API key for roo", () => {
		expect(providerRequiresApiKey("roo")).toBe(false)
	})

	it("should not require API key for openai-codex", () => {
		expect(providerRequiresApiKey("openai-codex")).toBe(false)
	})
})

describe("providerSupportsOAuth", () => {
	it("should support OAuth for openai-codex", () => {
		expect(providerSupportsOAuth("openai-codex")).toBe(true)
	})

	it.each(["anthropic", "openai-native", "gemini", "openrouter", "vercel-ai-gateway", "roo"] as const)(
		"should not support OAuth for %s",
		(provider) => {
			expect(providerSupportsOAuth(provider)).toBe(false)
		},
	)
})

describe("getApiKeyFromEnv", () => {
	const originalEnv = process.env

	beforeEach(() => {
		// Reset process.env before each test.
		process.env = { ...originalEnv }
	})

	afterEach(() => {
		process.env = originalEnv
	})

	it("should return API key from environment variable for anthropic", () => {
		process.env.ANTHROPIC_API_KEY = "test-anthropic-key"
		expect(getApiKeyFromEnv("anthropic")).toBe("test-anthropic-key")
	})

	it("should return API key from environment variable for openrouter", () => {
		process.env.OPENROUTER_API_KEY = "test-openrouter-key"
		expect(getApiKeyFromEnv("openrouter")).toBe("test-openrouter-key")
	})

	it("should return API key from environment variable for openai", () => {
		process.env.OPENAI_API_KEY = "test-openai-key"
		expect(getApiKeyFromEnv("openai-native")).toBe("test-openai-key")
	})

	it("should not read API key from environment variable for openai-codex", () => {
		process.env.OPENAI_API_KEY = "test-openai-codex-key"
		expect(getApiKeyFromEnv("openai-codex")).toBeUndefined()
	})

	it("should return undefined when API key is not set", () => {
		delete process.env.ANTHROPIC_API_KEY
		expect(getApiKeyFromEnv("anthropic")).toBeUndefined()
	})
})
