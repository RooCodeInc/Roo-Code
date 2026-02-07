// npx vitest run src/shared/__tests__/checkExistApiConfig.spec.ts

import type { ProviderSettings } from "@roo-code/types"

import { checkExistKey } from "../checkExistApiConfig"

describe("checkExistKey", () => {
	it("should return false for undefined config", () => {
		expect(checkExistKey(undefined)).toBe(false)
	})

	it("should return false for empty config", () => {
		const config: ProviderSettings = {}
		expect(checkExistKey(config)).toBe(false)
	})

	it("should return true when one key is defined", () => {
		const config: ProviderSettings = {
			apiKey: "test-key",
		}
		expect(checkExistKey(config)).toBe(true)
	})

	it("should return true when multiple keys are defined", () => {
		const config: ProviderSettings = {
			apiKey: "test-key",
			openRouterApiKey: "openrouter-key",
		}
		expect(checkExistKey(config)).toBe(true)
	})

	it("should return true when only non-key fields are undefined", () => {
		const config: ProviderSettings = {
			apiKey: "test-key",
			apiProvider: undefined,
			anthropicBaseUrl: undefined,
			modelMaxThinkingTokens: undefined,
		}
		expect(checkExistKey(config)).toBe(true)
	})

	it("should return false when all key fields are undefined", () => {
		const config: ProviderSettings = {
			apiKey: undefined,
			openRouterApiKey: undefined,
			awsRegion: undefined,
			vertexProjectId: undefined,
			openAiApiKey: undefined,
			ollamaModelId: undefined,
			lmStudioModelId: undefined,
			geminiApiKey: undefined,
			openAiNativeApiKey: undefined,
			deepSeekApiKey: undefined,
			moonshotApiKey: undefined,
			mistralApiKey: undefined,
			vsCodeLmModelSelector: undefined,
			requestyApiKey: undefined,
			unboundApiKey: undefined,
		}
		expect(checkExistKey(config)).toBe(false)
	})

	it("should return true for fake-ai provider without API key", () => {
		const config: ProviderSettings = {
			apiProvider: "fake-ai",
		}
		expect(checkExistKey(config)).toBe(true)
	})

	it("should return true for openai-codex provider without API key", () => {
		const config: ProviderSettings = {
			apiProvider: "openai-codex",
		}
		expect(checkExistKey(config)).toBe(true)
	})

	it("should return true for qwen-code provider without API key", () => {
		const config: ProviderSettings = {
			apiProvider: "qwen-code",
		}
		expect(checkExistKey(config)).toBe(true)
	})

	it("should return true for roo provider without API key", () => {
		const config: ProviderSettings = {
			apiProvider: "roo",
		}
		expect(checkExistKey(config)).toBe(true)
	})
})

describe("azure", () => {
	it("should return true when azureBaseUrl is set", () => {
		const config: ProviderSettings = {
			apiProvider: "azure",
			azureBaseUrl: "https://my-resource.openai.azure.com",
		}
		expect(checkExistKey(config)).toBe(true)
	})

	it("should return true when azureDeploymentName is set", () => {
		const config: ProviderSettings = {
			apiProvider: "azure",
			azureDeploymentName: "my-deployment",
		}
		expect(checkExistKey(config)).toBe(true)
	})

	it("should return true when azureApiKey is set", () => {
		const config: ProviderSettings = {
			apiProvider: "azure",
			azureApiKey: "my-api-key",
		}
		expect(checkExistKey(config)).toBe(true)
	})

	it("should return false when no Azure fields are set", () => {
		const config: ProviderSettings = {
			apiProvider: "azure",
		}
		expect(checkExistKey(config)).toBe(false)
	})
})
