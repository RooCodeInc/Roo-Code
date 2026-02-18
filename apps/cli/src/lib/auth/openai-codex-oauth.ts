import * as crypto from "crypto"
import * as http from "http"
import { URL } from "url"
import { exec } from "child_process"

import type { OpenAiCodexCredentials } from "../storage/openai-codex-credentials.js"
import {
	saveOpenAiCodexCredentials,
	loadOpenAiCodexCredentials,
	clearOpenAiCodexCredentials,
} from "../storage/openai-codex-credentials.js"

/**
 * OpenAI Codex OAuth Configuration
 * Based on the OpenAI Codex OAuth implementation
 */
export const OPENAI_CODEX_OAUTH_CONFIG = {
	authorizationEndpoint: "https://auth.openai.com/oauth/authorize",
	tokenEndpoint: "https://auth.openai.com/oauth/token",
	clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
	redirectUri: "http://localhost:1455/auth/callback",
	scopes: "openid profile email offline_access",
	callbackPort: 1455,
} as const

interface TokenResponse {
	access_token: string
	refresh_token?: string
	id_token?: string
	expires_in: number
	email?: string
	token_type?: string
}

interface IdTokenClaims {
	chatgpt_account_id?: string
	organizations?: Array<{ id: string }>
	email?: string
	"https://api.openai.com/auth"?: {
		chatgpt_account_id?: string
	}
}

/**
 * Parse JWT claims from a token
 */
function parseJwtClaims(token: string): IdTokenClaims | undefined {
	const parts = token.split(".")
	if (parts.length !== 3 || !parts[1]) return undefined
	try {
		// Base64url decode: convert base64url to base64, then decode
		const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
		const payload = Buffer.from(base64, "base64").toString("utf-8")
		return JSON.parse(payload) as IdTokenClaims
	} catch {
		return undefined
	}
}

/**
 * Extract ChatGPT account ID from JWT claims
 */
function extractAccountIdFromClaims(claims: IdTokenClaims): string | undefined {
	return (
		claims.chatgpt_account_id ||
		claims["https://api.openai.com/auth"]?.chatgpt_account_id ||
		claims.organizations?.[0]?.id
	)
}

/**
 * Extract ChatGPT account ID from token response
 */
function extractAccountId(tokens: { id_token?: string; access_token: string }): string | undefined {
	if (tokens.id_token) {
		const claims = parseJwtClaims(tokens.id_token)
		const accountId = claims && extractAccountIdFromClaims(claims)
		if (accountId) return accountId
	}
	if (tokens.access_token) {
		const claims = parseJwtClaims(tokens.access_token)
		return claims ? extractAccountIdFromClaims(claims) : undefined
	}
	return undefined
}

/**
 * Generates a cryptographically random PKCE code verifier
 */
