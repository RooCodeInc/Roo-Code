import { getApiKeyFromEnv, getProviderSettings } from "../provider.js"

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

	it("should return API key from environment variable for litellm", () => {
		process.env.LITELLM_API_KEY = "test-litellm-key"
		expect(getApiKeyFromEnv("litellm")).toBe("test-litellm-key")
	})

	it("should return undefined when API key is not set", () => {
		delete process.env.ANTHROPIC_API_KEY
		expect(getApiKeyFromEnv("anthropic")).toBeUndefined()
	})
})

describe("getProviderSettings", () => {
	it("should return LiteLLM settings with API key, model, and base URL", () => {
		const settings = getProviderSettings("litellm", "test-api-key", "claude-3-sonnet", "http://localhost:4000")
		expect(settings).toEqual({
			apiProvider: "litellm",
			litellmApiKey: "test-api-key",
			litellmModelId: "claude-3-sonnet",
			litellmBaseUrl: "http://localhost:4000",
		})
	})

	it("should return LiteLLM settings without base URL when not provided", () => {
		const settings = getProviderSettings("litellm", "test-api-key", "claude-3-sonnet")
		expect(settings).toEqual({
			apiProvider: "litellm",
			litellmApiKey: "test-api-key",
			litellmModelId: "claude-3-sonnet",
		})
	})

	it("should return LiteLLM settings with only API key when model is not provided", () => {
		const settings = getProviderSettings("litellm", "test-api-key", undefined)
		expect(settings).toEqual({
			apiProvider: "litellm",
			litellmApiKey: "test-api-key",
		})
	})

	it("should return anthropic settings correctly", () => {
		const settings = getProviderSettings("anthropic", "test-api-key", "claude-3-opus")
		expect(settings).toEqual({
			apiProvider: "anthropic",
			apiKey: "test-api-key",
			apiModelId: "claude-3-opus",
		})
	})
})
