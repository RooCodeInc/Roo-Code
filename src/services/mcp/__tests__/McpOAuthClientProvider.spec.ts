import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock vscode
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
	},
	env: {
		openExternal: vi.fn().mockResolvedValue(true),
	},
	Uri: {
		parse: vi.fn((url: string) => ({ toString: () => url })),
	},
}))

// Mock callbackServer
vi.mock("../utils/callbackServer", () => ({
	startCallbackServer: vi.fn(),
	stopCallbackServer: vi.fn().mockResolvedValue(undefined),
}))

// Mock fetch for auth discovery so tests don't make real network calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock SDK auth discovery functions
vi.mock("@modelcontextprotocol/sdk/client/auth.js", () => ({
	discoverOAuthProtectedResourceMetadata: vi.fn().mockResolvedValue({
		resource: "https://example.com/",
		authorization_servers: ["https://auth.example.com"],
	}),
}))

// Set up fetch mock to return auth metadata with "none" auth method
mockFetch.mockResolvedValue({
	ok: true,
	json: () =>
		Promise.resolve({
			issuer: "https://auth.example.com",
			authorization_endpoint: "https://auth.example.com/authorize",
			token_endpoint: "https://auth.example.com/token",
			response_types_supported: ["code"],
			token_endpoint_auth_methods_supported: ["none"],
			grant_types_supported: ["authorization_code", "refresh_token"],
		}),
})

import { McpOAuthClientProvider } from "../McpOAuthClientProvider"
import { SecretStorageService } from "../SecretStorageService"
import { startCallbackServer, stopCallbackServer } from "../utils/callbackServer"
import { discoverOAuthProtectedResourceMetadata } from "@modelcontextprotocol/sdk/client/auth.js"
import * as vscode from "vscode"

function createMockSecretStorage(): SecretStorageService {
	const store = new Map<string, string>()
	return {
		getOAuthData: vi.fn(async (url: string) => {
			const raw = store.get(url)
			return raw ? JSON.parse(raw) : undefined
		}),
		saveOAuthData: vi.fn(async (url: string, data: any) => {
			store.set(url, JSON.stringify(data))
		}),
		deleteOAuthData: vi.fn(async (url: string) => {
			store.delete(url)
		}),
	} as unknown as SecretStorageService
}

function setupCallbackServerMock(code = "test-auth-code", state?: string) {
	const mockServer = { close: vi.fn((cb: () => void) => cb()) }
	const resultPromise = Promise.resolve({ code, state })
	;(startCallbackServer as any).mockResolvedValue({
		server: mockServer,
		port: 12345,
		result: resultPromise,
	})
	return { mockServer, resultPromise }
}

