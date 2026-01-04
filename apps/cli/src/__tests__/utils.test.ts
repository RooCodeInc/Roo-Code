/**
 * Unit tests for CLI utility functions
 */

import { getEnvVarName, getApiKeyFromEnv, getDefaultExtensionPath } from "../utils.js"
import fs from "fs"
import path from "path"

// Mock fs module
vi.mock("fs")

describe("getEnvVarName", () => {
	it.each([
		["anthropic", "ANTHROPIC_API_KEY"],
		["openai", "OPENAI_API_KEY"],
		["openrouter", "OPENROUTER_API_KEY"],
		["google", "GOOGLE_API_KEY"],
		["gemini", "GOOGLE_API_KEY"],
		["bedrock", "AWS_ACCESS_KEY_ID"],
		["ollama", "OLLAMA_API_KEY"],
		["mistral", "MISTRAL_API_KEY"],
		["deepseek", "DEEPSEEK_API_KEY"],
	])("should return %s for %s provider", (provider, expectedEnvVar) => {
		expect(getEnvVarName(provider)).toBe(expectedEnvVar)
	})

	it("should handle case-insensitive provider names", () => {
		expect(getEnvVarName("ANTHROPIC")).toBe("ANTHROPIC_API_KEY")
		expect(getEnvVarName("Anthropic")).toBe("ANTHROPIC_API_KEY")
		expect(getEnvVarName("OpenRouter")).toBe("OPENROUTER_API_KEY")
	})

	it("should return uppercase provider name with _API_KEY suffix for unknown providers", () => {
		expect(getEnvVarName("custom")).toBe("CUSTOM_API_KEY")
		expect(getEnvVarName("myProvider")).toBe("MYPROVIDER_API_KEY")
	})
})

describe("getApiKeyFromEnv", () => {
	const originalEnv = process.env

	beforeEach(() => {
		// Reset process.env before each test
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
		expect(getApiKeyFromEnv("openai")).toBe("test-openai-key")
	})

	it("should return undefined when API key is not set", () => {
		delete process.env.ANTHROPIC_API_KEY
		expect(getApiKeyFromEnv("anthropic")).toBeUndefined()
	})

	it("should handle custom provider names", () => {
		process.env.CUSTOM_API_KEY = "test-custom-key"
		expect(getApiKeyFromEnv("custom")).toBe("test-custom-key")
	})

	it("should handle case-insensitive provider lookup", () => {
		process.env.ANTHROPIC_API_KEY = "test-key"
		expect(getApiKeyFromEnv("ANTHROPIC")).toBe("test-key")
	})
})

describe("getDefaultExtensionPath", () => {
	beforeEach(() => {
		vi.resetAllMocks()
	})

	it("should return monorepo path when extension.js exists there", () => {
		const mockDirname = "/test/apps/cli/dist"
		const expectedMonorepoPath = path.resolve(mockDirname, "../../../src/dist")

		vi.mocked(fs.existsSync).mockReturnValue(true)

		const result = getDefaultExtensionPath(mockDirname)

		expect(result).toBe(expectedMonorepoPath)
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(expectedMonorepoPath, "extension.js"))
	})

	it("should return package path when extension.js does not exist in monorepo path", () => {
		const mockDirname = "/test/apps/cli/dist"
		const expectedPackagePath = path.resolve(mockDirname, "../extension")

		vi.mocked(fs.existsSync).mockReturnValue(false)

		const result = getDefaultExtensionPath(mockDirname)

		expect(result).toBe(expectedPackagePath)
	})

	it("should check monorepo path first", () => {
		const mockDirname = "/some/path"
		vi.mocked(fs.existsSync).mockReturnValue(false)

		getDefaultExtensionPath(mockDirname)

		const expectedMonorepoPath = path.resolve(mockDirname, "../../../src/dist")
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(expectedMonorepoPath, "extension.js"))
	})
})
