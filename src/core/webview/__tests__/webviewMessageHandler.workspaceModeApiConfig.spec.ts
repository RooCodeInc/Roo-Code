// npx vitest run core/webview/__tests__/webviewMessageHandler.workspaceModeApiConfig.spec.ts

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"

describe("webviewMessageHandler - setWorkspaceModeApiConfig", () => {
	let mockProvider: {
		context: {
			workspaceState: {
				get: ReturnType<typeof vi.fn>
				update: ReturnType<typeof vi.fn>
			}
		}
		getState: ReturnType<typeof vi.fn>
		postStateToWebview: ReturnType<typeof vi.fn>
		providerSettingsManager: {
			setModeConfig: ReturnType<typeof vi.fn>
		}
		postMessageToWebview: ReturnType<typeof vi.fn>
		getCurrentTask: ReturnType<typeof vi.fn>
	}

	let workspaceStateStore: Record<string, unknown>

	beforeEach(() => {
		vi.clearAllMocks()

		workspaceStateStore = {}

		mockProvider = {
			context: {
				workspaceState: {
					get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
						return key in workspaceStateStore ? workspaceStateStore[key] : defaultValue
					}),
					update: vi.fn().mockImplementation((key: string, value: unknown) => {
						workspaceStateStore[key] = value
						return Promise.resolve()
					}),
				},
			},
			getState: vi.fn().mockResolvedValue({
				currentApiConfigName: "test-config",
				listApiConfigMeta: [{ name: "test-config", id: "config-123" }],
				customModes: [],
				experiments: { workspaceProfileOverrides: true },
			}),
			postStateToWebview: vi.fn(),
			providerSettingsManager: {
				setModeConfig: vi.fn(),
			},
			postMessageToWebview: vi.fn(),
			getCurrentTask: vi.fn(),
		}
	})

	it("does nothing when experiment is disabled", async () => {
		mockProvider.getState.mockResolvedValueOnce({
			currentApiConfigName: "test-config",
			listApiConfigMeta: [{ name: "test-config", id: "config-123" }],
			customModes: [],
			experiments: { workspaceProfileOverrides: false },
		})

		await webviewMessageHandler(mockProvider as unknown as ClineProvider, {
			type: "setWorkspaceModeApiConfig",
			mode: "code",
			text: "config-123",
		})

		expect(mockProvider.context.workspaceState.update).not.toHaveBeenCalled()
	})

	it("sets a workspace mode API config for a specific mode", async () => {
		await webviewMessageHandler(mockProvider as unknown as ClineProvider, {
			type: "setWorkspaceModeApiConfig",
			mode: "code",
			text: "config-123",
		})

		expect(mockProvider.context.workspaceState.update).toHaveBeenCalledWith("workspaceModeApiConfigs", {
			code: "config-123",
		})
		expect(mockProvider.postStateToWebview).toHaveBeenCalled()
	})

	it("clears a workspace mode API config when text is undefined", async () => {
		// Pre-populate with an existing mapping
		workspaceStateStore["workspaceModeApiConfigs"] = { code: "config-123", architect: "config-456" }

		await webviewMessageHandler(mockProvider as unknown as ClineProvider, {
			type: "setWorkspaceModeApiConfig",
			mode: "code",
			// text is undefined - clears the override
		})

		expect(mockProvider.context.workspaceState.update).toHaveBeenCalledWith("workspaceModeApiConfigs", {
			architect: "config-456",
		})
		expect(mockProvider.postStateToWebview).toHaveBeenCalled()
	})

	it("preserves existing workspace configs when adding a new one", async () => {
		workspaceStateStore["workspaceModeApiConfigs"] = { architect: "config-456" }

		await webviewMessageHandler(mockProvider as unknown as ClineProvider, {
			type: "setWorkspaceModeApiConfig",
			mode: "code",
			text: "config-789",
		})

		expect(mockProvider.context.workspaceState.update).toHaveBeenCalledWith("workspaceModeApiConfigs", {
			architect: "config-456",
			code: "config-789",
		})
	})

	it("does nothing if mode is not provided", async () => {
		await webviewMessageHandler(mockProvider as unknown as ClineProvider, {
			type: "setWorkspaceModeApiConfig",
			// mode is undefined
			text: "config-123",
		})

		expect(mockProvider.context.workspaceState.update).not.toHaveBeenCalled()
	})
})

describe("webviewMessageHandler - clearWorkspaceModeApiConfig", () => {
	let mockProvider: {
		context: {
			workspaceState: {
				get: ReturnType<typeof vi.fn>
				update: ReturnType<typeof vi.fn>
			}
		}
		getState: ReturnType<typeof vi.fn>
		postStateToWebview: ReturnType<typeof vi.fn>
		providerSettingsManager: {
			setModeConfig: ReturnType<typeof vi.fn>
		}
		postMessageToWebview: ReturnType<typeof vi.fn>
		getCurrentTask: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		vi.clearAllMocks()

		mockProvider = {
			context: {
				workspaceState: {
					get: vi.fn(),
					update: vi.fn().mockResolvedValue(undefined),
				},
			},
			getState: vi.fn().mockResolvedValue({
				currentApiConfigName: "test-config",
				listApiConfigMeta: [{ name: "test-config", id: "config-123" }],
				customModes: [],
			}),
			postStateToWebview: vi.fn(),
			providerSettingsManager: {
				setModeConfig: vi.fn(),
			},
			postMessageToWebview: vi.fn(),
			getCurrentTask: vi.fn(),
		}
	})

	it("clears all workspace mode API configs", async () => {
		await webviewMessageHandler(mockProvider as unknown as ClineProvider, {
			type: "clearWorkspaceModeApiConfig",
		})

		expect(mockProvider.context.workspaceState.update).toHaveBeenCalledWith("workspaceModeApiConfigs", {})
		expect(mockProvider.postStateToWebview).toHaveBeenCalled()
	})
})
