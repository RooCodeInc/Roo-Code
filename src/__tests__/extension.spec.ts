import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("vscode", () => ({
	window: {
		createTextEditorDecorationType: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
	RelativePattern: vi.fn(),
	workspace: {
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidChange: vi.fn(),
			onDidCreate: vi.fn(),
			onDidDelete: vi.fn(),
		}),
		getConfiguration: vi.fn().mockReturnValue({ update: vi.fn() }),
	},
	env: { language: "en" },
}))

vi.mock("../api", () => ({
	buildApiHandler: vi.fn(),
}))

import { ensureResolvedModelInfo } from "../extension"
import { buildApiHandler } from "../api"
import { ClineProvider } from "../core/webview/ClineProvider"

describe("activation-time resolvedModelInfo", () => {
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

	it("populates missing resolvedModelInfo for a dynamic provider on activation", async () => {
		const provider: any = {
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: { apiProvider: "openrouter", openRouterModelId: "openrouter/model" },
				currentApiConfigName: "default",
			}),
			upsertProviderProfile: vi.fn().mockResolvedValue("id"),
		}

		const info = { contextWindow: 4000, maxTokens: 8192, supportsPromptCache: true }
		const handler = {
			fetchModel: vi.fn().mockResolvedValue({ info }),
			getModel: vi.fn().mockReturnValue({ id: "openrouter/model", info }),
		}
		;(buildApiHandler as any).mockReturnValue(handler)

		await ensureResolvedModelInfo(provider)

		expect(buildApiHandler).toHaveBeenCalled()
		expect(provider.upsertProviderProfile).toHaveBeenCalledWith(
			"default",
			expect.objectContaining({ resolvedModelInfo: info }),
			true,
		)
		expect(logSpy.mock.calls.some((c: any[]) => String(c.join(" ")).includes("Populating resolvedModelInfo"))).toBe(
			true,
		)
	})

	it("skips when resolvedModelInfo is valid", async () => {
		const resolved = { contextWindow: 16000, maxTokens: 8000 }
		const provider: any = {
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: { apiProvider: "openrouter", resolvedModelInfo: resolved },
				currentApiConfigName: "default",
			}),
			upsertProviderProfile: vi.fn(),
		}

		await ensureResolvedModelInfo(provider)

		expect(buildApiHandler).not.toHaveBeenCalled()
		expect(provider.upsertProviderProfile).not.toHaveBeenCalled()
		expect(
			logSpy.mock.calls.some((c: any[]) => String(c.join(" ")).includes("Using existing resolvedModelInfo")),
		).toBe(true)
	})

	it("skips for static providers", async () => {
		const provider: any = {
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: { apiProvider: "anthropic", apiModelId: "claude-3-5-sonnet" },
				currentApiConfigName: "default",
			}),
			upsertProviderProfile: vi.fn(),
		}

		await ensureResolvedModelInfo(provider)

		expect(buildApiHandler).not.toHaveBeenCalled()
		expect(provider.upsertProviderProfile).not.toHaveBeenCalled()
	})
})