export function generateCodeVerifier(): string {
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
 * Builds the authorization URL for OpenAI Codex OAuth flow
 */
export function buildAuthorizationUrl(codeChallenge: string, state: string): string {
	const params = new URLSearchParams({
		client_id: OPENAI_CODEX_OAUTH_CONFIG.clientId,
		redirect_uri: OPENAI_CODEX_OAUTH_CONFIG.redirectUri,
		scope: OPENAI_CODEX_OAUTH_CONFIG.scopes,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		response_type: "code",
		state,
		// Codex-specific parameters
		codex_cli_simplified_flow: "true",
		originator: "roo-code",
	})

	return `${OPENAI_CODEX_OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`
}

/**
 * Exchanges the authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OpenAiCodexCredentials> {
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		client_id: OPENAI_CODEX_OAUTH_CONFIG.clientId,
		code,
		redirect_uri: OPENAI_CODEX_OAUTH_CONFIG.redirectUri,
		code_verifier: codeVerifier,
	})

	const response = await fetch(OPENAI_CODEX_OAUTH_CONFIG.tokenEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
		signal: AbortSignal.timeout(30000),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`)
	}

	const data = await response.json()
	const tokenResponse = data as TokenResponse

	if (!tokenResponse.access_token || !tokenResponse.refresh_token || !tokenResponse.expires_in) {
		throw new Error("Invalid token response: missing required fields")
	}

	const expiresAt = Date.now() + tokenResponse.expires_in * 1000
	const accountId = extractAccountId({
		id_token: tokenResponse.id_token,
		access_token: tokenResponse.access_token,
	})

	return {
		type: "openai-codex",
		access_token: tokenResponse.access_token,
		refresh_token: tokenResponse.refresh_token,
		expires: expiresAt,
		email: tokenResponse.email,
		accountId,
	}
}

/**
 * Refreshes the access token using the refresh token
 */
export async function refreshAccessToken(credentials: OpenAiCodexCredentials): Promise<OpenAiCodexCredentials> {
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		client_id: OPENAI_CODEX_OAUTH_CONFIG.clientId,
		refresh_token: credentials.refresh_token,
	})

	const response = await fetch(OPENAI_CODEX_OAUTH_CONFIG.tokenEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
		signal: AbortSignal.timeout(30000),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`)
	}

	const data = await response.json()
	const tokenResponse = data as TokenResponse

	const expiresAt = Date.now() + tokenResponse.expires_in * 1000
	const newAccountId = extractAccountId({
		id_token: tokenResponse.id_token,
		access_token: tokenResponse.access_token,
	})

	return {
		type: "openai-codex",
		access_token: tokenResponse.access_token,
		refresh_token: tokenResponse.refresh_token ?? credentials.refresh_token,
		expires: expiresAt,
		email: tokenResponse.email ?? credentials.email,
		accountId: newAccountId ?? credentials.accountId,
	}
}

/**
 * Checks if the credentials are expired (with 5 minute buffer)
 */
export function isTokenExpired(credentials: OpenAiCodexCredentials): boolean {
	const bufferMs = 5 * 60 * 1000 // 5 minutes buffer
	return Date.now() >= credentials.expires - bufferMs
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getAccessToken(): Promise<string | null> {
	let credentials = await loadOpenAiCodexCredentials()

	if (!credentials) {
		return null
	}

	// Refresh if expired
	if (isTokenExpired(credentials)) {
		try {
			credentials = await refreshAccessToken(credentials)
			await saveOpenAiCodexCredentials(credentials)
		} catch (error) {
			console.error("Failed to refresh OpenAI Codex token:", error)
			// Clear invalid credentials
			await clearOpenAiCodexCredentials()
			return null
		}
	}

	return credentials.access_token
}

/**
 * Open browser for authentication
 */
function openBrowser(url: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const platform = process.platform
		let command: string

		switch (platform) {
			case "darwin":
				command = `open "${url}"`
				break
			case "win32":
				command = `start "" "${url}"`
				break
			default:
				command = `xdg-open "${url}"`
				break
		}

		exec(command, (error) => {
			if (error) {
				reject(error)
			} else {
				resolve()
			}
		})
	})
}

export interface OpenAiCodexLoginOptions {
	timeout?: number
	verbose?: boolean
}

export interface OpenAiCodexLoginResult {
	success: boolean
	error?: string
	email?: string
}

/**
 * Perform OpenAI Codex OAuth login flow
 */
export async function loginOpenAiCodex({
	timeout = 5 * 60 * 1000,
	verbose = false,
}: OpenAiCodexLoginOptions = {}): Promise<OpenAiCodexLoginResult> {
	const codeVerifier = generateCodeVerifier()
	const codeChallenge = generateCodeChallenge(codeVerifier)
	const state = generateState()

	if (verbose) {
		console.log(
			`[OpenAI Codex Auth] Starting local callback server on port ${OPENAI_CODEX_OAUTH_CONFIG.callbackPort}`,
		)
	}

	const credentialsPromise = new Promise<OpenAiCodexCredentials>((resolve, reject) => {
		const server = http.createServer(async (req, res) => {
			const url = new URL(req.url || "", `http://localhost:${OPENAI_CODEX_OAUTH_CONFIG.callbackPort}`)

			if (url.pathname !== "/auth/callback") {
				res.writeHead(404)
				res.end("Not Found")
				return
			}

			const code = url.searchParams.get("code")
			const receivedState = url.searchParams.get("state")
			const error = url.searchParams.get("error")

			if (error) {
				res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
				res.end(`<!DOCTYPE html>
<html>
<head><title>Authentication Failed</title></head>
<body>
<h1>Authentication failed: ${error}</h1>
<p>You can close this window and return to the CLI.</p>
</body>
</html>`)
				res.on("close", () => {
					server.close()
					reject(new Error(`OAuth error: ${error}`))
				})
				return
			}

			if (!code || !receivedState) {
				res.writeHead(400)
				res.end("Missing code or state parameter")
				res.on("close", () => {
					server.close()
					reject(new Error("Missing code or state parameter"))
				})
				return
			}

			if (receivedState !== state) {
				res.writeHead(400)
				res.end("State mismatch - possible CSRF attack")
				res.on("close", () => {
					server.close()
					reject(new Error("State mismatch"))
				})
				return
			}

			try {
				const credentials = await exchangeCodeForTokens(code, codeVerifier)
				await saveOpenAiCodexCredentials(credentials)

				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
				res.end(`<!DOCTYPE html>
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
  .container {
    text-align: center;
    padding: 2rem;
  }
  h1 { font-size: 2rem; margin-bottom: 1rem; }
  p { opacity: 0.9; }
</style>
</head>
<body>
<div class="container">
<h1>&#10003; Authentication Successful</h1>
<p>You can close this window and return to the CLI.</p>
</div>
<script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`)

				res.on("close", () => {
					server.close()
					resolve(credentials)
				})
			} catch (exchangeError) {
				res.writeHead(500)
				res.end(`Token exchange failed: ${exchangeError}`)
				res.on("close", () => {
					server.close()
					reject(exchangeError)
				})
			}
		})

		server.on("error", (err: NodeJS.ErrnoException) => {
			if (err.code === "EADDRINUSE") {
				reject(
					new Error(
						`Port ${OPENAI_CODEX_OAUTH_CONFIG.callbackPort} is already in use. ` +
							`Please close any other applications using this port and try again.`,
					),
				)
			} else {
				reject(err)
			}
		})

		const timeoutId = setTimeout(() => {
			server.close()
			reject(new Error("Authentication timed out"))
		}, timeout)

		server.listen(OPENAI_CODEX_OAUTH_CONFIG.callbackPort, "127.0.0.1", () => {
			if (verbose) {
				console.log(
					`[OpenAI Codex Auth] Callback server listening on port ${OPENAI_CODEX_OAUTH_CONFIG.callbackPort}`,
				)
			}
		})

		server.on("close", () => {
			clearTimeout(timeoutId)
			if (verbose) {
				console.log("[OpenAI Codex Auth] Callback server closed")
			}
		})
	})

	const authUrl = buildAuthorizationUrl(codeChallenge, state)

	console.log("Opening browser for OpenAI Codex authentication...")
	console.log(`If the browser doesn't open, visit: ${authUrl}`)

	try {
		await openBrowser(authUrl)
	} catch (error) {
		if (verbose) {
			console.warn("[OpenAI Codex Auth] Failed to open browser automatically:", error)
		}
		console.log("Please open the URL above in your browser manually.")
	}

	try {
		const credentials = await credentialsPromise
		console.log("✓ Successfully authenticated with OpenAI Codex!")
		if (credentials.email) {
			console.log(`  Email: ${credentials.email}`)
		}
		return { success: true, email: credentials.email }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`✗ OpenAI Codex authentication failed: ${message}`)
		return { success: false, error: message }
	}
}

/**
 * Logout from OpenAI Codex (clear credentials)
 */
export async function logoutOpenAiCodex(): Promise<void> {
	await clearOpenAiCodexCredentials()
}

/**
 * Check if authenticated with OpenAI Codex
 */
export async function isAuthenticatedOpenAiCodex(): Promise<boolean> {
	const credentials = await loadOpenAiCodexCredentials()
	return credentials !== null
}
