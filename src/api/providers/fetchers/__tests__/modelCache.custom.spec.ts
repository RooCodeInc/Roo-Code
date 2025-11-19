import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getModels, flushModels } from "../modelCache"
import * as customModels from "../../../../services/custom-models"
import * as openrouter from "../openrouter"

// Mock file data storage
const mockReadFileData: Record<string, any> = {}

// Mock the custom models service
vi.mock("../../../../services/custom-models", () => ({
	getCustomModelsForProvider: vi.fn(),
}))

// Mock the openrouter fetcher
vi.mock("../openrouter", () => ({
	getOpenRouterModels: vi.fn(),
}))

// Mock other dependencies
vi.mock("../../../../utils/path", () => ({
	getWorkspacePath: vi.fn(() => "/test/workspace"),
}))

vi.mock("../../../../core/config/ContextProxy", () => ({
	ContextProxy: {
		instance: {
			globalStorageUri: {
				fsPath: "/test/storage",
			},
		},
	},
}))

vi.mock("../../../../utils/storage", () => ({
	getCacheDirectoryPath: vi.fn(() => "/test/cache"),
}))

// Mock safeWriteJson to populate our mock file data
vi.mock("../../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn((filePath: string, data: any) => {
		mockReadFileData[filePath] = data
		return Promise.resolve()
	}),
}))

// Mock fs.readFile to return the models that were written
vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn((filePath: string) => {
			const data = mockReadFileData[filePath]
			if (!data) throw new Error("File not found")
			return Promise.resolve(JSON.stringify(data))
		}),
	},
	readFile: vi.fn((filePath: string) => {
		const data = mockReadFileData[filePath]
		if (!data) throw new Error("File not found")
		return Promise.resolve(JSON.stringify(data))
	}),
}))

vi.mock("../../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn((filePath: string) => {
		return Promise.resolve(filePath in mockReadFileData)
	}),
}))

describe("Model Cache with Custom Models", () => {
	beforeEach(async () => {
		vi.clearAllMocks()
		// Clear both memory cache and mock file cache before each test
		await flushModels("openrouter")
		// Clear the mock file cache
		Object.keys(mockReadFileData).forEach((key) => delete mockReadFileData[key])
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should merge custom models with provider-fetched models", async () => {
		const providerModels = {
			"openai/gpt-4": {
				maxTokens: 8000,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: false,
			},
		}

		const customModelDefs = {
			"custom/my-model": {
				maxTokens: 4096,
				contextWindow: 32000,
				supportsPromptCache: false,
				description: "My custom model",
			},
		}

		vi.mocked(openrouter.getOpenRouterModels).mockResolvedValueOnce(providerModels)
		vi.mocked(customModels.getCustomModelsForProvider).mockResolvedValueOnce(customModelDefs)

		const result = await getModels({ provider: "openrouter" })

		expect(result).toEqual({
			...providerModels,
			...customModelDefs,
		})
		expect(openrouter.getOpenRouterModels).toHaveBeenCalledTimes(1)
		expect(customModels.getCustomModelsForProvider).toHaveBeenCalledWith("openrouter", "/test/workspace")
	})

	it("should allow custom models to override provider models", async () => {
		const providerModels = {
			"openai/gpt-4": {
				maxTokens: 8000,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: false,
			},
		}

		const customModelDefs = {
			"openai/gpt-4": {
				maxTokens: 16000, // Override max tokens
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: false,
				description: "Custom GPT-4 with higher token limit",
			},
		}

		vi.mocked(openrouter.getOpenRouterModels).mockResolvedValueOnce(providerModels)
		vi.mocked(customModels.getCustomModelsForProvider).mockResolvedValueOnce(customModelDefs)

		const result = await getModels({ provider: "openrouter" })

		expect(result["openai/gpt-4"]).toEqual(customModelDefs["openai/gpt-4"])
		expect(result["openai/gpt-4"].maxTokens).toBe(16000)
	})

	it("should handle empty custom models gracefully", async () => {
		const providerModels = {
			"openai/gpt-4": {
				maxTokens: 8000,
				contextWindow: 128000,
				supportsPromptCache: false,
			},
		}

		vi.mocked(openrouter.getOpenRouterModels).mockResolvedValueOnce(providerModels)
		vi.mocked(customModels.getCustomModelsForProvider).mockResolvedValueOnce({})

		const result = await getModels({ provider: "openrouter" })

		expect(result).toEqual(providerModels)
	})

	it("should work when provider returns no models", async () => {
		const customModelDefs = {
			"custom/model-1": {
				maxTokens: 4096,
				contextWindow: 32000,
				supportsPromptCache: false,
			},
		}

		vi.mocked(openrouter.getOpenRouterModels).mockResolvedValueOnce({})
		vi.mocked(customModels.getCustomModelsForProvider).mockResolvedValueOnce(customModelDefs)

		const result = await getModels({ provider: "openrouter" })

		expect(result).toEqual(customModelDefs)
	})

	it("should handle errors in custom models loading gracefully", async () => {
		const providerModels = {
			"openai/gpt-4": {
				maxTokens: 8000,
				contextWindow: 128000,
				supportsPromptCache: false,
			},
		}

		vi.mocked(openrouter.getOpenRouterModels).mockResolvedValueOnce(providerModels)
		vi.mocked(customModels.getCustomModelsForProvider).mockRejectedValueOnce(
			new Error("Failed to load custom models"),
		)

		// The error in loading custom models should cause the overall fetch to fail
		await expect(getModels({ provider: "openrouter" })).rejects.toThrow("Failed to load custom models")
	})

	it("should flush cache for specific provider", async () => {
		const providerModels = {
			"openai/gpt-4": {
				maxTokens: 8000,
				contextWindow: 128000,
				supportsPromptCache: false,
			},
		}

		// First call - should fetch
		vi.mocked(openrouter.getOpenRouterModels).mockResolvedValueOnce(providerModels)
		vi.mocked(customModels.getCustomModelsForProvider).mockResolvedValueOnce({})
		await getModels({ provider: "openrouter" })
		expect(openrouter.getOpenRouterModels).toHaveBeenCalledTimes(1)

		// Second call - should use cache (no new mocks needed)
		await getModels({ provider: "openrouter" })
		expect(openrouter.getOpenRouterModels).toHaveBeenCalledTimes(1)

		// Flush cache
		await flushModels("openrouter")

		// Third call - should fetch again (set up mock again)
		vi.mocked(openrouter.getOpenRouterModels).mockResolvedValueOnce(providerModels)
		vi.mocked(customModels.getCustomModelsForProvider).mockResolvedValueOnce({})
		await getModels({ provider: "openrouter" })
		expect(openrouter.getOpenRouterModels).toHaveBeenCalledTimes(2)
	})
})