describe("settings save gating (Phase 3.2)", () => {
	let logSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		vi.clearAllMocks()
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		logSpy.mockRestore()
	})

	const bindProvider = (impl: any) => (ClineProvider.prototype.upsertProviderProfile as any).bind(impl)

	it("does not reinit on unrelated setting change and preserves resolvedModelInfo", async () => {
		const prevConfig = {
			apiProvider: "openrouter",
			openRouterModelId: "openrouter/model",
			openRouterBaseUrl: "https://openrouter.ai/api/v1",
			resolvedModelInfo: { contextWindow: 4000, maxTokens: 8192 },
			modelTemperature: 0.1,
		}

		const nextConfig = {
			...prevConfig,
			modelTemperature: 0.2, // unrelated change
		}

		const provider: any = {
			providerSettingsManager: {
				saveConfig: vi.fn().mockResolvedValue("id"),
				listConfig: vi.fn().mockResolvedValue([]),
				setModeConfig: vi.fn().mockResolvedValue(undefined),
			},
			updateGlobalState: vi.fn().mockResolvedValue(undefined),
			contextProxy: { setProviderSettings: vi.fn().mockResolvedValue(undefined) },
			getState: vi.fn().mockResolvedValue({ apiConfiguration: prevConfig, mode: "architect" }),
			getCurrentTask: vi.fn().mockReturnValue({ api: undefined }),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		}

		;(buildApiHandler as any).mockReturnValue({}) // handler if reinit (should NOT be called)

		const upsert = bindProvider(provider)
		await upsert("default", nextConfig, true)

		expect(provider.providerSettingsManager.saveConfig).toHaveBeenCalledWith("default", nextConfig)
		expect(provider.contextProxy.setProviderSettings).toHaveBeenCalledWith(nextConfig)
		expect(buildApiHandler).not.toHaveBeenCalled()
		expect(
			logSpy.mock.calls.some((c: any[]) =>
				String(c.join(" ")).includes("[model-cache/save] No reinit: provider/model/baseUrl unchanged"),
			),
		).toBe(true)
		// Ensure resolvedModelInfo remained intact in persisted payload
		expect((provider.providerSettingsManager.saveConfig as any).mock.calls[0][1].resolvedModelInfo).toEqual(
			prevConfig.resolvedModelInfo,
		)
	})

	it("reinit when provider/model/baseUrl changes (modelId change)", async () => {
		const prevConfig = {
			apiProvider: "openrouter",
			openRouterModelId: "openrouter/model",
			openRouterBaseUrl: "https://openrouter.ai/api/v1",
		}

		const nextConfig = {
			...prevConfig,
			openRouterModelId: "openrouter/other-model", // model change should trigger reinit
		}

		const handler = {}
		;(buildApiHandler as any).mockReturnValue(handler)

		const task: any = { api: undefined }

		const provider: any = {
			providerSettingsManager: {
				saveConfig: vi.fn().mockResolvedValue("id"),
				listConfig: vi.fn().mockResolvedValue([]),
				setModeConfig: vi.fn().mockResolvedValue(undefined),
			},
			updateGlobalState: vi.fn().mockResolvedValue(undefined),
			contextProxy: { setProviderSettings: vi.fn().mockResolvedValue(undefined) },
			getState: vi.fn().mockResolvedValue({ apiConfiguration: prevConfig, mode: "architect" }),
			getCurrentTask: vi.fn().mockReturnValue(task),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		}

		const upsert = bindProvider(provider)
		await upsert("default", nextConfig, true)

		expect(provider.providerSettingsManager.saveConfig).toHaveBeenCalledWith("default", nextConfig)
		expect(buildApiHandler).toHaveBeenCalledWith(nextConfig)
		expect(task.api).toBe(handler)
		expect(
			logSpy.mock.calls.some((c: any[]) =>
				String(c.join(" ")).includes("[model-cache/save] Reinit: relevant fields changed"),
			),
		).toBe(true)
	})

	it("reinit when router baseUrl changes", async () => {
		const prevConfig = {
			apiProvider: "requesty",
			requestyModelId: "requesty/model",
			requestyBaseUrl: "https://api.requesty.ai",
		}

		const nextConfig = {
			...prevConfig,
			requestyBaseUrl: "https://custom.requesty.ai", // baseUrl change should trigger reinit
		}

		const handler = {}
		;(buildApiHandler as any).mockReturnValue(handler)

		const task: any = { api: undefined }

		const provider: any = {
			providerSettingsManager: {
				saveConfig: vi.fn().mockResolvedValue("id"),
				listConfig: vi.fn().mockResolvedValue([]),
				setModeConfig: vi.fn().mockResolvedValue(undefined),
			},
			updateGlobalState: vi.fn().mockResolvedValue(undefined),
			contextProxy: { setProviderSettings: vi.fn().mockResolvedValue(undefined) },
			getState: vi.fn().mockResolvedValue({ apiConfiguration: prevConfig, mode: "architect" }),
			getCurrentTask: vi.fn().mockReturnValue(task),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		}

		const upsert = bindProvider(provider)
		await upsert("default", nextConfig, true)

		expect(buildApiHandler).toHaveBeenCalledWith(nextConfig)
		expect(task.api).toBe(handler)
	})
})
