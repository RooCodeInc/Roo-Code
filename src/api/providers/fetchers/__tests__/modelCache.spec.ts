// Mocks must come first, before imports

// Mock NodeCache to allow controlling cache behavior
vi.mock("node-cache", () => {
	const mockGet = vi.fn().mockReturnValue(undefined)
	const mockSet = vi.fn()
	const mockDel = vi.fn()

	return {
		default: vi.fn().mockImplementation(() => ({
			get: mockGet,
			set: mockSet,
			del: mockDel,
		})),
	}
})

// Mock fs/promises to avoid file system operations
vi.mock("fs/promises", () => ({
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue("{}"),
	mkdir: vi.fn().mockResolvedValue(undefined),
}))

// Mock fs (synchronous) for disk cache fallback
vi.mock("fs", () => ({
	existsSync: vi.fn().mockReturnValue(false),
	readFileSync: vi.fn().mockReturnValue("{}"),
}))

// Mock safeWriteJson
vi.mock("../../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

// Mock fileExistsAtPath
vi.mock("../../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

// Mock all the model fetchers
vi.mock("../litellm")
vi.mock("../openrouter")
vi.mock("../requesty")
vi.mock("../glama")
vi.mock("../unbound")
vi.mock("../io-intelligence")
vi.mock("../ollama")
vi.mock("../lmstudio")
vi.mock("../vercel-ai-gateway")
vi.mock("../deepinfra")
vi.mock("../huggingface")
vi.mock("../roo")
vi.mock("../chutes")

// Mock ContextProxy with a simple static instance
vi.mock("../../../../core/config/ContextProxy", () => ({
	ContextProxy: {
		instance: {
			globalStorageUri: {
				fsPath: "/mock/storage/path",
			},
		},
	},
}))

// Mock getCacheDirectoryPath
vi.mock("../../../../utils/storage", () => ({
	getCacheDirectoryPath: vi.fn().mockResolvedValue("/mock/storage/path/cache"),
}))

// Then imports
import type { Mock } from "vitest"
import * as fsSync from "fs"
import * as fs from "fs/promises"
import NodeCache from "node-cache"
import { getModels, getModelsFromCache, refreshModels } from "../modelCache"
import { getLiteLLMModels } from "../litellm"
import { getOpenRouterModels } from "../openrouter"
import { getRequestyModels } from "../requesty"
import { getGlamaModels } from "../glama"
import { getUnboundModels } from "../unbound"
import { getIOIntelligenceModels } from "../io-intelligence"
import { safeWriteJson } from "../../../../utils/safeWriteJson"

const mockGetLiteLLMModels = getLiteLLMModels as Mock<typeof getLiteLLMModels>
const mockGetOpenRouterModels = getOpenRouterModels as Mock<typeof getOpenRouterModels>
const mockGetRequestyModels = getRequestyModels as Mock<typeof getRequestyModels>
const mockGetGlamaModels = getGlamaModels as Mock<typeof getGlamaModels>
const mockGetUnboundModels = getUnboundModels as Mock<typeof getUnboundModels>
const mockGetIOIntelligenceModels = getIOIntelligenceModels as Mock<typeof getIOIntelligenceModels>

const DUMMY_REQUESTY_KEY = "requesty-key-for-testing"
const DUMMY_UNBOUND_KEY = "unbound-key-for-testing"
const DUMMY_IOINTELLIGENCE_KEY = "io-intelligence-key-for-testing"

describe("getModels with new GetModelsOptions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("calls getLiteLLMModels with correct parameters", async () => {
		const mockModels = {
			"claude-3-sonnet": {
				maxTokens: 4096,
				contextWindow: 200000,
				supportsPromptCache: false,
				description: "Claude 3 Sonnet via LiteLLM",
			},
		}
		mockGetLiteLLMModels.mockResolvedValue(mockModels)

		const result = await getModels({
			provider: "litellm",
			apiKey: "test-api-key",
			baseUrl: "http://localhost:4000",
		})

		expect(mockGetLiteLLMModels).toHaveBeenCalledWith("test-api-key", "http://localhost:4000")
		expect(result).toEqual(mockModels)
	})

	it("calls getOpenRouterModels for openrouter provider", async () => {
		const mockModels = {
			"openrouter/model": {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsPromptCache: false,
				description: "OpenRouter model",
			},
		}
		mockGetOpenRouterModels.mockResolvedValue(mockModels)

		const result = await getModels({ provider: "openrouter" })

		expect(mockGetOpenRouterModels).toHaveBeenCalled()
		expect(result).toEqual(mockModels)
	})

	it("calls getRequestyModels with optional API key", async () => {
		const mockModels = {
			"requesty/model": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Requesty model",
			},
		}
		mockGetRequestyModels.mockResolvedValue(mockModels)

		const result = await getModels({ provider: "requesty", apiKey: DUMMY_REQUESTY_KEY })

		expect(mockGetRequestyModels).toHaveBeenCalledWith(undefined, DUMMY_REQUESTY_KEY)
		expect(result).toEqual(mockModels)
	})

	it("calls getGlamaModels for glama provider", async () => {
		const mockModels = {
			"glama/model": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Glama model",
			},
		}
		mockGetGlamaModels.mockResolvedValue(mockModels)

		const result = await getModels({ provider: "glama" })

		expect(mockGetGlamaModels).toHaveBeenCalled()
		expect(result).toEqual(mockModels)
	})

	it("calls getUnboundModels with optional API key", async () => {
		const mockModels = {
			"unbound/model": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Unbound model",
			},
		}
		mockGetUnboundModels.mockResolvedValue(mockModels)

		const result = await getModels({ provider: "unbound", apiKey: DUMMY_UNBOUND_KEY })

		expect(mockGetUnboundModels).toHaveBeenCalledWith(DUMMY_UNBOUND_KEY)
		expect(result).toEqual(mockModels)
	})

	it("calls IOIntelligenceModels for IO-Intelligence provider", async () => {
		const mockModels = {
			"io-intelligence/model": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "IO Intelligence Model",
			},
		}
		mockGetIOIntelligenceModels.mockResolvedValue(mockModels)

		const result = await getModels({ provider: "io-intelligence", apiKey: DUMMY_IOINTELLIGENCE_KEY })

		expect(mockGetIOIntelligenceModels).toHaveBeenCalled()
		expect(result).toEqual(mockModels)
	})

	it("handles errors and re-throws them", async () => {
		const expectedError = new Error("LiteLLM connection failed")
		mockGetLiteLLMModels.mockRejectedValue(expectedError)

		await expect(
			getModels({
				provider: "litellm",
				apiKey: "test-api-key",
				baseUrl: "http://localhost:4000",
			}),
		).rejects.toThrow("LiteLLM connection failed")
	})

	it("validates exhaustive provider checking with unknown provider", async () => {
		// This test ensures TypeScript catches unknown providers at compile time
		// In practice, the discriminated union should prevent this at compile time
		const unknownProvider = "unknown" as any

		await expect(
			getModels({
				provider: unknownProvider,
			}),
		).rejects.toThrow("Unknown provider: unknown")
	})
})