describe("McpOAuthClientProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("create", () => {
		it("should start a callback server and return a provider", async () => {
			setupCallbackServerMock()

			const secretStorage = createMockSecretStorage()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", secretStorage)

			expect(startCallbackServer).toHaveBeenCalledWith(undefined, expect.any(String))
			expect(provider.redirectUrl).toBe("http://localhost:12345/callback")
			await provider.close()
		})
	})

	describe("clientMetadata", () => {
		it("should return correct metadata with redirect URI", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			const metadata = provider.clientMetadata

			expect(metadata.client_name).toBe("Roo Code")
			expect(metadata.redirect_uris).toEqual(["http://localhost:12345/callback"])
			expect(metadata.grant_types).toContain("authorization_code")
			expect(metadata.response_types).toContain("code")
			expect(metadata.token_endpoint_auth_method).toBe("none")
			await provider.close()
		})

		it("should use server name as client_name when provided", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create(
				"https://example.com/mcp",
				createMockSecretStorage(),
				"figma",
			)

			expect(provider.clientMetadata.client_name).toBe("figma")
			await provider.close()
		})
	})

	describe("clientInformation / saveClientInformation", () => {
		it("should return undefined initially", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			expect(await provider.clientInformation()).toBeUndefined()
			await provider.close()
		})

		it("should return saved client info", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			const info = {
				client_id: "test-id",
				client_secret: "test-secret",
				redirect_uris: ["http://localhost:12345/callback"],
			}
			await provider.saveClientInformation(info as any)

			const result = await provider.clientInformation()
			expect(result).toEqual(info)
			await provider.close()
		})
	})

	describe("tokens / saveTokens", () => {
		it("should return undefined when no tokens stored", async () => {
			setupCallbackServerMock()
			const secretStorage = createMockSecretStorage()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", secretStorage)

			expect(await provider.tokens()).toBeUndefined()
			await provider.close()
		})

		it("should store and return tokens", async () => {
			setupCallbackServerMock()
			const secretStorage = createMockSecretStorage()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", secretStorage)

			const tokens = {
				access_token: "test-token",
				token_type: "Bearer",
				expires_in: 3600,
			}
			await provider.saveTokens(tokens)

			const result = await provider.tokens()
			expect(result).toEqual(tokens)
			await provider.close()
		})

		it("should return undefined for expired tokens", async () => {
			setupCallbackServerMock()
			const secretStorage = createMockSecretStorage()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", secretStorage)

			// Directly store data with an expires_at in the past so tokens() returns undefined
			await secretStorage.saveOAuthData("https://example.com/mcp", {
				tokens: { access_token: "expired", token_type: "Bearer" },
				expires_at: Date.now() - 1000, // already expired
			})

			expect(await provider.tokens()).toBeUndefined()
			await provider.close()
		})
	})

	describe("codeVerifier / saveCodeVerifier", () => {
		it("should throw if no verifier saved", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			await expect(provider.codeVerifier()).rejects.toThrow("No PKCE code verifier saved")
			await provider.close()
		})

		it("should round-trip code verifier", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			await provider.saveCodeVerifier("test-verifier-123")
			expect(await provider.codeVerifier()).toBe("test-verifier-123")
			await provider.close()
		})
	})

	describe("redirectToAuthorization", () => {
		it("should open browser with the authorization URL", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			const authUrl = new URL("https://auth.example.com/authorize?client_id=test")
			await provider.redirectToAuthorization(authUrl)

			expect(vscode.env.openExternal).toHaveBeenCalled()
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("Opening browser for OAuth"),
			)
			await provider.close()
		})

		it("should show URL as fallback if browser open fails", async () => {
			setupCallbackServerMock()
			;(vscode.env.openExternal as any).mockRejectedValueOnce(new Error("no browser"))
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			const authUrl = new URL("https://auth.example.com/authorize?client_id=test")
			await provider.redirectToAuthorization(authUrl)

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("Please open this URL"),
			)
			await provider.close()
		})

		it("should correct a wrong authorization URL using pre-fetched metadata", async () => {
			// Mock discovery to return an issuer with a path component.
			// The SDK's discoverOAuthMetadata builds the wrong URL for such issuers,
			// so it typically falls back to a bare /authorize path.
			;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValueOnce({
				resource: "https://mcp.kapa.ai/",
				authorization_servers: ["https://mcp.kapa.ai/auth/public"],
			})
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						issuer: "https://mcp.kapa.ai/auth/public",
						authorization_endpoint: "https://mcp.kapa.ai/auth/public/authorize",
						token_endpoint: "https://mcp.kapa.ai/auth/public/token",
						registration_endpoint: "https://mcp.kapa.ai/auth/public/register",
						token_endpoint_auth_methods_supported: ["client_secret_post"],
						grant_types_supported: ["authorization_code", "refresh_token"],
						scopes_supported: ["openid"],
					}),
			})

			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://mcp.kapa.ai/mcp", createMockSecretStorage())

			// Simulate the SDK building the wrong base URL (using bare /authorize) and omitting scope
			const sdkWrongUrl = new URL("https://mcp.kapa.ai/authorize?client_id=abc&code_challenge=xyz&state=123")
			await provider.redirectToAuthorization(sdkWrongUrl)

			// The provider should have corrected the URL to use the real authorization_endpoint
			const openedUri = (vscode.env.openExternal as any).mock.calls[0][0].toString()
			expect(openedUri).toContain("https://mcp.kapa.ai/auth/public/authorize")
			expect(openedUri).toContain("client_id=abc")
			expect(openedUri).toContain("code_challenge=xyz")
			expect(openedUri).toContain("state=123")
			// scope should be injected from metadata
			expect(openedUri).toContain("scope=openid")
			// RFC 8707: resource indicator from protected resource metadata should be injected
			expect(openedUri).toContain("resource=")
			expect(decodeURIComponent(openedUri)).toContain("resource=https://mcp.kapa.ai/")
			await provider.close()
		})

		it("should inject RFC 8707 resource indicator from protected resource metadata", async () => {
			// Mock discovery returning a resource indicator (RFC 9728 `resource` field)
			;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValueOnce({
				resource: "https://temporal.mcp.kapa.ai/",
				authorization_servers: ["https://mcp.kapa.ai/auth/public"],
			})
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						issuer: "https://mcp.kapa.ai/auth/public",
						authorization_endpoint: "https://mcp.kapa.ai/auth/public/authorize",
						token_endpoint: "https://mcp.kapa.ai/auth/public/token",
						token_endpoint_auth_methods_supported: ["none"],
						grant_types_supported: ["authorization_code"],
						scopes_supported: ["openid"],
					}),
			})

			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create(
				"https://temporal.mcp.kapa.ai/mcp",
				createMockSecretStorage(),
			)

			const sdkUrl = new URL("https://mcp.kapa.ai/authorize?client_id=abc&state=123")
			await provider.redirectToAuthorization(sdkUrl)

			const openedUri = (vscode.env.openExternal as any).mock.calls[0][0].toString()
			// The resource indicator from the protected resource metadata must appear
			// as the `resource` query parameter (RFC 8707)
			expect(decodeURIComponent(openedUri)).toContain("resource=https://temporal.mcp.kapa.ai/")
			await provider.close()
		})

		it("should not duplicate resource if the SDK already included it", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			// SDK URL already contains a resource param
			const sdkUrl = new URL(
				"https://auth.example.com/authorize?client_id=abc&resource=https%3A%2F%2Fexample.com%2F&state=123",
			)
			await provider.redirectToAuthorization(sdkUrl)

			const openedUri = (vscode.env.openExternal as any).mock.calls[0][0].toString()
			const resourceMatches = (openedUri.match(/resource=/g) || []).length
			expect(resourceMatches).toBe(1)
			await provider.close()
		})

		it("should not duplicate scope if the SDK already included it", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			// SDK URL already includes scope=openid
			const sdkUrl = new URL("https://auth.example.com/authorize?client_id=abc&scope=openid&state=123")
			await provider.redirectToAuthorization(sdkUrl)

			// scope should appear exactly once
			const openedUri = (vscode.env.openExternal as any).mock.calls[0][0].toString()
			const scopeMatches = (openedUri.match(/scope=/g) || []).length
			expect(scopeMatches).toBe(1)
			await provider.close()
		})
	})

	describe("exchangeCodeForTokens", () => {
		it("should POST to the token_endpoint and save tokens", async () => {
			;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValueOnce({
				resource: "https://mcp.kapa.ai/",
				authorization_servers: ["https://mcp.kapa.ai/auth/public"],
			})
			const tokenResponse = {
				access_token: "access-token-xyz",
				token_type: "Bearer",
				expires_in: 3600,
			}
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							issuer: "https://mcp.kapa.ai/auth/public",
							authorization_endpoint: "https://mcp.kapa.ai/auth/public/authorize",
							token_endpoint: "https://mcp.kapa.ai/auth/public/token",
							registration_endpoint: "https://mcp.kapa.ai/auth/public/register",
							token_endpoint_auth_methods_supported: ["client_secret_post"],
							grant_types_supported: ["authorization_code", "refresh_token"],
							scopes_supported: ["openid"],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(tokenResponse),
				})

			setupCallbackServerMock()
			const secretStorage = createMockSecretStorage()
			const provider = await McpOAuthClientProvider.create("https://mcp.kapa.ai/mcp", secretStorage)

			// Set up client info and code verifier
			await provider.saveClientInformation({
				client_id: "client-id-123",
				client_secret: "client-secret-abc",
				redirect_uris: ["http://localhost:12345/callback"],
			} as any)
			await provider.saveCodeVerifier("pkce-verifier-123")

			await provider.exchangeCodeForTokens("auth-code-abc")

			// Verify the token endpoint was called with correct params
			const tokenCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
			expect(tokenCall[0]).toBe("https://mcp.kapa.ai/auth/public/token")
			expect(tokenCall[1].method).toBe("POST")
			const body = new URLSearchParams(tokenCall[1].body)
			expect(body.get("grant_type")).toBe("authorization_code")
			expect(body.get("code")).toBe("auth-code-abc")
			expect(body.get("client_id")).toBe("client-id-123")
			expect(body.get("client_secret")).toBe("client-secret-abc")
			expect(body.get("code_verifier")).toBe("pkce-verifier-123")
			expect(body.get("redirect_uri")).toBe("http://localhost:12345/callback")

			// Verify tokens were saved
			const saved = await provider.tokens()
			expect(saved).toEqual(tokenResponse)

			await provider.close()
		})

		it("should throw when no token_endpoint is available", async () => {
			;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValueOnce({
				authorization_servers: ["https://auth.example.com"],
			})
			// Return metadata without token_endpoint
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						issuer: "https://auth.example.com",
						authorization_endpoint: "https://auth.example.com/authorize",
						// no token_endpoint
					}),
			})

			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			await provider.saveClientInformation({ client_id: "id", redirect_uris: [] } as any)
			await provider.saveCodeVerifier("verifier")

			await expect(provider.exchangeCodeForTokens("code")).rejects.toThrow("No token_endpoint")
			await provider.close()
		})

		it("should throw when no client information is available", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			await provider.saveCodeVerifier("verifier")

			// No saveClientInformation called — should throw
			await expect(provider.exchangeCodeForTokens("code")).rejects.toThrow("No client information")
			await provider.close()
		})

		it("should throw when the token endpoint returns a non-OK response", async () => {
			;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValueOnce({
				resource: "https://mcp.kapa.ai/",
				authorization_servers: ["https://mcp.kapa.ai/auth/public"],
			})
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							issuer: "https://mcp.kapa.ai/auth/public",
							authorization_endpoint: "https://mcp.kapa.ai/auth/public/authorize",
							token_endpoint: "https://mcp.kapa.ai/auth/public/token",
							token_endpoint_auth_methods_supported: ["client_secret_post"],
							grant_types_supported: ["authorization_code"],
						}),
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 400,
					text: () => Promise.resolve('{"error":"invalid_grant"}'),
				})

			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://mcp.kapa.ai/mcp", createMockSecretStorage())

			await provider.saveClientInformation({ client_id: "id", redirect_uris: [] } as any)
			await provider.saveCodeVerifier("verifier")

			await expect(provider.exchangeCodeForTokens("bad-code")).rejects.toThrow("Token exchange failed: HTTP 400")
			await provider.close()
		})
	})

	describe("waitForAuthCode", () => {
		it("should resolve with auth code from callback server", async () => {
			setupCallbackServerMock("my-code")
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			const code = await provider.waitForAuthCode()
			expect(code).toBe("my-code")
			await provider.close()
		})

		it("should reject if callback returns error", async () => {
			const mockServer = { close: vi.fn((cb: () => void) => cb()) }
			;(startCallbackServer as any).mockResolvedValue({
				server: mockServer,
				port: 12345,
				result: Promise.resolve({ error: "access_denied" }),
			})

			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			await expect(provider.waitForAuthCode()).rejects.toThrow("OAuth authorization failed: access_denied")
			await provider.close()
		})

		it("should reject if callback returns no code", async () => {
			const mockServer = { close: vi.fn((cb: () => void) => cb()) }
			;(startCallbackServer as any).mockResolvedValue({
				server: mockServer,
				port: 12345,
				result: Promise.resolve({}),
			})

			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			await expect(provider.waitForAuthCode()).rejects.toThrow("No authorization code received")
			await provider.close()
		})
	})

	describe("close", () => {
		it("should stop the callback server", async () => {
			const { mockServer } = setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			await provider.close()

			expect(stopCallbackServer).toHaveBeenCalledWith(mockServer)
		})

		it("should be idempotent", async () => {
			setupCallbackServerMock()
			const provider = await McpOAuthClientProvider.create("https://example.com/mcp", createMockSecretStorage())

			await provider.close()
			await provider.close()

			expect(stopCallbackServer).toHaveBeenCalledTimes(1)
		})
	})
})
