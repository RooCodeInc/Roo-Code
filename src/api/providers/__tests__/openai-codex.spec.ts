// npx vitest run api/providers/__tests__/openai-codex.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockGenerateText } = vi.hoisted(() => ({
	mockGenerateText: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: vi.fn(() => {
		const provider = vi.fn(() => ({
			modelId: "gpt-5.3-codex",
			provider: "openai",
		}))
		;(provider as any).responses = vi.fn(() => ({
			modelId: "gpt-5.3-codex",
			provider: "openai.responses",
		}))
		return provider
	}),
}))

import { OpenAiCodexHandler } from "../openai-codex"
import { openAiCodexOAuthManager } from "../../../integrations/openai-codex/oauth"

describe("OpenAiCodexHandler.getModel", () => {
	it.each(["gpt-5.1", "gpt-5", "gpt-5.1-codex", "gpt-5-codex", "gpt-5-codex-mini"])(
		"should return specified model when a valid model id is provided: %s",
		(apiModelId) => {
			const handler = new OpenAiCodexHandler({ apiModelId })
			const model = handler.getModel()

			expect(model.id).toBe(apiModelId)
			expect(model.info).toBeDefined()
			// Default reasoning effort for GPT-5 family
			expect(model.info.reasoningEffort).toBe("medium")
		},
	)

	it("should fall back to default model when an invalid model id is provided", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "not-a-real-model" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.3-codex")
		expect(model.info).toBeDefined()
	})
})

describe("OpenAiCodexHandler constructor", () => {
	it("should create an instance", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.3-codex" })
		expect(handler).toBeInstanceOf(OpenAiCodexHandler)
	})

	it("should have a sessionId set", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.3-codex" })
		// sessionId is private, but we can verify via the handler being constructed without error
		// and by checking it's a valid instance with internal state
		expect(handler).toBeDefined()
		// Access sessionId via bracket notation to test the private field
		expect((handler as any).sessionId).toBeDefined()
		expect(typeof (handler as any).sessionId).toBe("string")
		expect((handler as any).sessionId.length).toBeGreaterThan(0)
	})
})

describe("OpenAiCodexHandler.isAiSdkProvider", () => {
	it("should return true", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.3-codex" })
		expect(handler.isAiSdkProvider()).toBe(true)
	})
})

describe("OpenAiCodexHandler.completePrompt", () => {
	let handler: OpenAiCodexHandler

	beforeEach(() => {
		vi.restoreAllMocks()
		handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.3-codex" })
	})

	it("should return text from generateText", async () => {
		vi.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue("test-token")
		vi.spyOn(openAiCodexOAuthManager, "getAccountId").mockResolvedValue("acct_test")

		mockGenerateText.mockResolvedValue({ text: "Hello from Codex!" })

		const result = await handler.completePrompt("Say hello")

		expect(result).toBe("Hello from Codex!")
		expect(mockGenerateText).toHaveBeenCalledOnce()
		expect(mockGenerateText).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: "Say hello",
			}),
		)
	})

	it("should throw transformed error via handleAiSdkError when generateText fails", async () => {
		vi.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue("test-token")
		vi.spyOn(openAiCodexOAuthManager, "getAccountId").mockResolvedValue("acct_test")

		mockGenerateText.mockRejectedValue(new Error("API Error"))

		await expect(handler.completePrompt("Say hello")).rejects.toThrow("OpenAI Codex")
	})

	it("should throw when not authenticated", async () => {
		vi.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue(null as any)

		await expect(handler.completePrompt("Say hello")).rejects.toThrow("Not authenticated with OpenAI Codex")
	})
})

describe("OpenAiCodexHandler.getEncryptedContent and getResponseId", () => {
	it("should return undefined before any streaming", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.3-codex" })

		expect(handler.getEncryptedContent()).toBeUndefined()
		expect(handler.getResponseId()).toBeUndefined()
	})
})
