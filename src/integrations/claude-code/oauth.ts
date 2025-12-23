import * as crypto from "crypto"
import * as http from "http"
import { URL } from "url"
import type { ExtensionContext } from "vscode"
import { z } from "zod"
import { RefreshTimer } from "@roo-code/cloud"

// OAuth Configuration
export const CLAUDE_CODE_OAUTH_CONFIG = {
	authorizationEndpoint: "https://claude.ai/oauth/authorize",
	tokenEndpoint: "https://console.anthropic.com/v1/oauth/token",
	clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
	redirectUri: "http://localhost:54545/callback",
	scopes: "org:create_api_key user:profile user:inference",
	callbackPort: 54545,
} as const

// Token storage key
const CLAUDE_CODE_CREDENTIALS_KEY = "claude-code-oauth-credentials"

// Credentials schema
const claudeCodeCredentialsSchema = z.object({
	type: z.literal("claude"),
	access_token: z.string().min(1),
	refresh_token: z.string().min(1),
	expired: z.string(), // RFC3339 datetime
	email: z.string().optional(),
})

export type ClaudeCodeCredentials = z.infer<typeof claudeCodeCredentialsSchema>

// Token response schema from Anthropic
const tokenResponseSchema = z.object({
	access_token: z.string(),
	refresh_token: z.string(),
	expires_in: z.number(),
	email: z.string().optional(),
	token_type: z.string().optional(),
})

/**
 * Generates a cryptographically random PKCE code verifier
 * Must be 43-128 characters long using unreserved characters
 */
export function generateCodeVerifier(): string {
	// Generate 32 random bytes and encode as base64url (will be 43 characters)
	const buffer = crypto.randomBytes(32)
	return buffer.toString("base64url")
}

/**
 * Generates the PKCE code challenge from the verifier using S256 method
 */
export function generateCodeChallenge(verifier: string): string {
	const hash = crypto.createHash("sha256").update(verifier).digest()
	return hash.toString("base64url")
}

/**
 * Generates a random state parameter for CSRF protection
 */
export function generateState(): string {
	return crypto.randomBytes(16).toString("hex")
}

/**
 * Generates a user_id in the format required by Claude Code API
 * Format: user_<hash>_account_<uuid>_session_<uuid>
 */
export function generateUserId(email?: string): string {
	// Generate user hash from email or random bytes
	const userHash = email
		? crypto.createHash("sha256").update(email).digest("hex").slice(0, 16)
		: crypto.randomBytes(8).toString("hex")

	// Generate account UUID (persistent per email or random)
	const accountUuid = email
		? crypto.createHash("sha256").update(`account:${email}`).digest("hex").slice(0, 32)
		: crypto.randomUUID().replace(/-/g, "")

	// Generate session UUID (always random for each request)
	const sessionUuid = crypto.randomUUID().replace(/-/g, "")

	return `user_${userHash}_account_${accountUuid}_session_${sessionUuid}`
}

/**
 * Builds the authorization URL for OAuth flow
 */
export function buildAuthorizationUrl(codeChallenge: string, state: string): string {
	const params = new URLSearchParams({
		client_id: CLAUDE_CODE_OAUTH_CONFIG.clientId,
		redirect_uri: CLAUDE_CODE_OAUTH_CONFIG.redirectUri,
		scope: CLAUDE_CODE_OAUTH_CONFIG.scopes,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		response_type: "code",
		state,
	})

	return `${CLAUDE_CODE_OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`
}

/**
 * Exchanges the authorization code for tokens
 */
