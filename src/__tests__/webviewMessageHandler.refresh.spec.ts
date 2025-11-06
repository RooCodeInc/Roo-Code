import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { ClineProvider } from "../core/webview/ClineProvider"
import type { ModelRecord } from "../shared/api"

vi.mock("../api/providers/fetchers/modelCache", () => ({
	flushModels: vi.fn(),
	getModels: vi.fn(),
}))

vi.mock("../api/providers/fetchers/modelEndpointCache", () => ({
	flushModelProviders: vi.fn(),
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: () => false,
	},
}))

import { webviewMessageHandler } from "../core/webview/webviewMessageHandler"
import { flushModels, getModels } from "../api/providers/fetchers/modelCache"
import { flushModelProviders } from "../api/providers/fetchers/modelEndpointCache"

const flushModelsMock = vi.mocked(flushModels)
const getModelsMock = vi.mocked(getModels)
const flushModelProvidersMock = vi.mocked(flushModelProviders)

describe("webviewMessageHandler.flushRouterModels", () => {
	let logSpy: ReturnType<typeof vi.spyOn>
	let warnSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		vi.clearAllMocks()
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
	})

	afterEach(() => {
		logSpy.mockRestore()
		warnSpy.mockRestore()
	})

	it("flushes caches, refetches models, persists resolvedModelInfo, and posts success", async () => {
		const apiConfiguration = {
			apiProvider: "openrouter",
			openRouterModelId: "openrouter/model",
		}
		const getState = vi.fn().mockResolvedValue({
			apiConfiguration,
			currentApiConfigName: "default",
		})
		const postMessageToWebview = vi.fn()
		const upsertProviderProfile = vi.fn().mockResolvedValue(undefined)

		const provider = {
			getState,
			postMessageToWebview,
			upsertProviderProfile,
		} as unknown as ClineProvider

		const models: ModelRecord = {
			"openrouter/model": {
				contextWindow: 32000,
				maxTokens: 16000,
				supportsImages: false,
				supportsPromptCache: true,
			},
		}

		getModelsMock.mockResolvedValue(models)

		await webviewMessageHandler(provider, {
			type: "flushRouterModels",
		} as any)

		expect(flushModelsMock).toHaveBeenCalledWith("openrouter")
		expect(flushModelProvidersMock).toHaveBeenCalledWith("openrouter", "openrouter/model")
		expect(getModelsMock).toHaveBeenCalledWith({ provider: "openrouter" })
		expect(upsertProviderProfile).toHaveBeenCalledWith(
			"default",
			expect.objectContaining({
				resolvedModelInfo: models["openrouter/model"],
			}),
			true,
		)
		expect(postMessageToWebview).toHaveBeenCalledWith({ type: "flushRouterModelsResult", success: true })
	})

	it("supports router overrides supplied via message text when no provider model is selected", async () => {
		const getState = vi.fn().mockResolvedValue({
			apiConfiguration: {},
			currentApiConfigName: undefined,
		})
		const postMessageToWebview = vi.fn()
		const upsertProviderProfile = vi.fn()

		const provider = {
			getState,
			postMessageToWebview,
			upsertProviderProfile,
		} as unknown as ClineProvider

		getModelsMock.mockResolvedValue({})

		await webviewMessageHandler(provider, {
			type: "flushRouterModels",
			text: "requesty",
		} as any)

		expect(flushModelsMock).toHaveBeenCalledWith("requesty")
		expect(flushModelProvidersMock).not.toHaveBeenCalled()
		expect(getModelsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: "requesty",
			}),
		)
		expect(upsertProviderProfile).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith({ type: "flushRouterModelsResult", success: true })
	})

	it("posts failure response when refetching models throws", async () => {
		const apiConfiguration = {
			apiProvider: "openrouter",
			openRouterModelId: "openrouter/model",
		}
		const getState = vi.fn().mockResolvedValue({
			apiConfiguration,
			currentApiConfigName: "default",
		})
		const postMessageToWebview = vi.fn()
		const upsertProviderProfile = vi.fn().mockResolvedValue(undefined)

		const provider = {
			getState,
			postMessageToWebview,
			upsertProviderProfile,
		} as unknown as ClineProvider

		const failure = new Error("failed to refresh")
		getModelsMock.mockRejectedValue(failure)

		await webviewMessageHandler(provider, {
			type: "flushRouterModels",
		} as any)

		expect(flushModelsMock).toHaveBeenCalledWith("openrouter")
		expect(flushModelProvidersMock).toHaveBeenCalledWith("openrouter", "openrouter/model")
		expect(upsertProviderProfile).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "flushRouterModelsResult",
			success: false,
			error: failure.message,
		})
	})
})
