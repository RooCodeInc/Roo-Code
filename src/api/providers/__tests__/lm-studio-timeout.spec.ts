// npx vitest run api/providers/__tests__/lm-studio-timeout.spec.ts

const { mockCreateOpenAICompatible } = vi.hoisted(() => ({
	mockCreateOpenAICompatible: vi.fn(() => vi.fn(() => ({ modelId: "llama2", provider: "lmstudio" }))),
}))

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: mockCreateOpenAICompatible,
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: vi.fn(),
		generateText: vi.fn(),
	}
})

import { LmStudioHandler } from "../lm-studio"
import { ApiHandlerOptions } from "../../../shared/api"

describe("LmStudioHandler provider configuration", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should create provider with correct baseURL from options", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			lmStudioModelId: "llama2",
			lmStudioBaseUrl: "http://localhost:1234",
		}

		new LmStudioHandler(options)

		expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "lmstudio",
				baseURL: "http://localhost:1234/v1",
				apiKey: "noop",
			}),
		)
	})

	it("should use default baseURL when none is provided", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			lmStudioModelId: "llama2",
		}

		new LmStudioHandler(options)

		expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://localhost:1234/v1",
			}),
		)
	})

	it("should use default baseURL when empty string is provided", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			lmStudioModelId: "llama2",
			lmStudioBaseUrl: "",
		}

		new LmStudioHandler(options)

		expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://localhost:1234/v1",
			}),
		)
	})

	it("should use custom baseURL when provided", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			lmStudioModelId: "llama2",
			lmStudioBaseUrl: "http://custom-host:5678",
		}

		new LmStudioHandler(options)

		expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://custom-host:5678/v1",
			}),
		)
	})

	it("should always use 'noop' as the API key", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			lmStudioModelId: "llama2",
		}

		new LmStudioHandler(options)

		expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: "noop",
			}),
		)
	})
})