export async function exchangeCodeForTokens(
	code: string,
	codeVerifier: string,
	state: string,
): Promise<ClaudeCodeCredentials> {
	const body = {
		code,
		state,
		grant_type: "authorization_code",
		client_id: CLAUDE_CODE_OAUTH_CONFIG.clientId,
		redirect_uri: CLAUDE_CODE_OAUTH_CONFIG.redirectUri,
		code_verifier: codeVerifier,
	}

	const response = await fetch(CLAUDE_CODE_OAUTH_CONFIG.tokenEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(30000),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`)
	}

	const data = await response.json()
	const tokenResponse = tokenResponseSchema.parse(data)

	// Calculate expiry time
	const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

	return {
		type: "claude",
		access_token: tokenResponse.access_token,
		refresh_token: tokenResponse.refresh_token,
		expired: expiresAt.toISOString(),
		email: tokenResponse.email,
	}
}

/**
 * Refreshes the access token using the refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<ClaudeCodeCredentials> {
	const body = {
		grant_type: "refresh_token",
		client_id: CLAUDE_CODE_OAUTH_CONFIG.clientId,
		refresh_token: refreshToken,
	}

	const response = await fetch(CLAUDE_CODE_OAUTH_CONFIG.tokenEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(30000),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`)
	}

	const data = await response.json()
	const tokenResponse = tokenResponseSchema.parse(data)

	// Calculate expiry time
	const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

	return {
		type: "claude",
		access_token: tokenResponse.access_token,
		refresh_token: tokenResponse.refresh_token,
		expired: expiresAt.toISOString(),
		email: tokenResponse.email,
	}
}

/**
 * Checks if the credentials are expired (with 5 minute buffer)
 */
export function isTokenExpired(credentials: ClaudeCodeCredentials): boolean {
	const expiryTime = new Date(credentials.expired).getTime()
	const bufferMs = 5 * 60 * 1000 // 5 minutes buffer
	return Date.now() >= expiryTime - bufferMs
}

/**
 * ClaudeCodeOAuthManager - Handles OAuth flow and token management
 */
export class ClaudeCodeOAuthManager {
	private context: ExtensionContext | null = null
	private credentials: ClaudeCodeCredentials | null = null
	private pendingAuth: {
		codeVerifier: string
		state: string
		server?: http.Server
	} | null = null
	private refreshTimer: RefreshTimer | null = null
	private refreshAttempts: number = 0
	private maxRefreshAttempts: number = 3

	/**
	 * Initialize the OAuth manager with VS Code extension context
	 */
	async initialize(context: ExtensionContext): Promise<void> {
		this.context = context

		// Load existing credentials and start refresh timer if authenticated
		await this.loadCredentials()
		if (this.credentials) {
			this.startRefreshTimer()
		}
	}

	/**
	 * Load credentials from storage
	 */
	async loadCredentials(): Promise<ClaudeCodeCredentials | null> {
		if (!this.context) {
			return null
		}

		try {
			const credentialsJson = await this.context.secrets.get(CLAUDE_CODE_CREDENTIALS_KEY)
			if (!credentialsJson) {
				return null
			}

			const parsed = JSON.parse(credentialsJson)
			this.credentials = claudeCodeCredentialsSchema.parse(parsed)
			return this.credentials
		} catch (error) {
			console.error("[claude-code-oauth] Failed to load credentials:", error)
			return null
		}
	}

	/**
	 * Save credentials to storage
	 */
	async saveCredentials(credentials: ClaudeCodeCredentials): Promise<void> {
		if (!this.context) {
			throw new Error("OAuth manager not initialized")
		}

		await this.context.secrets.store(CLAUDE_CODE_CREDENTIALS_KEY, JSON.stringify(credentials))
		this.credentials = credentials

		// Reset refresh attempts on successful save
		this.refreshAttempts = 0

		// Start refresh timer if not already running
		if (!this.refreshTimer) {
			this.startRefreshTimer()
		}
	}

	/**
	 * Clear credentials from storage
	 */
	async clearCredentials(): Promise<void> {
		if (!this.context) {
			return
		}

		await this.context.secrets.delete(CLAUDE_CODE_CREDENTIALS_KEY)
		this.credentials = null
		this.stopRefreshTimer()
		this.refreshAttempts = 0
	}

	/**
	 * Get a valid access token, refreshing if necessary
	 */
	async getAccessToken(): Promise<string | null> {
		// Try to load credentials if not already loaded
		if (!this.credentials) {
			await this.loadCredentials()
		}

		if (!this.credentials) {
			return null
		}

		// Check if token is expired and refresh if needed
		if (isTokenExpired(this.credentials)) {
			try {
				const newCredentials = await refreshAccessToken(this.credentials.refresh_token)
				await this.saveCredentials(newCredentials)
				console.log("[claude-code-oauth] Token refreshed successfully")
			} catch (error) {
				console.error("[claude-code-oauth] Failed to refresh token:", error)

				// Increment refresh attempts
				this.refreshAttempts++

				// Only clear credentials after max attempts to allow retry
				if (this.refreshAttempts >= this.maxRefreshAttempts) {
					console.error(
						`[claude-code-oauth] Max refresh attempts (${this.maxRefreshAttempts}) reached, clearing credentials`,
					)
					await this.clearCredentials()
					await this.notifyReauthRequired()
					return null
				}

				// Don't return null immediately - let the old token be tried
				// It might still work for some grace period
			}
		}

		return this.credentials.access_token
	}

