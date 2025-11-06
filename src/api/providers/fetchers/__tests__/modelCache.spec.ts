// Mocks must come first, before imports

// Mock NodeCache to avoid cache interference
vi.mock("node-cache", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			get: vi.fn().mockReturnValue(undefined), // Always return cache miss
			set: vi.fn(),
			del: vi.fn(),
		})),
	}
})

// Mock fs/promises to avoid file system operations
vi.mock("fs/promises", () => {
	const mod = {
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("{}"),
		mkdir: vi.fn().mockResolvedValue(undefined),
		// Default to "file exists"; individual tests will override readFile content as needed
		access: vi.fn().mockResolvedValue(undefined),
		unlink: vi.fn().mockResolvedValue(undefined),
		rename: vi.fn().mockResolvedValue(undefined),
	}
	return { ...mod, default: mod }
})

// Provide stable paths for caches during tests
vi.mock("../../../../core/config/ContextProxy", () => ({
	ContextProxy: { instance: { globalStorageUri: { fsPath: "/tmp" } } },
}))
vi.mock("../../../../utils/storage", () => ({
	getCacheDirectoryPath: vi.fn().mockResolvedValue("/tmp/cache"),
}))

// Mock all the model fetchers
vi.mock("../litellm")
vi.mock("../openrouter")
vi.mock("../requesty")
vi.mock("../glama")
vi.mock("../unbound")
vi.mock("../io-intelligence")

// Then imports
import type { Mock } from "vitest"
import { getModels, flushModels } from "../modelCache"
import { flushModelProviders } from "../modelEndpointCache"
import { getLiteLLMModels } from "../litellm"
import { getOpenRouterModels } from "../openrouter"
import { getRequestyModels } from "../requesty"
import { getGlamaModels } from "../glama"
import { getUnboundModels } from "../unbound"
import { getIOIntelligenceModels } from "../io-intelligence"

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
	beforeEach(async () => {
		vi.resetAllMocks()

		// Re-prime mocked storage/helper modules after resetAllMocks clears implementations
		const storage = await import("../../../../utils/storage")
		;(storage.getCacheDirectoryPath as unknown as Mock).mockResolvedValue("/tmp/cache")

		const ctx = await import("../../../../core/config/ContextProxy")
		;(ctx as any).ContextProxy = { instance: { globalStorageUri: { fsPath: "/tmp" } } }

		// Ensure memory cache does not leak across tests
		await Promise.all(
			["litellm", "openrouter", "requesty", "glama", "unbound", "io-intelligence"].map((r) =>
				flushModels(r as any),
			),
		)
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

		const fsp = await import("fs/promises")
		;(fsp.readFile as unknown as Mock).mockResolvedValueOnce(JSON.stringify(mockModels))

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

		const fsp = await import("fs/promises")
		;(fsp.readFile as unknown as Mock).mockResolvedValueOnce(JSON.stringify(mockModels))

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

		const fsp = await import("fs/promises")
		;(fsp.readFile as unknown as Mock).mockResolvedValueOnce(JSON.stringify(mockModels))

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

		const fsp = await import("fs/promises")
		;(fsp.readFile as unknown as Mock).mockResolvedValueOnce(JSON.stringify(mockModels))

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

		const fsp = await import("fs/promises")
		;(fsp.readFile as unknown as Mock).mockResolvedValueOnce(JSON.stringify(mockModels))

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

		const fsp = await import("fs/promises")
		;(fsp.readFile as unknown as Mock).mockResolvedValueOnce(JSON.stringify(mockModels))

		const result = await getModels({ provider: "io-intelligence", apiKey: DUMMY_IOINTELLIGENCE_KEY })

		expect(mockGetIOIntelligenceModels).toHaveBeenCalled()
		expect(result).toEqual(mockModels)
	})

	describe("explicit flush and no auto-expiration", () => {
		it("flushModels clears memory and attempts to delete file cache", async () => {
			const fsUtils = await import("../../../../utils/fs")
			const existsSpy = vi.spyOn(fsUtils, "fileExistsAtPath").mockResolvedValue(true)

			const fsp = await import("fs/promises")
			const def = (fsp as any).default ?? (fsp as any)
			const unlink = def.unlink as unknown as Mock
			unlink.mockClear()

			// Act
			await flushModels("openrouter")

			// Assert file deletion attempted with expected filename pattern
			expect(unlink).toHaveBeenCalled()
			const [[calledPath]] = (unlink as unknown as { mock: { calls: [string][] } }).mock.calls
			expect(String(calledPath)).toContain("openrouter_models.json")

			existsSpy.mockRestore()
		})

		it("flushModelProviders clears memory and attempts to delete endpoints file cache", async () => {
			const fsUtils = await import("../../../../utils/fs")
			const existsSpy = vi.spyOn(fsUtils, "fileExistsAtPath").mockResolvedValue(true)

			const fsp = await import("fs/promises")
			const def = (fsp as any).default ?? (fsp as any)
			const unlink = def.unlink as unknown as Mock
			unlink.mockClear()

			await flushModelProviders("openrouter", "test-model")

			// Assert endpoints file deletion attempted with expected filename pattern
			expect(unlink).toHaveBeenCalled()
			const calls = (unlink as any).mock.calls.map((c: any[]) => String(c[0]))
			expect(calls.some((p: string) => p.includes("openrouter_test-model_endpoints.json"))).toBe(true)

			existsSpy.mockRestore()
		})

		it("does not auto-expire cached entries after previous TTL window", async () => {
			vi.useFakeTimers()
			vi.resetModules()

			// Use real NodeCache for this re-import
			vi.unmock("node-cache")

			const expectedModels = {
				"test/model": {
					maxTokens: 1024,
					contextWindow: 8192,
					supportsPromptCache: false,
				},
			}

			// Lightweight mocks to avoid real FS and VSCode context
			vi.doMock("fs/promises", () => ({
				writeFile: vi.fn().mockResolvedValue(undefined),
				readFile: vi.fn().mockResolvedValue(JSON.stringify(expectedModels)),
				mkdir: vi.fn().mockResolvedValue(undefined),
				access: vi.fn().mockResolvedValue(undefined),
				unlink: vi.fn().mockResolvedValue(undefined),
				rename: vi.fn().mockResolvedValue(undefined),
			}))
			vi.doMock("../../../../utils/safeWriteJson", () => ({
				safeWriteJson: vi.fn().mockResolvedValue(undefined),
			}))
			vi.doMock("../../../../core/config/ContextProxy", () => ({
				ContextProxy: { instance: { globalStorageUri: { fsPath: "/tmp" } } },
			}))
			vi.doMock("../../../../utils/storage", () => ({
				getCacheDirectoryPath: vi.fn().mockResolvedValue("/tmp/cache"),
			}))
			vi.doMock("../openrouter", () => ({
				getOpenRouterModels: vi.fn().mockResolvedValue(expectedModels),
			}))

			const { getModels, getModelsFromCache } = await import("../modelCache")

			await getModels({ provider: "openrouter" })
			expect(getModelsFromCache("openrouter")).toEqual(expectedModels)

			// Advance beyond the old TTL (5 minutes)
			vi.advanceTimersByTime(6 * 60 * 1000)

			// Value should still be present (no auto-expiry)
			expect(getModelsFromCache("openrouter")).toEqual(expectedModels)

			vi.useRealTimers()
		})
	})

	it("handles errors and re-throws them", async () => {
		// Ensure no leftover implementation from previous tests
		mockGetLiteLLMModels.mockReset()

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
