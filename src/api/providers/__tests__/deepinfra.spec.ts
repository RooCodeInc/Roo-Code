// npx vitest run api/providers/__tests__/deepinfra.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

import { DeepInfraHandler } from "../deepinfra"
import type { ApiHandlerOptions } from "../../../shared/api"

vi.mock("openai", () => ({
	default: class MockOpenAI {
		baseURL: string
		apiKey: string
		chat = { completions: { create: vi.fn() } }
		constructor(opts: any) {
			this.baseURL = opts.baseURL
			this.apiKey = opts.apiKey
		}
	},
}))

describe("DeepInfraHandler getModel priority", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("prefers options.resolvedModelInfo over cache and default", () => {
		const resolved = { maxTokens: 1234, contextWindow: 56789, supportsImages: false, supportsPromptCache: true }
		const handler = new DeepInfraHandler({
			deepInfraApiKey: "k",
			deepInfraModelId: "meta/llama-3",
			resolvedModelInfo: resolved,
		} as any as ApiHandlerOptions)
		const model = handler.getModel()
		expect(model.id).toBe("meta/llama-3")
		expect(model.info).toBe(resolved)
	})

	it("uses memory cache when no resolvedModelInfo", () => {
		const handler = new DeepInfraHandler({
			deepInfraApiKey: "k",
			deepInfraModelId: "openai/gpt-4o",
		} as any as ApiHandlerOptions)
		;(handler as any).models = {
			"openai/gpt-4o": {
				maxTokens: 999,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: false,
			},
		}
		const model = handler.getModel()
		expect(model.info.maxTokens).toBe(999)
	})

	it("falls back to default when neither persisted nor cache", () => {
		const handler = new DeepInfraHandler({
			deepInfraApiKey: "k",
			deepInfraModelId: "unknown/model",
		} as any as ApiHandlerOptions)
		const model = handler.getModel()
		expect(model.info).toEqual(expect.objectContaining({ contextWindow: expect.any(Number) }))
	})
})
