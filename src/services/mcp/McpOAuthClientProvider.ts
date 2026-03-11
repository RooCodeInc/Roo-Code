import * as http from "http"

import * as vscode from "vscode"
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import type {
	OAuthClientInformation,
	OAuthClientInformationFull,
	OAuthClientMetadata,
	OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js"

import { SecretStorageService } from "./SecretStorageService"
import { startCallbackServer, stopCallbackServer } from "./utils/callbackServer"
import { fetchOAuthAuthServerMetadata } from "./utils/oauth"

/**
 * Implements the MCP SDK's OAuthClientProvider interface for VS Code.
 *
 * Responsibilities:
 *  - Stores/loads OAuth tokens via VS Code SecretStorage
 *  - Runs a local HTTP callback server to receive the authorization code
 *  - Opens the browser for the authorization redirect
 *  - Provides PKCE code verifier round-trip storage
 *
 * Usage pattern in McpHub:
 *  1. `const authProvider = await McpOAuthClientProvider.create(url, secretStorage)`
 *  2. Pass `authProvider` to `StreamableHTTPClientTransport({ authProvider })`
 *  3. `await client.connect(transport)` — may throw `UnauthorizedError`
 *  4. On `UnauthorizedError`: `code = await authProvider.waitForAuthCode()`
 *  5. `await transport.finishAuth(code)` then retry `client.connect(transport)`
 *  6. `await authProvider.close()` when done (success or permanent failure)
 */
export class McpOAuthClientProvider implements OAuthClientProvider {
	private _codeVerifier?: string
	// Client info is kept in-memory only (not persisted) to avoid stale registrations
	// when the redirect URI port changes between sessions.
	private _clientInfo?: OAuthClientInformationFull
	private _closed = false

	private constructor(
		private readonly _serverUrl: string,
		private readonly _secretStorage: SecretStorageService,
		private readonly _server: http.Server,
		private readonly _port: number,
		private readonly _authCodePromise: Promise<string>,
		private readonly _tokenEndpointAuthMethod: string,
		private readonly _grantTypes: string[],
		private readonly _scopes: string[],
		private readonly _state: string,
		private readonly _authServerMeta: Record<string, any> | null,
		private readonly _resourceIndicator: string | null,
		private readonly _clientName: string,
	) {}

	/**
	 * Factory — discovers OAuth Authorization Server metadata once (RFC 9728 +
	 * RFC 8414), starts the local callback server, and returns a ready provider.
	 *
	 * Discovery and callback-server startup both happen here so that:
	 *  - `redirectUrl` (used by the SDK to build the authorization URL) is
	 *    stable before any connect attempt.
	 *  - The same metadata object is reused for client registration without a
	 *    second network round-trip.
	 */
	static async create(
		serverUrl: string,
		secretStorage: SecretStorageService,
		serverName?: string,
	): Promise<McpOAuthClientProvider> {
		// Fetch auth server metadata once.  Reused for:
		//  - selecting token_endpoint_auth_method / grant_types / scopes
		//  - pre-registering the client (registration_endpoint)
		//  - RFC 8707 resource indicator (injected into authorization URL)
		const discovery = await fetchOAuthAuthServerMetadata(serverUrl)
		const authServerMeta = discovery?.authServerMeta ?? null
		const resourceIndicator = discovery?.resourceIndicator ?? null

		// Extract auth-method preferences.
		// Prefer "none" → first supported → "client_secret_post"
		const authMethods: string[] = authServerMeta?.token_endpoint_auth_methods_supported ?? []
		const tokenEndpointAuthMethod = authMethods.includes("none") ? "none" : (authMethods[0] ?? "client_secret_post")
		const grantTypes: string[] = authServerMeta?.grant_types_supported ?? ["authorization_code", "refresh_token"]
		const scopes: string[] = authServerMeta?.scopes_supported ?? []

		// Generate a CSRF state token for the OAuth flow.
		const state = Array.from(crypto.getRandomValues(new Uint8Array(8)))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")

		// Start the callback server now so the port is known and stable.
		// The SDK reads `redirectUrl` synchronously when building the authorization
		// URL, so the port must be available before any connect attempt.
		const { server, port, result } = await startCallbackServer(undefined, state)

		const authCodePromise = result.then((r) => {
			if (r.error) throw new Error(`OAuth authorization failed: ${r.error}`)
			if (!r.code) throw new Error("No authorization code received in callback")
			return r.code
		})

		return new McpOAuthClientProvider(
			serverUrl,
			secretStorage,
			server,
			port,
			authCodePromise,
			tokenEndpointAuthMethod,
			grantTypes,
			scopes,
			state,
			authServerMeta,
			resourceIndicator,
			serverName || "Roo Code",
		)
	}

	// ── OAuthClientProvider interface ────────────────────────────────────────

	get redirectUrl(): string {
		return `http://localhost:${this._port}/callback`
	}

	state(): string {
		return this._state
	}

	get clientMetadata(): OAuthClientMetadata {
		return {
			client_name: this._clientName,
			redirect_uris: [this.redirectUrl],
			grant_types: this._grantTypes,
			response_types: ["code"],
			token_endpoint_auth_method: this._tokenEndpointAuthMethod,
		}
	}

	async clientInformation(): Promise<OAuthClientInformation | undefined> {
		return this._clientInfo
	}

	async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
		this._clientInfo = info
	}

	/**
	 * Registers this client with the authorization server if a
	 * `registration_endpoint` is present in the pre-fetched auth server
	 * metadata.  No-ops if already registered or if the server doesn't
	 * support dynamic client registration.
	 *
	 * Called by McpHub before the first `client.connect()` attempt so that
	 * `clientInformation()` returns a valid client_id and the SDK skips its
	 * own registration step — which fails for issuers with path components
	 * due to the same metadata discovery bug (see utils/oauth.ts for
	 * upstream issue links).
	 */
	async registerClientIfNeeded(): Promise<void> {
		if (this._clientInfo) return // already registered

		// Check if we have a cached client_id from previous registration
		const cachedData = await this._secretStorage.getOAuthData(this._serverUrl)
		if (cachedData?.client_id && cachedData.redirect_uri === this.redirectUrl) {
			this._clientInfo = {
				client_id: cachedData.client_id,
				redirect_uris: [this.redirectUrl],
				client_name: this._clientName,
				grant_types: this._grantTypes,
				response_types: ["code"],
				token_endpoint_auth_method: this._tokenEndpointAuthMethod,
			}
			return
		}

		if (!this._authServerMeta?.registration_endpoint) return // DCR not supported

		const response = await fetch(this._authServerMeta.registration_endpoint as string, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(this.clientMetadata),
		})

		if (!response.ok) {
			throw new Error(`Dynamic client registration failed: HTTP ${response.status}`)
		}

		this._clientInfo = (await response.json()) as OAuthClientInformationFull
	}

	async tokens(): Promise<OAuthTokens | undefined> {
		const data = await this._secretStorage.getOAuthData(this._serverUrl)
		if (!data) return undefined
		// Return undefined 5 minutes before expiry so the SDK triggers re-auth
		// before the server actually rejects requests.
		if (Date.now() >= data.expires_at - 5 * 60 * 1000) return undefined
		return data.tokens
	}

	async saveTokens(tokens: OAuthTokens): Promise<void> {
		const expires_at = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : Date.now() + 3600 * 1000 // default 1 hour when server omits expires_in
		await this._secretStorage.saveOAuthData(this._serverUrl, {
			tokens,
			expires_at,
			client_id: this._clientInfo?.client_id,
			redirect_uri: this.redirectUrl,
		})
	}

	async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
		// Workaround for SDK metadata discovery bug (see utils/oauth.ts for issue links).
		// The SDK's discoverOAuthMetadata() builds a wrong well-known URL for issuers
		// with path components, causing it to fall back to a default "/authorize" path.
		// We correct the URL using our pre-fetched metadata:
		//  1. Replace the origin+pathname with the real authorization_endpoint.
		//  2. Preserve all SDK-generated query params (client_id, code_challenge, etc.)
		//  3. Add `scope` when the server advertises scopes but the SDK omitted it.
		//  4. Add RFC 8707 `resource` parameter when the protected resource metadata
		//     advertised a resource indicator.
		let correctedUrl = authorizationUrl
		if (this._authServerMeta?.authorization_endpoint) {
			try {
				const fixed = new URL(this._authServerMeta.authorization_endpoint as string)
				// Copy all query params generated by the SDK
				authorizationUrl.searchParams.forEach((value, key) => {
					fixed.searchParams.set(key, value)
				})
				// Ensure the scope param is present — the SDK sometimes omits it
				if (!fixed.searchParams.has("scope") && this._scopes.length > 0) {
					fixed.searchParams.set("scope", this._scopes.join(" "))
				}
				// RFC 8707: inject the resource indicator so the auth server can
				// scope the issued access token to this specific resource server.
				if (this._resourceIndicator && !fixed.searchParams.has("resource")) {
					fixed.searchParams.set("resource", this._resourceIndicator)
				}
				correctedUrl = fixed
			} catch {
				// Fall through and use the original URL if correction fails
			}
		}

		void vscode.window.showInformationMessage("MCP server requires authentication. Opening browser for OAuth…")
		try {
			await vscode.env.openExternal(vscode.Uri.parse(correctedUrl.toString()))
		} catch {
			void vscode.window.showInformationMessage(
				`Please open this URL in your browser to authenticate: ${correctedUrl}`,
			)
		}
	}

	async saveCodeVerifier(codeVerifier: string): Promise<void> {
		this._codeVerifier = codeVerifier
	}

	async codeVerifier(): Promise<string> {
		if (!this._codeVerifier) throw new Error("No PKCE code verifier saved")
		return this._codeVerifier
	}

	// ── Extra helpers for McpHub ─────────────────────────────────────────────

	/**
	 * Resolves with the authorization code once the user completes the OAuth
	 * browser flow and the local callback server receives the redirect.
	 * Rejects on error or 5-minute timeout.
	 */
	waitForAuthCode(): Promise<string> {
		return this._authCodePromise
	}

	/**
	 * Exchanges an authorization code for tokens by POSTing directly to the
	 * `token_endpoint` from our pre-fetched metadata.
	 *
	 * This bypasses the SDK's `transport.finishAuth()` which internally re-runs
	 * `discoverOAuthMetadata()` and hits the same broken URL construction for
	 * issuers with path components (see utils/oauth.ts for upstream issue links).
	 *
	 * After a successful exchange the tokens are persisted via `saveTokens()`
	 * so the next `client.connect()` call finds them in SecretStorage and
	 * connects without another OAuth round-trip.
	 *
	 * @param authorizationCode  The code received in the OAuth callback redirect.
	 * @throws When the token endpoint is unknown or the exchange request fails.
	 */
	async exchangeCodeForTokens(authorizationCode: string): Promise<void> {
		if (!this._authServerMeta?.token_endpoint) {
			throw new Error("No token_endpoint in auth server metadata — cannot exchange code")
		}
		if (!this._clientInfo) {
			throw new Error("No client information — registerClientIfNeeded() must be called first")
		}

		const codeVerifier = await this.codeVerifier()

		// Build the token request body per RFC 6749 §4.1.3 + RFC 7636 §4.5.
		const params: Record<string, string> = {
			grant_type: "authorization_code",
			code: authorizationCode,
			redirect_uri: this.redirectUrl,
			client_id: this._clientInfo.client_id,
			code_verifier: codeVerifier,
		}

		// Include client_secret in the body when the auth method is client_secret_post.
		if (this._tokenEndpointAuthMethod === "client_secret_post" && this._clientInfo.client_secret) {
			params.client_secret = this._clientInfo.client_secret
		}

		const response = await fetch(this._authServerMeta.token_endpoint as string, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: new URLSearchParams(params).toString(),
		})

		if (!response.ok) {
			throw new Error(`Token exchange failed: HTTP ${response.status}`)
		}

		const tokens = (await response.json()) as OAuthTokens
		await this.saveTokens(tokens)
	}

	/** Close the local callback server. Always call this when done. */
	async close(): Promise<void> {
		if (!this._closed) {
			this._closed = true
			await stopCallbackServer(this._server).catch(() => {})
		}
	}
}
