import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the SDK's discoverOAuthProtectedResourceMetadata
vi.mock("@modelcontextprotocol/sdk/client/auth.js", () => ({
	discoverOAuthProtectedResourceMetadata: vi.fn(),
}))

import { discoverOAuthProtectedResourceMetadata } from "@modelcontextprotocol/sdk/client/auth.js"
import { fetchOAuthAuthServerMetadata } from "../oauth"

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("fetchOAuthAuthServerMetadata", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns null when resource metadata has no authorization_servers", async () => {
		;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValue({
			resource: "https://example.com/",
			authorization_servers: [],
		})

		const result = await fetchOAuthAuthServerMetadata("https://example.com/mcp")
		expect(result).toBeNull()
	})

	it("returns null when discoverOAuthProtectedResourceMetadata throws", async () => {
		;(discoverOAuthProtectedResourceMetadata as any).mockRejectedValue(new Error("network error"))

		const result = await fetchOAuthAuthServerMetadata("https://example.com/mcp")
		expect(result).toBeNull()
	})

	it("constructs the RFC 8414 discovery URL correctly for an issuer with a path", async () => {
		;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValue({
			resource: "https://mcp.kapa.ai/",
			authorization_servers: ["https://mcp.kapa.ai/auth/public"],
		})

		const mockMeta = {
			issuer: "https://mcp.kapa.ai/auth/public",
			registration_endpoint: "https://mcp.kapa.ai/auth/public/register",
		}
		mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockMeta) })

		const result = await fetchOAuthAuthServerMetadata("https://mcp.kapa.ai/mcp")

		// Verify the RFC 8414 §3.1 URL: well-known inserted between host and path
		expect(mockFetch).toHaveBeenCalledWith(
			"https://mcp.kapa.ai/.well-known/oauth-authorization-server/auth/public",
			expect.objectContaining({ headers: { Accept: "application/json" } }),
		)
		expect(result).toEqual({ authServerMeta: mockMeta, resourceIndicator: "https://mcp.kapa.ai/" })
	})

	it("constructs the RFC 8414 discovery URL correctly for an issuer without a path", async () => {
		;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValue({
			resource: "https://auth.example.com/",
			authorization_servers: ["https://auth.example.com"],
		})

		const mockMeta = { issuer: "https://auth.example.com" }
		mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockMeta) })

		await fetchOAuthAuthServerMetadata("https://auth.example.com/mcp")

		expect(mockFetch).toHaveBeenCalledWith(
			"https://auth.example.com/.well-known/oauth-authorization-server",
			expect.any(Object),
		)
	})

	it("strips trailing slash from issuer path before inserting well-known", async () => {
		;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValue({
			resource: "https://example.com/",
			authorization_servers: ["https://example.com/issuer/"],
		})

		mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

		await fetchOAuthAuthServerMetadata("https://example.com/mcp")

		expect(mockFetch).toHaveBeenCalledWith(
			"https://example.com/.well-known/oauth-authorization-server/issuer",
			expect.any(Object),
		)
	})

	it("returns null when the discovery endpoint returns a non-OK response", async () => {
		;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValue({
			resource: "https://example.com/",
			authorization_servers: ["https://auth.example.com"],
		})

		mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

		const result = await fetchOAuthAuthServerMetadata("https://example.com/mcp")
		expect(result).toBeNull()
	})

	it("returns null when fetch throws", async () => {
		;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValue({
			resource: "https://example.com/",
			authorization_servers: ["https://auth.example.com"],
		})

		mockFetch.mockRejectedValueOnce(new Error("connection refused"))

		const result = await fetchOAuthAuthServerMetadata("https://example.com/mcp")
		expect(result).toBeNull()
	})

	it("returns the parsed metadata and resource indicator on success", async () => {
		;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValue({
			resource: "https://example.com/",
			authorization_servers: ["https://auth.example.com/oauth2"],
		})

		const meta = {
			issuer: "https://auth.example.com/oauth2",
			authorization_endpoint: "https://auth.example.com/oauth2/authorize",
			token_endpoint: "https://auth.example.com/oauth2/token",
			registration_endpoint: "https://auth.example.com/oauth2/register",
			token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			scopes_supported: ["openid"],
		}
		mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(meta) })

		const result = await fetchOAuthAuthServerMetadata("https://example.com/mcp")
		expect(result).toEqual({ authServerMeta: meta, resourceIndicator: "https://example.com/" })
	})

	it("returns null resourceIndicator when protected resource metadata has no resource field", async () => {
		;(discoverOAuthProtectedResourceMetadata as any).mockResolvedValue({
			authorization_servers: ["https://auth.example.com"],
			// no `resource` field
		})

		const meta = { issuer: "https://auth.example.com" }
		mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(meta) })

		const result = await fetchOAuthAuthServerMetadata("https://example.com/mcp")
		expect(result).toEqual({ authServerMeta: meta, resourceIndicator: null })
	})
})
