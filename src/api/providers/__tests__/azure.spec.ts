import { describe, it, expect, vi, beforeEach } from "vitest"
import { AzureHandler } from "../azure"
import type { ModelInfo } from "@roo-code/types"

const DUMMY_MODEL: ModelInfo = {
	maxTokens: 4096,
	contextWindow: 128000,
	supportsPromptCache: false,
	supportsImages: false,
	description: "Test model",
}

const GPT5_MODEL: ModelInfo = {
	maxTokens: 32768,
	contextWindow: 200000,
	supportsPromptCache: true,
	supportsImages: true,
	description: "GPT-5 Pro",
}

const providerModels = {
	"gpt-4": DUMMY_MODEL,
	"gpt-5-pro": GPT5_MODEL,
	"gpt-5-mini": GPT5_MODEL,
	"gpt-5-nano": GPT5_MODEL,
}

const defaultProviderModelId = "gpt-4"

function getBaseOptions(overrides = {}) {
	return {
		azureEndpoint: "https://example.cognitiveservices.azure.com",
		azureApiKey: "test-key",
		providerModels,
		defaultProviderModelId,
		...overrides,
	}
}

describe("AzureHandler", () => {
	let handler: AzureHandler

	beforeEach(() => {
		vi.resetAllMocks()
	})

	it("constructs with API key for OpenAI endpoint", () => {
		handler = new AzureHandler(getBaseOptions())
		expect(handler).toBeInstanceOf(AzureHandler)
	})

	it("constructs with API key for Foundry endpoint", () => {
		handler = new AzureHandler(getBaseOptions({ azureFoundry: true }))
		expect(handler).toBeInstanceOf(AzureHandler)
	})

	it("constructs with AAD credentials (mocked)", () => {
		const spy = vi.spyOn(require("@azure/identity"), "ClientSecretCredential").mockImplementation(() => ({
			getToken: vi.fn().mockResolvedValue({ token: "aad-token" }),
		}))
		// deasync workaround: mock runLoopOnce to avoid blocking
		vi.stubGlobal("require", (mod: string) => {
			if (mod === "deasync") return { runLoopOnce: () => {} }
			return require(mod)
		})
		handler = new AzureHandler(
			getBaseOptions({
				azureUseAAD: true,
				azureTenantId: "tenant",
				azureClientId: "client",
				azureClientSecret: "secret",
			}),
		)
		expect(handler).toBeInstanceOf(AzureHandler)
		spy.mockRestore()
	})

	it("returns correct model for known and unknown IDs", () => {
		handler = new AzureHandler(getBaseOptions())
		// Known model
		let model = handler.getModel()
		expect(model.id).toBe("gpt-4")
		expect(model.info.maxTokens).toBe(4096)
		// Unknown/future model
		handler = new AzureHandler(getBaseOptions({ apiModelId: "gpt-5-ultra" }))
		model = handler.getModel()
		expect(model.id).toBe("gpt-5-ultra")
		expect(model.info.maxTokens).toBe(4096) // fallback default
	})

	it("normalizes Azure errors", () => {
		handler = new AzureHandler(getBaseOptions())
		const norm = (msg: string) => handler["normalizeAzureError"](new Error(msg)).message
		expect(norm("429 Too Many Requests")).toMatch(/rate limit/i)
		expect(norm("401 Unauthorized")).toMatch(/authentication/i)
		expect(norm("403 Forbidden")).toMatch(/permission/i)
		expect(norm("404 Not Found")).toMatch(/not found/i)
		expect(norm("quota exceeded")).toMatch(/quota/i)
		expect(norm("random error")).toMatch(/Azure completion error/i)
	})

	it("constructs correct endpoint URLs for OpenAI and Foundry", async () => {
		const handlerOpenAI = new AzureHandler(getBaseOptions({ azureDeployment: "gpt-4" }))
		const handlerFoundry = new AzureHandler(getBaseOptions({ azureFoundry: true, azureFoundryDeployment: "deepseek" }))
		// Patch client to intercept requestOptions
		let openaiPath, foundryPath
		handlerOpenAI["client"].chat = {
			completions: {
				create: vi.fn((_params, requestOptions) => {
					openaiPath = requestOptions.path
					return { [Symbol.asyncIterator]: () => ({ next: () => ({ done: true }) }) }
				}),
			},
		}
		handlerFoundry["client"].chat = {
			completions: {
				create: vi.fn((_params, requestOptions) => {
					foundryPath = requestOptions.path
					return { [Symbol.asyncIterator]: () => ({ next: () => ({ done: true }) }) }
				}),
			},
		}
		// Call createMessage to trigger endpoint logic
		await handlerOpenAI.createMessage("sys", [], undefined).next()
		await handlerFoundry.createMessage("sys", [], undefined).next()
		expect(openaiPath).toMatch(/openai\/deployments\/gpt-4\/chat\/completions/)
		expect(foundryPath).toMatch(/api\/v1\/deepseek\/chat\/completions/)
	})

	it("is forward-compatible with all GPT-5 variants", () => {
		const ids = ["gpt-5-pro", "gpt-5-mini", "gpt-5-nano", "gpt-5-ultra"]
		for (const id of ids) {
			handler = new AzureHandler(getBaseOptions({ apiModelId: id }))
			const model = handler.getModel()
			expect(model.id).toBe(id)
			expect(model.info).toBeDefined()
		}
	})
})