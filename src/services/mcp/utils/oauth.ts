import { discoverOAuthProtectedResourceMetadata } from "@modelcontextprotocol/sdk/client/auth.js"

/**
 * Result of a successful OAuth discovery for an MCP server.
 */
export interface OAuthDiscoveryResult {
	/** The raw OAuth Authorization Server metadata (RFC 8414). */
	authServerMeta: Record<string, any>
	/**
	 * The RFC 8707 resource indicator — the `resource` field from the Protected
	 * Resource Metadata (RFC 9728).  `null` when the server didn't advertise one.
	 *
	 * Must be sent as the `resource` query parameter in authorization requests so
	 * the auth server can scope the issued tokens to this specific resource server.
	 */
	resourceIndicator: string | null
}

/**
 * Fetches the raw OAuth Authorization Server metadata for an MCP server URL.
 *
 * This replaces the SDK's built-in `discoverOAuthMetadata()` because it
 * constructs the RFC 8414 well-known URL incorrectly for auth servers with
 * path components — a known bug tracked in multiple upstream issues:
 *
 *  - https://github.com/modelcontextprotocol/typescript-sdk/issues/545
 *    (URL constructor discards base path with leading-slash well-known)
 *  - https://github.com/modelcontextprotocol/typescript-sdk/issues/762
 *    (uses MCP server URL instead of authorization server URL)
 *  - https://github.com/modelcontextprotocol/typescript-sdk/issues/744
 *    (doesn't respect provided authorization server URL)
 *  - https://github.com/modelcontextprotocol/typescript-sdk/issues/822
 *    (general RFC 8414 compliance — affects Keycloak, Okta, Azure Entra)
 *
 * Performs two discovery steps:
 *  1. RFC 9728 – fetches the Protected Resource Metadata to find the issuer URL
 *     and the RFC 8707 resource indicator.
 *  2. RFC 8414 §3.1 – constructs the well-known discovery URL by inserting
 *     `/.well-known/oauth-authorization-server` *between* the host and the issuer
 *     path (not appended after the path).
 *
 *     Correct:   https://example.com/.well-known/oauth-authorization-server/auth/public
 *     SDK wrong: https://example.com/auth/public/.well-known/oauth-authorization-server
 *
 * Returns an {@link OAuthDiscoveryResult} on success, or `null` if any step fails.
 */
export async function fetchOAuthAuthServerMetadata(serverUrl: string): Promise<OAuthDiscoveryResult | null> {
	try {
		// Step 1 – RFC 9728: resolve the authorization server issuer URL and
		// capture the resource indicator for RFC 8707.
		const resourceMeta = await discoverOAuthProtectedResourceMetadata(serverUrl)
		const authServers = resourceMeta.authorization_servers
		if (!authServers?.length) return null

		// RFC 8707: the `resource` field from the protected resource metadata is
		// used as the `resource` parameter in the authorization request so the auth
		// server can issue tokens scoped to this specific resource server.
		const resourceIndicator: string | null =
			typeof resourceMeta.resource === "string" ? resourceMeta.resource : null

		// Step 2 – RFC 8414 §3.1: build the well-known URL.
		// For issuer "https://example.com/auth/public"
		//   → "https://example.com/.well-known/oauth-authorization-server/auth/public"
		const parsed = new URL(authServers[0])
		const base = `${parsed.protocol}//${parsed.host}`
		const issuePath = parsed.pathname.replace(/\/$/, "") || ""
		const discoveryUrl = `${base}/.well-known/oauth-authorization-server${issuePath}`

		const response = await fetch(discoveryUrl, {
			headers: { Accept: "application/json" },
		})
		if (!response.ok) return null
		const authServerMeta = (await response.json()) as Record<string, any>
		return { authServerMeta, resourceIndicator }
	} catch {
		return null
	}
}