describe("getModelsFromCache disk fallback", () => {
	let mockCache: any

	beforeEach(() => {
		vi.clearAllMocks()
		// Get the mock cache instance
		const MockedNodeCache = vi.mocked(NodeCache)
		mockCache = new MockedNodeCache()
		// Reset memory cache to always miss
		mockCache.get.mockReturnValue(undefined)
		// Reset fs mocks
		vi.mocked(fsSync.existsSync).mockReturnValue(false)
		vi.mocked(fsSync.readFileSync).mockReturnValue("{}")
	})

	it("returns undefined when both memory and disk cache miss", () => {
		vi.mocked(fsSync.existsSync).mockReturnValue(false)

		const result = getModelsFromCache("openrouter")

		expect(result).toBeUndefined()
	})

	it("returns memory cache data without checking disk when available", () => {
		const memoryModels = {
			"memory-model": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsPromptCache: false,
			},
		}

		mockCache.get.mockReturnValue(memoryModels)

		const result = getModelsFromCache("roo")

		expect(result).toEqual(memoryModels)
		// Disk should not be checked when memory cache hits
		expect(fsSync.existsSync).not.toHaveBeenCalled()
	})

	it("returns disk cache data when memory cache misses and context is available", () => {
		// Note: This test validates the logic but the ContextProxy mock in test environment
		// returns undefined for getCacheDirectoryPathSync, which is expected behavior
		// when the context is not fully initialized. The actual disk cache loading
		// is validated through integration tests.
		const diskModels = {
			"disk-model": {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
			},
		}

		vi.mocked(fsSync.existsSync).mockReturnValue(true)
		vi.mocked(fsSync.readFileSync).mockReturnValue(JSON.stringify(diskModels))

		const result = getModelsFromCache("openrouter")

		// Now that getCacheDirectoryPathSync returns a path, disk cache should work
		expect(result).toEqual(diskModels)
	})

	it("handles disk read errors gracefully", () => {
		vi.mocked(fsSync.existsSync).mockReturnValue(true)
		vi.mocked(fsSync.readFileSync).mockImplementation(() => {
			throw new Error("Disk read failed")
		})

		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		const result = getModelsFromCache("roo")

		expect(result).toBeUndefined()
		expect(consoleErrorSpy).toHaveBeenCalled()

		consoleErrorSpy.mockRestore()
	})

	it("handles invalid JSON in disk cache gracefully", () => {
		vi.mocked(fsSync.existsSync).mockReturnValue(true)
		vi.mocked(fsSync.readFileSync).mockReturnValue("invalid json{")

		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		const result = getModelsFromCache("glama")

		expect(result).toBeUndefined()
		expect(consoleErrorSpy).toHaveBeenCalled()

		consoleErrorSpy.mockRestore()
	})
})

