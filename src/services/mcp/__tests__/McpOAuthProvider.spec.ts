import type { ExtensionContext } from "vscode"

import { McpOAuthProvider } from "../McpOAuthProvider"

// ─── Hoisted mock values (accessible inside vi.mock factories) ────────

const { openExternalMock, mockServerInstance } = vi.hoisted(() => {
	const openExternalMock = vi.fn().mockResolvedValue(true)
	const mockServerInstance = {
		listen: vi.fn().mockImplementation((_port?: number, _host?: string, cb?: () => void) => {
			if (cb) cb()
		}),
		close: vi.fn(),
		address: vi.fn().mockReturnValue({ port: 45000, family: "IPv4", address: "127.0.0.1" }),
		on: vi.fn(),
	}
	return { openExternalMock, mockServerInstance }
})

// ─── Mock http module (prevent actual port binding) ───────────────────

vi.mock("http", () => ({
	createServer: vi.fn().mockReturnValue(mockServerInstance),
}))

// ─── Mock vscode module ───────────────────────────────────────────────

vi.mock("vscode", () => ({
	env: { openExternal: openExternalMock },
	Uri: {
		parse: (s: string) => ({ toString: () => s }),
	},
}))

// ─── In-memory SecretStorage mock ─────────────────────────────────────

function createMockSecretStorage() {
	const backingStore = new Map<string, string>()
	return {
		backingStore,
		get: vi.fn((key: string) => Promise.resolve(backingStore.get(key))),
		store: vi.fn((key: string, value: string) => {
			backingStore.set(key, value)
			return Promise.resolve()
		}),
		delete: vi.fn((key: string) => {
			backingStore.delete(key)
			return Promise.resolve()
		}),
		onDidChange: vi.fn(),
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────

function createMockContext() {
	const secrets = createMockSecretStorage()
	return {
		secrets,
		subscriptions: [],
	} as unknown as ExtensionContext
}

/**
 * Helper: get the static pendingByState map from McpOAuthProvider.
 */
function getPendingMap(): Map<string, McpOAuthProvider> {
	return (McpOAuthProvider as any).pendingByState as Map<string, McpOAuthProvider>
}

describe("McpOAuthProvider", () => {
	let provider: McpOAuthProvider
	let mockContext: ReturnType<typeof createMockContext>
	let secrets: ReturnType<typeof createMockSecretStorage>

	beforeEach(() => {
		vi.clearAllMocks()

		// Reset the static pendingByState map between tests
		getPendingMap().clear()

		mockContext = createMockContext()
		secrets = mockContext.secrets as any
		provider = new McpOAuthProvider("test-server", mockContext)
	})

	afterEach(() => {
		// Clean up any lingering callback servers and timeouts.
		// Catch any rejected promise to avoid unhandled rejection errors.
		try {
			const promise = (provider as any).authCodePromise as Promise<string> | undefined
			provider.cancelAuthFlow()
			if (promise) {
				promise.catch(() => {
					/* swallow expected rejection */
				})
			}
		} catch {
			/* already cleaned up */
		}
	})

	// ────────────────────────────────────────────────────────────────────
	// Token management
	// ────────────────────────────────────────────────────────────────────

	describe("tokens()", () => {
		it("returns undefined when no tokens are stored", async () => {
			const result = await provider.tokens()
			expect(result).toBeUndefined()
		})

		it("stores and retrieves tokens with correct key format", async () => {
			const tokens = { access_token: "abc123", token_type: "bearer", scope: "mcp" }
			await provider.saveTokens(tokens as any)

			expect(secrets.store).toHaveBeenCalledWith("mcp-oauth-tokens:test-server", JSON.stringify(tokens))

			const result = await provider.tokens()
			expect(result).toEqual(tokens)
		})

		it("returns undefined for malformed JSON", async () => {
			secrets.backingStore.set("mcp-oauth-tokens:test-server", "not-json")
			const result = await provider.tokens()
			expect(result).toBeUndefined()
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// Client information
	// ────────────────────────────────────────────────────────────────────

	describe("clientInformation()", () => {
		it("returns undefined when no client info is stored", async () => {
			const result = await provider.clientInformation()
			expect(result).toBeUndefined()
		})

		it("stores and retrieves client information with correct key format", async () => {
			const clientInfo = { client_id: "cid-123", client_secret: null }
			await provider.saveClientInformation(clientInfo as any)

			expect(secrets.store).toHaveBeenCalledWith("mcp-oauth-client:test-server", JSON.stringify(clientInfo))

			const result = await provider.clientInformation()
			expect(result).toEqual(clientInfo)
		})

		it("returns undefined for malformed JSON", async () => {
			secrets.backingStore.set("mcp-oauth-client:test-server", "{invalid")
			const result = await provider.clientInformation()
			expect(result).toBeUndefined()
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// Code verifier
	// ────────────────────────────────────────────────────────────────────

	describe("codeVerifier()", () => {
		it("throws when no code verifier is stored", async () => {
			await expect(provider.codeVerifier()).rejects.toThrow("No PKCE code verifier found for MCP OAuth flow")
		})

		it("stores and retrieves code verifier with correct key format", async () => {
			await provider.saveCodeVerifier("my-verifier-123")

			expect(secrets.store).toHaveBeenCalledWith("mcp-oauth-verifier:test-server", "my-verifier-123")

			const result = await provider.codeVerifier()
			expect(result).toBe("my-verifier-123")
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// Discovery state
	// ────────────────────────────────────────────────────────────────────

	describe("discoveryState()", () => {
		it("returns undefined when no discovery state is stored", async () => {
			const result = await provider.discoveryState()
			expect(result).toBeUndefined()
		})

		it("stores and retrieves discovery state with correct key format", async () => {
			const state = {
				issuer: "https://auth.example.com",
				authorization_endpoint: "https://auth.example.com/authorize",
			}
			await provider.saveDiscoveryState(state as any)

			expect(secrets.store).toHaveBeenCalledWith("mcp-oauth-discovery:test-server", JSON.stringify(state))

			const result = await provider.discoveryState()
			expect(result).toEqual(state)
		})

		it("returns undefined for malformed JSON", async () => {
			secrets.backingStore.set("mcp-oauth-discovery:test-server", "bad-json")
			const result = await provider.discoveryState()
			expect(result).toBeUndefined()
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// redirectUrl
	// ────────────────────────────────────────────────────────────────────

	describe("redirectUrl", () => {
		it("returns a localhost URL with /callback path", () => {
			const url = provider.redirectUrl
			expect(url).toBeDefined()
			const urlStr = (url ?? "").toString()
			expect(urlStr).toMatch(/^http:\/\/localhost:\d+\/callback$/)
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// clientMetadata
	// ────────────────────────────────────────────────────────────────────

	describe("clientMetadata", () => {
		it("has correct grant_types for PKCE public client", () => {
			const meta = provider.clientMetadata
			expect(meta.grant_types).toEqual(["authorization_code", "refresh_token"])
			expect(meta.response_types).toEqual(["code"])
			expect(meta.token_endpoint_auth_method).toBe("none")
			expect(meta.client_name).toBe("Roo Code")
			expect(meta.scope).toBe("mcp")
		})

		it("includes redirect_uris matching redirectUrl", () => {
			const meta = provider.clientMetadata
			expect(meta.redirect_uris).toContain(provider.redirectUrl)
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// redirectToAuthorization
	// ────────────────────────────────────────────────────────────────────

	describe("redirectToAuthorization()", () => {
		it("calls openExternal with the authorization URL", async () => {
			const authUrl = new URL("https://auth.example.com/authorize?state=abc123&client_id=test")

			await provider.redirectToAuthorization(authUrl)

			expect(openExternalMock).toHaveBeenCalledTimes(1)
		})

		it("creates authCodePromise so waitForAuthCode does not reject", async () => {
			const authUrl = new URL("https://auth.example.com/authorize?state=abc123&client_id=test")

			await provider.redirectToAuthorization(authUrl)

			// waitForAuthCode should return a promise (not reject immediately)
			const promise = provider.waitForAuthCode()
			expect(promise).toBeInstanceOf(Promise)
			// Prevent unhandled rejection — clean up
			provider.cancelAuthFlow()
			promise.catch(() => {})
		})

		it("handles authorization URL without state parameter without error", async () => {
			const authUrl = new URL("https://auth.example.com/authorize?client_id=test")

			await expect(provider.redirectToAuthorization(authUrl)).resolves.toBeUndefined()
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// invalidateCredentials
	// ────────────────────────────────────────────────────────────────────

	describe("invalidateCredentials()", () => {
		it('deletes only tokens for scope "tokens"', async () => {
			await provider.saveTokens({ access_token: "t" } as any)
			await provider.saveClientInformation({ client_id: "c" } as any)
			await provider.saveCodeVerifier("v")
			await provider.saveDiscoveryState({ issuer: "i" } as any)

			await provider.invalidateCredentials("tokens")

			expect(await provider.tokens()).toBeUndefined()
			expect(await provider.clientInformation()).toBeDefined()
			await expect(provider.codeVerifier()).resolves.toBe("v")
			expect(await provider.discoveryState()).toBeDefined()
		})

		it('deletes only client info for scope "client"', async () => {
			await provider.saveTokens({ access_token: "t" } as any)
			await provider.saveClientInformation({ client_id: "c" } as any)
			await provider.saveCodeVerifier("v")
			await provider.saveDiscoveryState({ issuer: "i" } as any)

			await provider.invalidateCredentials("client")

			expect(await provider.clientInformation()).toBeUndefined()
			expect(await provider.tokens()).toBeDefined()
			await expect(provider.codeVerifier()).resolves.toBe("v")
			expect(await provider.discoveryState()).toBeDefined()
		})

		it('deletes only verifier for scope "verifier"', async () => {
			await provider.saveTokens({ access_token: "t" } as any)
			await provider.saveClientInformation({ client_id: "c" } as any)
			await provider.saveCodeVerifier("v")
			await provider.saveDiscoveryState({ issuer: "i" } as any)

			await provider.invalidateCredentials("verifier")

			await expect(provider.codeVerifier()).rejects.toThrow()
			expect(await provider.tokens()).toBeDefined()
			expect(await provider.clientInformation()).toBeDefined()
			expect(await provider.discoveryState()).toBeDefined()
		})

		it('deletes only discovery state for scope "discovery"', async () => {
			await provider.saveTokens({ access_token: "t" } as any)
			await provider.saveClientInformation({ client_id: "c" } as any)
			await provider.saveCodeVerifier("v")
			await provider.saveDiscoveryState({ issuer: "i" } as any)

			await provider.invalidateCredentials("discovery")

			expect(await provider.discoveryState()).toBeUndefined()
			expect(await provider.tokens()).toBeDefined()
			expect(await provider.clientInformation()).toBeDefined()
			await expect(provider.codeVerifier()).resolves.toBe("v")
		})

		it('deletes all keys for scope "all"', async () => {
			await provider.saveTokens({ access_token: "t" } as any)
			await provider.saveClientInformation({ client_id: "c" } as any)
			await provider.saveCodeVerifier("v")
			await provider.saveDiscoveryState({ issuer: "i" } as any)

			await provider.invalidateCredentials("all")

			expect(await provider.tokens()).toBeUndefined()
			expect(await provider.clientInformation()).toBeUndefined()
			await expect(provider.codeVerifier()).rejects.toThrow()
			expect(await provider.discoveryState()).toBeUndefined()
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// waitForAuthCode
	// ────────────────────────────────────────────────────────────────────

	describe("waitForAuthCode()", () => {
		it("rejects when no pending OAuth callback exists", async () => {
			await expect(provider.waitForAuthCode()).rejects.toThrow("No pending OAuth callback")
		})

		it("resolves when authCodeResolve is called (simulating callback)", async () => {
			const authUrl = new URL("https://auth.example.com/authorize?state=s1&client_id=test")
			await provider.redirectToAuthorization(authUrl)

			const authCodePromise = provider.waitForAuthCode()

			// Directly resolve via the internal authCodeResolve,
			// simulating what resolveFromUriCallback or the callback server does.
			const resolve = (provider as any).authCodeResolve as ((code: string) => void) | undefined
			expect(resolve).toBeDefined()
			resolve!("auth-code-xyz")

			await expect(authCodePromise).resolves.toBe("auth-code-xyz")
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// cancelAuthFlow
	// ────────────────────────────────────────────────────────────────────

	describe("cancelAuthFlow()", () => {
		it("rejects pending promise and cleans up", async () => {
			const authUrl = new URL("https://auth.example.com/authorize?state=s2&client_id=test")
			await provider.redirectToAuthorization(authUrl)

			const authCodePromise = provider.waitForAuthCode()

			provider.cancelAuthFlow()

			await expect(authCodePromise).rejects.toThrow("OAuth flow cancelled")
		})

		it("clears internal promise references", async () => {
			const authUrl = new URL("https://auth.example.com/authorize?state=s2b&client_id=test")
			await provider.redirectToAuthorization(authUrl)

			// Capture the promise before cancellation so we can swallow the rejection
			const pendingPromise = provider.waitForAuthCode()

			provider.cancelAuthFlow()

			await expect(pendingPromise).rejects.toThrow("OAuth flow cancelled")

			expect((provider as any).authCodePromise).toBeUndefined()
			expect((provider as any).authCodeResolve).toBeUndefined()
			expect((provider as any).authCodeReject).toBeUndefined()
		})

		it("does nothing when there is no pending flow", () => {
			// Should not throw
			provider.cancelAuthFlow()
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// Static registry — pendingByState and resolveFromUriCallback
	//
	// NOTE: closeCallbackServer() removes entries from pendingByState.
	// redirectToAuthorization -> startCallbackServer -> closeCallbackServer
	// cleans up the map, so we manually populate it for these tests.
	// ────────────────────────────────────────────────────────────────────

	describe("resolveFromUriCallback()", () => {
		it("returns false when no pending provider matches the state", () => {
			const result = McpOAuthProvider.resolveFromUriCallback("nonexistent", "code123")
			expect(result).toBe(false)
		})

		it("returns true and resolves the pending auth code promise", async () => {
			// Set up the provider with a pending auth code promise
			const authUrl = new URL("https://auth.example.com/authorize?state=mystate&client_id=test")
			await provider.redirectToAuthorization(authUrl)

			const authCodePromise = provider.waitForAuthCode()

			// Re-register in the pendingByState map (closeCallbackServer removed it)
			getPendingMap().set("mystate", provider)

			const result = McpOAuthProvider.resolveFromUriCallback("mystate", "code-abc")
			expect(result).toBe(true)

			await expect(authCodePromise).resolves.toBe("code-abc")
		})

		it("removes the entry from pendingByState after resolution", async () => {
			const authUrl = new URL("https://auth.example.com/authorize?state=rmState&client_id=test")
			await provider.redirectToAuthorization(authUrl)

			// Manually re-add to pendingByState
			getPendingMap().set("rmState", provider)

			expect(getPendingMap().has("rmState")).toBe(true)

			McpOAuthProvider.resolveFromUriCallback("rmState", "code-xyz")

			expect(getPendingMap().has("rmState")).toBe(false)
		})

		it("does not resolve the same provider twice", async () => {
			const authUrl = new URL("https://auth.example.com/authorize?state=dbState&client_id=test")
			await provider.redirectToAuthorization(authUrl)

			const authCodePromise = provider.waitForAuthCode()

			// Manually re-add to pendingByState
			getPendingMap().set("dbState", provider)

			// First resolution succeeds
			McpOAuthProvider.resolveFromUriCallback("dbState", "code-1")
			await expect(authCodePromise).resolves.toBe("code-1")

			// Second resolution returns false because entry was removed
			const result = McpOAuthProvider.resolveFromUriCallback("dbState", "code-2")
			expect(result).toBe(false)
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// Name sanitization — special characters in server names
	// ────────────────────────────────────────────────────────────────────

	describe("name sanitization", () => {
		it("produces valid storage keys for server names with spaces", () => {
			const specialProvider = new McpOAuthProvider("my server name", mockContext)
			specialProvider.saveTokens({ access_token: "t" } as any)

			expect(secrets.store).toHaveBeenCalledWith("mcp-oauth-tokens:my_server_name", expect.any(String))

			specialProvider.cancelAuthFlow()
		})

		it("produces valid storage keys for server names with special characters", () => {
			const specialProvider = new McpOAuthProvider("server@#$%!name", mockContext)
			specialProvider.saveTokens({ access_token: "t" } as any)

			// sanitizeMcpName strips non-alphanumeric/underscore/hyphen chars
			expect(secrets.store).toHaveBeenCalledWith("mcp-oauth-tokens:servername", expect.any(String))

			specialProvider.cancelAuthFlow()
		})

		it("produces valid storage keys for server names starting with a digit", () => {
			const specialProvider = new McpOAuthProvider("123server", mockContext)
			specialProvider.saveTokens({ access_token: "t" } as any)

			// sanitizeMcpName prepends underscore when name starts with a digit
			expect(secrets.store).toHaveBeenCalledWith("mcp-oauth-tokens:_123server", expect.any(String))

			specialProvider.cancelAuthFlow()
		})
	})

	// ────────────────────────────────────────────────────────────────────
	// getServerName
	// ────────────────────────────────────────────────────────────────────

	describe("getServerName()", () => {
		it("returns the original server name", () => {
			expect(provider.getServerName()).toBe("test-server")
		})
	})
})
