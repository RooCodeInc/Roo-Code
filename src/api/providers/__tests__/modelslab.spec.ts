import { ModelsLabHandler } from "../modelslab"
import { modelsLabDefaultModelId, modelsLabModels, type ModelsLabModelId } from "@roo-code/types"
import { BaseOpenAiCompatibleProvider } from "../base-openai-compatible-provider"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("openai", () => {
	const mockCreate = jest.fn()
	return {
		default: jest.fn().mockImplementation(() => ({
			chat: { completions: { create: mockCreate } },
		})),
		__mockCreate: mockCreate,
	}
})

const VALID_OPTIONS = {
	modelsLabApiKey: "ml-test-key-abc",
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeHandler(overrides: Record<string, unknown> = {}) {
	return new ModelsLabHandler({ ...VALID_OPTIONS, ...overrides } as any)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ModelsLabHandler", () => {
	// -------------------------------------------------------------------------
	// Inheritance
	// -------------------------------------------------------------------------

	it("extends BaseOpenAiCompatibleProvider", () => {
		const handler = makeHandler()
		expect(handler).toBeInstanceOf(BaseOpenAiCompatibleProvider)
	})

	// -------------------------------------------------------------------------
	// Construction
	// -------------------------------------------------------------------------

	it("uses the ModelsLab base URL", () => {
		const handler = makeHandler()
		expect((handler as any).baseURL).toBe("https://modelslab.com/api/uncensored-chat/v1")
	})

	it("sets providerName to ModelsLab", () => {
		const handler = makeHandler()
		expect((handler as any).providerName).toBe("ModelsLab")
	})

	it("throws when no API key is provided", () => {
		expect(() => new ModelsLabHandler({} as any)).toThrow("API key is required")
	})

	// -------------------------------------------------------------------------
	// Model resolution
	// -------------------------------------------------------------------------

	it("returns the default model when no model is specified", () => {
		const handler = makeHandler()
		const { id } = handler.getModel()
		expect(id).toBe(modelsLabDefaultModelId)
	})

	it("returns the correct model info for the default model", () => {
		const handler = makeHandler()
		const { info } = handler.getModel()
		expect(info).toEqual(modelsLabModels[modelsLabDefaultModelId])
	})

	it("uses the specified model when apiModelId is provided", () => {
		const handler = makeHandler({ apiModelId: "llama-3.1-70b-uncensored" })
		const { id } = handler.getModel()
		expect(id).toBe("llama-3.1-70b-uncensored")
	})

	// -------------------------------------------------------------------------
	// Model registry
	// -------------------------------------------------------------------------

	it("has both Llama 3.1 variants in the registry", () => {
		const ids = Object.keys(modelsLabModels) as ModelsLabModelId[]
		expect(ids).toContain("llama-3.1-8b-uncensored")
		expect(ids).toContain("llama-3.1-70b-uncensored")
	})

	it("default model is in the registry", () => {
		expect(modelsLabDefaultModelId in modelsLabModels).toBe(true)
	})

	it("all models have 128K+ context windows", () => {
		for (const [, info] of Object.entries(modelsLabModels)) {
			expect(info.contextWindow).toBeGreaterThanOrEqual(128_000)
		}
	})

	it("no model claims to support images", () => {
		for (const [, info] of Object.entries(modelsLabModels)) {
			expect(info.supportsImages).toBe(false)
		}
	})
})