describe("OpenRouter model cache validation and merging", () => {
	let mockCache: any

	beforeEach(() => {
		vi.clearAllMocks()
		// Get the mock cache instance
		const MockedNodeCache = vi.mocked(NodeCache)
		mockCache = new MockedNodeCache()
		// Reset memory cache to always miss
		mockCache.get.mockReturnValue(undefined)
		// Mock safeWriteJson to avoid file system operations
		vi.mocked(safeWriteJson).mockResolvedValue(undefined)
	})

	it("uses full API response when it contains enough models", async () => {
		// API returns complete response with many models
		const completeApiResponse = {
			...Array.from({ length: 120 }, (_, i) => ({
				[`model-${i}`]: {
					maxTokens: 4096,
					contextWindow: 8192,
					supportsPromptCache: false,
					description: `Model ${i}`,
				},
			})).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
		}

		mockGetOpenRouterModels.mockResolvedValue(completeApiResponse)

		const result = await getModels({
			provider: "openrouter",
		})

		// Should use the full API response
		expect(Object.keys(result).length).toBe(120)
		expect(result["model-0"]).toBeDefined()
		expect(result["model-119"]).toBeDefined()
	})

	it("refreshModels preserves models even during refresh", async () => {
		// Set up existing cache in memory
		const existingModels = {
			"openai/gpt-5.1": {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsPromptCache: true,
				description: "GPT-5.1 model",
			},
			"model-1": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Model 1",
			},
		}

		// Configure memory cache to return existing models
		mockCache.get.mockReturnValue(existingModels)

		// API returns incomplete response
		const incompleteApiResponse = {
			"model-1": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Model 1 updated",
			},
			// Missing gpt-5.1
		}

		mockGetOpenRouterModels.mockResolvedValue(incompleteApiResponse)

		const result = await refreshModels({
			provider: "openrouter",
			preserveModelIds: new Set(["openai/gpt-5.1"]),
		})

		// Should preserve gpt-5.1 even though it's not in API response
		expect(result["openai/gpt-5.1"]).toEqual(existingModels["openai/gpt-5.1"])
		// Should update model-1 with new data
		expect(result["model-1"].description).toBe("Model 1 updated")
	})

	it("validates model count threshold for OpenRouter", async () => {
		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
		const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})

		// Existing cache with many models
		const existingModels = {
			...Array.from({ length: 100 }, (_, i) => ({
				[`existing-model-${i}`]: {
					maxTokens: 4096,
					contextWindow: 8192,
					supportsPromptCache: false,
					description: `Existing Model ${i}`,
				},
			})).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
		}

		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingModels))

		// API returns too few models (below threshold)
		const tooFewModels = {
			"model-1": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Model 1",
			},
			"model-2": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Model 2",
			},
		}

		mockGetOpenRouterModels.mockResolvedValue(tooFewModels)

		await getModels({ provider: "openrouter" })

		// Should log warning about incomplete response
		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("OpenRouter returned only 2 models"))

		consoleWarnSpy.mockRestore()
		consoleDebugSpy.mockRestore()
	})
})
