import * as vscode from "vscode"

const mockHttpsProxyAgentConstructor = vi.fn()

vi.mock("https-proxy-agent", () => ({
	HttpsProxyAgent: mockHttpsProxyAgentConstructor,
}))

vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
		onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
	},
}))

function createMockContext(): vscode.ExtensionContext {
	return {
		extensionMode: 1, // Production
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

describe("proxyFetch", () => {
	let mockHttpConfig: { get: ReturnType<typeof vi.fn> }
	let savedFetch: typeof globalThis.fetch

	beforeEach(() => {
		vi.clearAllMocks()
		vi.resetModules()

		savedFetch = globalThis.fetch

		mockHttpConfig = {
			get: vi.fn().mockReturnValue(undefined),
		}

		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
			mockHttpConfig as unknown as vscode.WorkspaceConfiguration,
		)

		// Clear proxy env vars
		delete process.env.HTTPS_PROXY
		delete process.env.https_proxy
		delete process.env.HTTP_PROXY
		delete process.env.http_proxy
	})

	afterEach(() => {
		globalThis.fetch = savedFetch
	})

	describe("resolveProxyUrl", () => {
		it("should return undefined when no proxy is configured", async () => {
			const { resolveProxyUrl } = await import("../proxyFetch")

			const result = resolveProxyUrl()

			expect(result).toBeUndefined()
		})

		it("should return VSCode http.proxy setting when configured", async () => {
			mockHttpConfig.get.mockImplementation((key: string) => {
				if (key === "proxy") return "http://corporate-proxy:8080"
				return undefined
			})

			const { resolveProxyUrl } = await import("../proxyFetch")

			const result = resolveProxyUrl()

			expect(result).toBe("http://corporate-proxy:8080")
			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("http")
		})

		it("should trim whitespace from VSCode proxy setting", async () => {
			mockHttpConfig.get.mockImplementation((key: string) => {
				if (key === "proxy") return "  http://corporate-proxy:8080  "
				return undefined
			})

			const { resolveProxyUrl } = await import("../proxyFetch")

			const result = resolveProxyUrl()

			expect(result).toBe("http://corporate-proxy:8080")
		})

		it("should ignore empty VSCode proxy setting and fall back to env vars", async () => {
			mockHttpConfig.get.mockImplementation((key: string) => {
				if (key === "proxy") return "   "
				return undefined
			})
			process.env.HTTPS_PROXY = "http://env-proxy:3128"

			const { resolveProxyUrl } = await import("../proxyFetch")

			const result = resolveProxyUrl()

			expect(result).toBe("http://env-proxy:3128")
		})

		it("should prefer HTTPS_PROXY over HTTP_PROXY", async () => {
			process.env.HTTPS_PROXY = "http://https-proxy:3128"
			process.env.HTTP_PROXY = "http://http-proxy:3128"

			const { resolveProxyUrl } = await import("../proxyFetch")

			const result = resolveProxyUrl()

			expect(result).toBe("http://https-proxy:3128")
		})

		it("should fall back to lowercase env vars", async () => {
			process.env.https_proxy = "http://lowercase-proxy:3128"

			const { resolveProxyUrl } = await import("../proxyFetch")

			const result = resolveProxyUrl()

			expect(result).toBe("http://lowercase-proxy:3128")
		})

		it("should prefer VSCode setting over env vars", async () => {
			mockHttpConfig.get.mockImplementation((key: string) => {
				if (key === "proxy") return "http://vscode-proxy:8080"
				return undefined
			})
			process.env.HTTPS_PROXY = "http://env-proxy:3128"

			const { resolveProxyUrl } = await import("../proxyFetch")

			const result = resolveProxyUrl()

			expect(result).toBe("http://vscode-proxy:8080")
		})
	})

	describe("getProxyHttpAgent", () => {
		it("should return undefined when no proxy is configured", async () => {
			const { getProxyHttpAgent } = await import("../proxyFetch")

			const agent = getProxyHttpAgent()

			expect(agent).toBeUndefined()
			expect(mockHttpsProxyAgentConstructor).not.toHaveBeenCalled()
		})

		it("should return an HttpsProxyAgent when proxy is configured", async () => {
			mockHttpConfig.get.mockImplementation((key: string) => {
				if (key === "proxy") return "http://corporate-proxy:8080"
				if (key === "proxyStrictSSL") return true
				return undefined
			})

			const mockAgent = { mock: true }
			mockHttpsProxyAgentConstructor.mockReturnValue(mockAgent)

			const { getProxyHttpAgent } = await import("../proxyFetch")

			const agent = getProxyHttpAgent()

			expect(agent).toBe(mockAgent)
			expect(mockHttpsProxyAgentConstructor).toHaveBeenCalledWith("http://corporate-proxy:8080", {
				rejectUnauthorized: true,
			})
		})

		it("should disable TLS verification when proxyStrictSSL is false", async () => {
			mockHttpConfig.get.mockImplementation((key: string) => {
				if (key === "proxy") return "http://corporate-proxy:8080"
				if (key === "proxyStrictSSL") return false
				return undefined
			})

			mockHttpsProxyAgentConstructor.mockReturnValue({ mock: true })

			const { getProxyHttpAgent } = await import("../proxyFetch")

			getProxyHttpAgent()

			expect(mockHttpsProxyAgentConstructor).toHaveBeenCalledWith("http://corporate-proxy:8080", {
				rejectUnauthorized: false,
			})
		})

		it("should return undefined and log error when HttpsProxyAgent constructor throws", async () => {
			mockHttpConfig.get.mockImplementation((key: string) => {
				if (key === "proxy") return "http://bad-proxy:9999"
				if (key === "proxyStrictSSL") return true
				return undefined
			})

			mockHttpsProxyAgentConstructor.mockImplementation(() => {
				throw new Error("Invalid proxy URL")
			})

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const { getProxyHttpAgent } = await import("../proxyFetch")

			const agent = getProxyHttpAgent()

			expect(agent).toBeUndefined()
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("[ProxyFetch] Failed to create HttpsProxyAgent"),
			)

			consoleErrorSpy.mockRestore()
		})

		it("should use env proxy when VSCode setting is not configured", async () => {
			process.env.HTTPS_PROXY = "http://env-proxy:3128"

			mockHttpsProxyAgentConstructor.mockReturnValue({ mock: true })

			const { getProxyHttpAgent } = await import("../proxyFetch")

			const agent = getProxyHttpAgent()

			expect(agent).toBeDefined()
			expect(mockHttpsProxyAgentConstructor).toHaveBeenCalledWith("http://env-proxy:3128", {
				rejectUnauthorized: true,
			})
		})
	})
})
