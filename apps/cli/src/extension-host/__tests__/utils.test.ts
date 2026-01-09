import fs from "fs"
import path from "path"

import { getApiKeyFromEnv, getDefaultExtensionPath } from "../utils.js"

vi.mock("fs")

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

	it("should return undefined when API key is not set", () => {
		delete process.env.ANTHROPIC_API_KEY
		expect(getApiKeyFromEnv("anthropic")).toBeUndefined()
	})
})

describe("getDefaultExtensionPath", () => {
	const originalEnv = process.env

	beforeEach(() => {
		vi.resetAllMocks()
		// Reset process.env to avoid ROO_EXTENSION_PATH from installed CLI affecting tests.
		process.env = { ...originalEnv }
		delete process.env.ROO_EXTENSION_PATH
	})

	afterEach(() => {
		process.env = originalEnv
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
