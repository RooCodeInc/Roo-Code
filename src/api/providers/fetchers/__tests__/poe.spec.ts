import { getPoeModels } from "../poe"

const mockFetchPoeModels = vitest.fn()
const mockGetModels = vitest.fn()

vitest.mock("ai-sdk-provider-poe/code", () => ({
	fetchPoeModels: (...args: unknown[]) => mockFetchPoeModels(...args),
	getModels: () => mockGetModels(),
}))

describe("getPoeModels", () => {
	beforeEach(() => vitest.clearAllMocks())

	it("converts PoeModelInfo to ModelRecord", async () => {
		mockFetchPoeModels.mockResolvedValue([])
		mockGetModels.mockReturnValue([
			{
				id: "anthropic/claude-sonnet-4",
				rawId: "claude-sonnet-4",
				contextWindow: 200_000,
				maxOutputTokens: 8192,
				supportsImages: true,
				supportsPromptCache: true,
				supportsReasoningBudget: true,
				pricing: {
					inputPerMillion: 3,
					outputPerMillion: 15,
					cacheReadPerMillion: 0.3,
					cacheWritePerMillion: 3.75,
				},
			},
			{
				id: "openai/gpt-4o",
				rawId: "gpt-4o",
				contextWindow: 128_000,
				maxOutputTokens: 16_384,
				supportsImages: true,
				supportsPromptCache: false,
				pricing: {
					inputPerMillion: 2.5,
					outputPerMillion: 10,
				},
			},
		])

		const models = await getPoeModels("test-key")

		expect(mockFetchPoeModels).toHaveBeenCalledWith({ apiKey: "test-key", baseURL: undefined })

		expect(models["anthropic/claude-sonnet-4"]).toEqual({
			contextWindow: 200_000,
			maxTokens: 8192,
			supportsImages: true,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
			inputPrice: 3,
			outputPrice: 15,
			cacheReadsPrice: 0.3,
			cacheWritesPrice: 3.75,
		})

		expect(models["openai/gpt-4o"]).toEqual({
			contextWindow: 128_000,
			maxTokens: 16_384,
			supportsImages: true,
			supportsPromptCache: false,
			inputPrice: 2.5,
			outputPrice: 10,
		})
	})

	it("passes baseURL when provided", async () => {
		mockFetchPoeModels.mockResolvedValue([])
		mockGetModels.mockReturnValue([])

		await getPoeModels("key", "https://custom.api.com/v1")

		expect(mockFetchPoeModels).toHaveBeenCalledWith({ apiKey: "key", baseURL: "https://custom.api.com/v1" })
	})

	it("returns empty record on empty response", async () => {
		mockFetchPoeModels.mockResolvedValue([])
		mockGetModels.mockReturnValue([])

		const models = await getPoeModels("key")

		expect(models).toEqual({})
	})

	it("handles models with missing optional fields", async () => {
		mockFetchPoeModels.mockResolvedValue([])
		mockGetModels.mockReturnValue([
			{
				id: "some-model",
				rawId: "some-model",
				contextWindow: 4096,
				maxOutputTokens: 1024,
				supportsImages: false,
				supportsPromptCache: false,
			},
		])

		const models = await getPoeModels("key")

		expect(models["some-model"]).toEqual({
			contextWindow: 4096,
			maxTokens: 1024,
			supportsImages: false,
			supportsPromptCache: false,
		})
	})

	it("maps supportsReasoningEffort when present", async () => {
		mockFetchPoeModels.mockResolvedValue([])
		mockGetModels.mockReturnValue([
			{
				id: "openai/o3",
				rawId: "o3",
				contextWindow: 200_000,
				maxOutputTokens: 100_000,
				supportsImages: true,
				supportsPromptCache: false,
				supportsReasoningEffort: ["low", "medium", "high"],
			},
		])

		const models = await getPoeModels("key")

		expect(models["openai/o3"].supportsReasoningEffort).toEqual(["low", "medium", "high"])
	})
})
