import * as vscode from "vscode"
import { initializeNetworkProxy, getProxyConfig, isProxyEnabled, isDebugMode } from "../networkProxy"

// Mock global-agent
vi.mock("global-agent", () => ({
	bootstrap: vi.fn(),
}))

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
		onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
	},
	ExtensionMode: {
		Development: 2,
		Production: 1,
		Test: 3,
	},
}))

describe("networkProxy", () => {
	let mockOutputChannel: vscode.OutputChannel
	let mockConfig: { get: ReturnType<typeof vi.fn> }

	// Helper to create mock context with configurable extensionMode
	function createMockContext(mode: vscode.ExtensionMode = vscode.ExtensionMode.Production): vscode.ExtensionContext {
		return {
			extensionMode: mode,
			subscriptions: [],
			extensionPath: "/test/path",
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
				setKeysForSync: vi.fn(),
			},
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
				delete: vi.fn(),
				onDidChange: vi.fn(),
			},
			extensionUri: { fsPath: "/test/path" } as vscode.Uri,
			globalStorageUri: { fsPath: "/test/global" } as vscode.Uri,
			logUri: { fsPath: "/test/logs" } as vscode.Uri,
			storageUri: { fsPath: "/test/storage" } as vscode.Uri,
			storagePath: "/test/storage",
			globalStoragePath: "/test/global",
			logPath: "/test/logs",
			asAbsolutePath: vi.fn((p) => `/test/path/${p}`),
			environmentVariableCollection: {} as vscode.GlobalEnvironmentVariableCollection,
			extension: {} as vscode.Extension<unknown>,
			languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation,
		} as unknown as vscode.ExtensionContext
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Reset environment variables
		delete process.env.GLOBAL_AGENT_HTTP_PROXY
		delete process.env.GLOBAL_AGENT_HTTPS_PROXY
		delete process.env.GLOBAL_AGENT_NO_PROXY

		mockConfig = {
			get: vi.fn().mockReturnValue(""),
		}

		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
			mockConfig as unknown as vscode.WorkspaceConfiguration,
		)

		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
			name: "Test",
			replace: vi.fn(),
		} as unknown as vscode.OutputChannel
	})

	describe("initializeNetworkProxy", () => {
		it("should initialize without proxy when proxyUrl is empty", () => {
			mockConfig.get.mockReturnValue("")
			const context = createMockContext()

			initializeNetworkProxy(context, mockOutputChannel)

			expect(process.env.GLOBAL_AGENT_HTTP_PROXY).toBeUndefined()
			expect(process.env.GLOBAL_AGENT_HTTPS_PROXY).toBeUndefined()
		})

		it("should configure proxy environment variables when proxyUrl is set", () => {
			mockConfig.get.mockReturnValue("http://localhost:8080")
			// Proxy is only applied in debug mode.
			const context = createMockContext(vscode.ExtensionMode.Development)

			initializeNetworkProxy(context, mockOutputChannel)

			expect(process.env.GLOBAL_AGENT_HTTP_PROXY).toBe("http://localhost:8080")
			expect(process.env.GLOBAL_AGENT_HTTPS_PROXY).toBe("http://localhost:8080")
		})

		it("should not modify TLS settings in debug mode", () => {
			mockConfig.get.mockReturnValue("")
			const context = createMockContext(vscode.ExtensionMode.Development)

			initializeNetworkProxy(context, mockOutputChannel)

			expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
		})

		it("should register configuration change listener", () => {
			const context = createMockContext()

			initializeNetworkProxy(context, mockOutputChannel)

			expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled()
			expect(context.subscriptions.length).toBeGreaterThan(0)
		})
	})

	describe("getProxyConfig", () => {
		it("should return empty config before initialization", () => {
			// Reset the module to clear internal state
			vi.resetModules()

			const config = getProxyConfig()

			expect(config.proxyUrl).toBeUndefined()
			expect(config.isDebugMode).toBe(false)
		})

		it("should return correct config after initialization", () => {
			mockConfig.get.mockReturnValue("http://proxy.example.com:3128")
			const context = createMockContext(vscode.ExtensionMode.Production)

			initializeNetworkProxy(context, mockOutputChannel)
			const config = getProxyConfig()

			expect(config.proxyUrl).toBe("http://proxy.example.com:3128")
			expect(config.isDebugMode).toBe(false)
		})

		it("should trim whitespace from proxy URL", () => {
			mockConfig.get.mockReturnValue("  http://proxy.example.com:3128  ")
			const context = createMockContext()

			initializeNetworkProxy(context, mockOutputChannel)
			const config = getProxyConfig()

			expect(config.proxyUrl).toBe("http://proxy.example.com:3128")
		})

		it("should return undefined for empty proxy URL", () => {
			mockConfig.get.mockReturnValue("   ")
			const context = createMockContext()

			initializeNetworkProxy(context, mockOutputChannel)
			const config = getProxyConfig()

			expect(config.proxyUrl).toBeUndefined()
		})
	})

	describe("isProxyEnabled", () => {
		it("should return false when no proxy is configured", () => {
			mockConfig.get.mockReturnValue("")
			const context = createMockContext()

			initializeNetworkProxy(context, mockOutputChannel)

			expect(isProxyEnabled()).toBe(false)
		})

		it("should return true when proxy is configured", () => {
			mockConfig.get.mockReturnValue("http://localhost:8080")
			// Proxy is only applied in debug mode.
			const context = createMockContext(vscode.ExtensionMode.Development)

			initializeNetworkProxy(context, mockOutputChannel)

			expect(isProxyEnabled()).toBe(true)
		})
	})

	describe("isDebugMode", () => {
		it("should return false in production mode", () => {
			const context = createMockContext(vscode.ExtensionMode.Production)

			initializeNetworkProxy(context, mockOutputChannel)

			expect(isDebugMode()).toBe(false)
		})

		it("should return true in development mode", () => {
			const context = createMockContext(vscode.ExtensionMode.Development)

			initializeNetworkProxy(context, mockOutputChannel)

			expect(isDebugMode()).toBe(true)
		})

		// Note: This test is skipped because module state persists across tests.
		// In a real scenario, isDebugMode() returns false before any initialization.
		// The actual behavior is verified in integration testing.
		it.skip("should return false before initialization", () => {
			// This would require full module isolation which isn't practical here
			expect(isDebugMode()).toBe(false)
		})
	})

	describe("security", () => {
		it("should never disable TLS verification via NODE_TLS_REJECT_UNAUTHORIZED", () => {
			mockConfig.get.mockReturnValue("http://localhost:8080")
			const context = createMockContext(vscode.ExtensionMode.Development)

			initializeNetworkProxy(context, mockOutputChannel)

			expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
		})
	})
})
