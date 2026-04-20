import * as http from "http"

import * as vscode from "vscode"

import type { OAuthClientProvider, OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js"
import type {
	OAuthClientInformationMixed,
	OAuthClientMetadata,
	OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js"

import { sanitizeMcpName } from "../../utils/mcp-name"

/**
 * SecretStorage key prefixes for per-server OAuth data.
 */
const STORAGE_KEY_PREFIXES = {
	tokens: "mcp-oauth-tokens",
	client: "mcp-oauth-client",
	verifier: "mcp-oauth-verifier",
	discovery: "mcp-oauth-discovery",
} as const

/**
 * HTML page shown in the browser after successful authentication.
 * Matches the pattern from OpenAI Codex OAuth callback.
 */
const AUTH_SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Authentication Successful</title>
<style>
body {
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100vh;
	margin: 0;
	background: linear-gradient(135deg, #10a37f 0%, #0d8f6f 100%);
	color: white;
}
.container { text-align: center; padding: 2rem; }
h1 { font-size: 2rem; margin-bottom: 1rem; }
p { opacity: 0.9; }
</style>
</head>
<body>
<div class="container">
<h1>&#10003; Authentication Successful</h1>
<p>You can close this window and return to VS Code.</p>
</div>
<script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`

/**
 * HTML page shown in the browser when authentication fails.
 */
const AUTH_FAILURE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Authentication Failed</title>
<style>
body {
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100vh;
	margin: 0;
	background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
	color: white;
}
.container { text-align: center; padding: 2rem; }
h1 { font-size: 2rem; margin-bottom: 1rem; }
p { opacity: 0.9; }
</style>
</head>
<body>
<div class="container">
<h1>&#10007; Authentication Failed</h1>
<p>You can close this window and try again from VS Code.</p>
</div>
<script>setTimeout(() => window.close(), 5000);</script>
</body>
</html>`

/** 5-minute timeout for the OAuth callback, matching the Codex pattern */
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000

/**
 * McpOAuthProvider implements the OAuthClientProvider interface from
 * @modelcontextprotocol/sdk, adapting it to VS Code's SecretStorage,
 * browser launching via vscode.env.openExternal, and a localhost callback
 * server for the authorization code flow.
 *
 * Each instance is scoped to a single MCP server, identified by serverName.
 * Token storage uses per-server keys in VS Code SecretStorage for isolation.
 *
 * The OAuth flow is orchestrated by the SDK — this provider only handles
 * VS Code-specific concerns (storage, browser, callback).
 */
export class McpOAuthProvider implements OAuthClientProvider {
	/**
	 * Static registry mapping OAuth state → provider instance.
	 * Used by the VS Code URI handler fallback to route callbacks
	 * when the auth server redirects via vscode:// URIs instead of localhost.
	 */
	private static readonly pendingByState = new Map<string, McpOAuthProvider>()

	private readonly serverName: string
	private readonly sanitizedName: string
	private readonly context: vscode.ExtensionContext
	private readonly _redirectUrl: string
	private callbackServer?: http.Server
	private callbackTimeout?: ReturnType<typeof setTimeout>

	/** Promise resolved when the callback server receives the authorization code */
	private authCodeResolve?: (code: string) => void
	private authCodeReject?: (error: Error) => void
	private authCodePromise?: Promise<string>

	constructor(serverName: string, context: vscode.ExtensionContext) {
		this.serverName = serverName
		this.sanitizedName = sanitizeMcpName(serverName)
		this.context = context

		// Allocate a free port for the localhost callback server.
		// The SDK reads redirectUrl before calling redirectToAuthorization,
		// so we need the port eagerly in the constructor.
		this._redirectUrl = this.allocatePort()
	}

	// ─── Required OAuthClientProvider members ──────────────────────────

	get redirectUrl(): string | URL | undefined {
		return this._redirectUrl
	}

	get clientMetadata(): OAuthClientMetadata {
		return {
			client_name: "Roo Code",
			redirect_uris: [this._redirectUrl],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none", // public client — PKCE provides protection
			scope: "mcp",
		}
	}

	async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
		const key = `${STORAGE_KEY_PREFIXES.client}:${this.sanitizedName}`
		const stored = await this.context.secrets.get(key)
		if (!stored) return undefined
		try {
			return JSON.parse(stored) as OAuthClientInformationMixed
		} catch {
			return undefined
		}
	}

	async saveClientInformation(clientInformation: OAuthClientInformationMixed): Promise<void> {
		const key = `${STORAGE_KEY_PREFIXES.client}:${this.sanitizedName}`
		await this.context.secrets.store(key, JSON.stringify(clientInformation))
	}

	async tokens(): Promise<OAuthTokens | undefined> {
		const key = `${STORAGE_KEY_PREFIXES.tokens}:${this.sanitizedName}`
		const stored = await this.context.secrets.get(key)
		if (!stored) return undefined
		try {
			return JSON.parse(stored) as OAuthTokens
		} catch {
			return undefined
		}
	}

	async saveTokens(tokens: OAuthTokens): Promise<void> {
		const key = `${STORAGE_KEY_PREFIXES.tokens}:${this.sanitizedName}`
		await this.context.secrets.store(key, JSON.stringify(tokens))
	}

	async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
		// Create the promise that will be resolved when the callback server
		// receives the authorization code
		this.authCodePromise = new Promise<string>((resolve, reject) => {
			this.authCodeResolve = resolve
			this.authCodeReject = reject
		})

		// Register in the static map so the URI handler fallback can route
		// callbacks when auth servers redirect via vscode:// URIs.
		// The SDK includes a `state` query parameter on the authorization URL.
		const state = authorizationUrl.searchParams.get("state")
		if (state) {
			McpOAuthProvider.pendingByState.set(state, this)
		}

		// Start the localhost callback server
		await this.startCallbackServer()

		// Open the authorization URL in the user's default browser
		await vscode.env.openExternal(vscode.Uri.parse(authorizationUrl.toString()))
	}

	async saveCodeVerifier(codeVerifier: string): Promise<void> {
		const key = `${STORAGE_KEY_PREFIXES.verifier}:${this.sanitizedName}`
		await this.context.secrets.store(key, codeVerifier)
	}

	async codeVerifier(): Promise<string> {
		const key = `${STORAGE_KEY_PREFIXES.verifier}:${this.sanitizedName}`
		const stored = await this.context.secrets.get(key)
		if (!stored) {
			throw new Error("No PKCE code verifier found for MCP OAuth flow")
		}
		return stored
	}

	// ─── Optional OAuthClientProvider members ──────────────────────────

	async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): Promise<void> {
		const keysToDelete: string[] = []

		switch (scope) {
			case "all":
				keysToDelete.push(
					`${STORAGE_KEY_PREFIXES.tokens}:${this.sanitizedName}`,
					`${STORAGE_KEY_PREFIXES.client}:${this.sanitizedName}`,
					`${STORAGE_KEY_PREFIXES.verifier}:${this.sanitizedName}`,
					`${STORAGE_KEY_PREFIXES.discovery}:${this.sanitizedName}`,
				)
				break
			case "tokens":
				keysToDelete.push(`${STORAGE_KEY_PREFIXES.tokens}:${this.sanitizedName}`)
				break
			case "client":
				keysToDelete.push(`${STORAGE_KEY_PREFIXES.client}:${this.sanitizedName}`)
				break
			case "verifier":
				keysToDelete.push(`${STORAGE_KEY_PREFIXES.verifier}:${this.sanitizedName}`)
				break
			case "discovery":
				keysToDelete.push(`${STORAGE_KEY_PREFIXES.discovery}:${this.sanitizedName}`)
				break
		}

		await Promise.all(keysToDelete.map((key) => this.context.secrets.delete(key)))
	}

	async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
		const key = `${STORAGE_KEY_PREFIXES.discovery}:${this.sanitizedName}`
		await this.context.secrets.store(key, JSON.stringify(state))
	}

	async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
		const key = `${STORAGE_KEY_PREFIXES.discovery}:${this.sanitizedName}`
		const stored = await this.context.secrets.get(key)
		if (!stored) return undefined
		try {
			return JSON.parse(stored) as OAuthDiscoveryState
		} catch {
			return undefined
		}
	}

	// ─── Custom methods for McpHub integration ─────────────────────────

	/**
	 * Returns a promise that resolves with the authorization code once
	 * the user completes the OAuth flow in their browser.
	 *
	 * McpHub calls this after catching UnauthorizedError to wait for
	 * the callback in a non-blocking fashion.
	 */
	waitForAuthCode(): Promise<string> {
		if (!this.authCodePromise) {
			return Promise.reject(new Error("No pending OAuth callback — redirectToAuthorization not yet called"))
		}
		return this.authCodePromise
	}

	/**
	 * Cancels any pending OAuth flow and cleans up resources.
	 */
	cancelAuthFlow(): void {
		if (this.authCodeReject) {
			this.authCodeReject(new Error("OAuth flow cancelled"))
		}
		this.authCodeResolve = undefined
		this.authCodeReject = undefined
		this.authCodePromise = undefined
		this.closeCallbackServer()
	}

	/**
	 * Returns the server name this provider is scoped to.
	 */
	getServerName(): string {
		return this.serverName
	}

	/**
	 * Resolves a pending OAuth flow from the VS Code URI handler.
	 * Called when an auth server redirects via vscode:// URIs instead of
	 * the localhost callback server.
	 *
	 * @param state  The `state` parameter from the callback URI
	 * @param code   The authorization code from the callback URI
	 * @returns true if a pending provider was found and resolved
	 */
	static resolveFromUriCallback(state: string, code: string): boolean {
		const provider = McpOAuthProvider.pendingByState.get(state)
		if (!provider) return false

		provider.authCodeResolve?.(code)
		provider.authCodeResolve = undefined
		provider.authCodeReject = undefined
		provider.authCodePromise = undefined
		McpOAuthProvider.pendingByState.delete(state)
		provider.closeCallbackServer()
		return true
	}

	// ─── Private helpers ───────────────────────────────────────────────

	/**
	 * Allocates a free port by starting and immediately closing a server.
	 * Returns the localhost callback URL with the allocated port.
	 *
	 * There is a small race window between close and re-listen, but it's
	 * negligible in practice. The alternative (keeping the server running)
	 * is wasteful since most connections don't need OAuth.
	 */
	private allocatePort(): string {
		const server = http.createServer()
		server.listen(0, "127.0.0.1")

		const address = server.address()
		const port = address && typeof address === "object" ? address.port : 0

		server.close()

		if (!port) {
			// Fallback: use a random port in the 14000-15000 range
			const fallbackPort = 14000 + Math.floor(Math.random() * 1000)
			return `http://localhost:${fallbackPort}/callback`
		}

		return `http://localhost:${port}/callback`
	}

	/**
	 * Starts the localhost HTTP callback server to receive the authorization
	 * code from the OAuth flow.
	 */
	private startCallbackServer(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Close any existing callback server
			this.closeCallbackServer()

			const port = this.extractPort()

			this.callbackServer = http.createServer(async (req, res) => {
				try {
					const url = new URL(req.url || "/", `http://localhost:${port}`)

					if (url.pathname !== "/callback") {
						res.writeHead(404)
						res.end("Not Found")
						return
					}

					const code = url.searchParams.get("code")
					const error = url.searchParams.get("error")

					if (error) {
						const errorDesc = url.searchParams.get("error_description") || error
						res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
						res.end(AUTH_FAILURE_HTML)

						if (this.authCodeReject) {
							this.authCodeReject(new Error(`OAuth error: ${error} — ${errorDesc}`))
							this.authCodeResolve = undefined
							this.authCodeReject = undefined
							this.authCodePromise = undefined
						}
						this.closeCallbackServer()
						return
					}

					if (!code) {
						res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
						res.end(AUTH_FAILURE_HTML)

						if (this.authCodeReject) {
							this.authCodeReject(new Error("Missing authorization code in OAuth callback"))
							this.authCodeResolve = undefined
							this.authCodeReject = undefined
							this.authCodePromise = undefined
						}
						this.closeCallbackServer()
						return
					}

					// Success — resolve the pending auth code promise
					res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
					res.end(AUTH_SUCCESS_HTML)

					if (this.authCodeResolve) {
						this.authCodeResolve(code)
						this.authCodeResolve = undefined
						this.authCodeReject = undefined
						this.authCodePromise = undefined
					}

					// Clear the code verifier after successful code reception
					await this.invalidateCredentials("verifier")

					this.closeCallbackServer()
				} catch (err) {
					res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" })
					res.end(AUTH_FAILURE_HTML)

					if (this.authCodeReject) {
						this.authCodeReject(err instanceof Error ? err : new Error(`${err}`))
						this.authCodeResolve = undefined
						this.authCodeReject = undefined
						this.authCodePromise = undefined
					}
					this.closeCallbackServer()
				}
			})

			this.callbackServer.on("error", (err: NodeJS.ErrnoException) => {
				if (this.authCodeReject) {
					this.authCodeReject(
						new Error(
							err.code === "EADDRINUSE"
								? `OAuth callback port ${port} is already in use`
								: `OAuth callback server error: ${err.message}`,
						),
					)
					this.authCodeResolve = undefined
					this.authCodeReject = undefined
					this.authCodePromise = undefined
				}
				reject(err)
			})

			this.callbackServer.listen(port, "127.0.0.1", () => {
				// Set a timeout for the callback
				this.callbackTimeout = setTimeout(() => {
					if (this.authCodeReject) {
						this.authCodeReject(new Error("OAuth authentication timed out"))
						this.authCodeResolve = undefined
						this.authCodeReject = undefined
						this.authCodePromise = undefined
					}
					this.closeCallbackServer()
				}, CALLBACK_TIMEOUT_MS)

				resolve()
			})
		})
	}

	/**
	 * Closes the localhost callback server and clears the timeout.
	 */
	private closeCallbackServer(): void {
		if (this.callbackTimeout) {
			clearTimeout(this.callbackTimeout)
			this.callbackTimeout = undefined
		}

		if (this.callbackServer) {
			try {
				this.callbackServer.close()
			} catch {
				// Ignore errors when closing
			}
			this.callbackServer = undefined
		}

		// Remove from static URI handler registry
		for (const [key, provider] of McpOAuthProvider.pendingByState) {
			if (provider === this) {
				McpOAuthProvider.pendingByState.delete(key)
			}
		}
	}

	/**
	 * Extracts the port number from the redirect URL.
	 */
	private extractPort(): number {
		try {
			const url = new URL(this._redirectUrl)
			return parseInt(url.port, 10) || 14000
		} catch {
			return 14000 + Math.floor(Math.random() * 1000)
		}
	}
}