	/**
	 * Get the user's email from credentials
	 */
	async getEmail(): Promise<string | null> {
		if (!this.credentials) {
			await this.loadCredentials()
		}
		return this.credentials?.email || null
	}

	/**
	 * Check if the user is authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		const token = await this.getAccessToken()
		return token !== null
	}

	/**
	 * Start the OAuth authorization flow
	 * Returns the authorization URL to open in browser
	 */
	startAuthorizationFlow(): string {
		// Cancel any existing authorization flow before starting a new one
		this.cancelAuthorizationFlow()

		const codeVerifier = generateCodeVerifier()
		const codeChallenge = generateCodeChallenge(codeVerifier)
		const state = generateState()

		this.pendingAuth = {
			codeVerifier,
			state,
		}

		return buildAuthorizationUrl(codeChallenge, state)
	}

	/**
	 * Start a local server to receive the OAuth callback
	 * Returns a promise that resolves when authentication is complete
	 */
	async waitForCallback(): Promise<ClaudeCodeCredentials> {
		if (!this.pendingAuth) {
			throw new Error("No pending authorization flow")
		}

		// Close any existing server before starting a new one
		if (this.pendingAuth.server) {
			try {
				this.pendingAuth.server.close()
			} catch {
				// Ignore errors when closing
			}
			this.pendingAuth.server = undefined
		}

		return new Promise((resolve, reject) => {
			const server = http.createServer(async (req, res) => {
				try {
					const url = new URL(req.url || "", `http://localhost:${CLAUDE_CODE_OAUTH_CONFIG.callbackPort}`)

					if (url.pathname !== "/callback") {
						res.writeHead(404)
						res.end("Not Found")
						return
					}

					const code = url.searchParams.get("code")
					const state = url.searchParams.get("state")
					const error = url.searchParams.get("error")

					if (error) {
						res.writeHead(400)
						res.end(`Authentication failed: ${error}`)
						reject(new Error(`OAuth error: ${error}`))
						server.close()
						return
					}

					if (!code || !state) {
						res.writeHead(400)
						res.end("Missing code or state parameter")
						reject(new Error("Missing code or state parameter"))
						server.close()
						return
					}

					if (state !== this.pendingAuth?.state) {
						res.writeHead(400)
						res.end("State mismatch - possible CSRF attack")
						reject(new Error("State mismatch"))
						server.close()
						return
					}

					try {
						const credentials = await exchangeCodeForTokens(code, this.pendingAuth.codeVerifier, state)

						await this.saveCredentials(credentials)

						res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
						res.end(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Authentication Successful</title>
</head>
<body style="font-family: system-ui; text-align: center; padding: 50px;">
<h1>&#10003; Authentication Successful</h1>
<p>You can close this window and return to VS Code.</p>
<script>window.close();</script>
</body>
</html>`)

						this.pendingAuth = null
						server.close()
						resolve(credentials)
					} catch (exchangeError) {
						res.writeHead(500)
						res.end(`Token exchange failed: ${exchangeError}`)
						reject(exchangeError)
						server.close()
					}
				} catch (err) {
					res.writeHead(500)
					res.end("Internal server error")
					reject(err)
					server.close()
				}
			})

			server.on("error", (err: NodeJS.ErrnoException) => {
				this.pendingAuth = null
				if (err.code === "EADDRINUSE") {
					reject(
						new Error(
							`Port ${CLAUDE_CODE_OAUTH_CONFIG.callbackPort} is already in use. ` +
								`Please close any other applications using this port and try again.`,
						),
					)
				} else {
					reject(err)
				}
			})

			// Set a timeout for the callback
			const timeout = setTimeout(
				() => {
					server.close()
					reject(new Error("Authentication timed out"))
				},
				5 * 60 * 1000,
			) // 5 minutes

			server.listen(CLAUDE_CODE_OAUTH_CONFIG.callbackPort, () => {
				if (this.pendingAuth) {
					this.pendingAuth.server = server
				}
			})

			// Clear timeout when server closes
			server.on("close", () => {
				clearTimeout(timeout)
			})
		})
	}

	/**
	 * Cancel any pending authorization flow
	 */
	cancelAuthorizationFlow(): void {
		if (this.pendingAuth?.server) {
			this.pendingAuth.server.close()
		}
		this.pendingAuth = null
	}

	/**
	 * Get the current credentials (for display purposes)
	 */
	getCredentials(): ClaudeCodeCredentials | null {
		return this.credentials
	}

	/**
	 * Start the background token refresh timer
	 * Refreshes tokens proactively before they expire
	 */
	private startRefreshTimer(): void {
		// Don't start if already running
		if (this.refreshTimer) {
			return
		}

		this.refreshTimer = new RefreshTimer({
			callback: async () => {
				try {
					await this.performBackgroundRefresh()
					return true // Success
				} catch (error) {
					console.error("[claude-code-oauth] Background refresh failed:", error)
					return false // Failure - will trigger backoff
				}
			},
			// Refresh every 50 minutes (tokens typically last 1 hour, we refresh with 10min buffer)
			successInterval: 50 * 60 * 1000,
			initialBackoffMs: 1000,
			maxBackoffMs: 5 * 60 * 1000, // Max 5 minutes backoff
		})

		this.refreshTimer.start()
		console.log("[claude-code-oauth] Started background token refresh timer")
	}

	/**
	 * Stop the background token refresh timer
	 */
	private stopRefreshTimer(): void {
		if (this.refreshTimer) {
			this.refreshTimer.stop()
			this.refreshTimer = null
			console.log("[claude-code-oauth] Stopped background token refresh timer")
		}
	}

	/**
	 * Perform a background token refresh
	 */
	private async performBackgroundRefresh(): Promise<void> {
		if (!this.credentials) {
			throw new Error("No credentials available for refresh")
		}

		// Only refresh if token is close to expiring (within 10 minutes)
		const expiryTime = new Date(this.credentials.expired).getTime()
		const timeUntilExpiry = expiryTime - Date.now()
		const tenMinutes = 10 * 60 * 1000

		if (timeUntilExpiry > tenMinutes) {
			// Token is still fresh, no need to refresh yet
			console.log(
				`[claude-code-oauth] Token still valid for ${Math.round(timeUntilExpiry / 60000)} minutes, skipping refresh`,
			)
			return
		}

		console.log("[claude-code-oauth] Performing background token refresh...")

		try {
			const newCredentials = await refreshAccessToken(this.credentials.refresh_token)
			await this.saveCredentials(newCredentials)
			console.log("[claude-code-oauth] Background token refresh successful")
		} catch (error) {
			this.refreshAttempts++

			if (this.refreshAttempts >= this.maxRefreshAttempts) {
				console.error(
					`[claude-code-oauth] Max refresh attempts (${this.maxRefreshAttempts}) reached in background refresh`,
				)
				await this.clearCredentials()
				await this.notifyReauthRequired()
				throw new Error("Failed to refresh token after multiple attempts")
			}

			throw error
		}
	}

	/**
	 * Notify the user that re-authentication is required
	 */
	private async notifyReauthRequired(): Promise<void> {
		try {
			const vscode = await import("vscode")
			const action = await vscode.window.showWarningMessage(
				"Your Claude.ai authentication has expired. Please sign in again to continue using Claude models.",
				"Sign In",
				"Later",
			)

			if (action === "Sign In") {
				// Trigger the sign-in flow through the webview message handler
				// This will be handled by the UI layer
				console.log("[claude-code-oauth] User requested re-authentication")
			}
		} catch (error) {
			console.error("[claude-code-oauth] Failed to show re-auth notification:", error)
		}
	}

	/**
	 * Dispose of resources (call this when extension deactivates)
	 */
	dispose(): void {
		this.stopRefreshTimer()
		this.cancelAuthorizationFlow()
	}
}

// Singleton instance
export const claudeCodeOAuthManager = new ClaudeCodeOAuthManager()
