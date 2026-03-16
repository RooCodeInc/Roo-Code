import * as crypto from "crypto"
import * as http from "http"
import { URL } from "url"
import { exec } from "child_process"

import { saveOpenAiCodexCredentials, OpenAiCodexCredentials } from "@/lib/storage/openai-codex-credentials.js"

/**
 * OpenAI Codex OAuth Configuration
 * Matches the config in src/integrations/openai-codex/oauth.ts
 */
const OPENAI_CODEX_OAUTH_CONFIG = {
	authorizationEndpoint: "https://auth.openai.com/oauth/authorize",
	tokenEndpoint: "https://auth.openai.com/oauth/token",
	clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
	redirectUri: "http://localhost:1455/auth/callback",
	scopes: "openid profile email offline_access",
	callbackPort: 1455,
} as const

export interface OpenAiCodexLoginOptions {
	timeout?: number
	verbose?: boolean
}

export type OpenAiCodexLoginResult = { success: true; email?: string } | { success: false; error: string }

/**
 * JWT claims structure for extracting ChatGPT account ID
 */
interface IdTokenClaims {
	chatgpt_account_id?: string
	organizations?: Array<{ id: string }>
	email?: string
	"https://api.openai.com/auth"?: {
		chatgpt_account_id?: string
	}
}

function parseJwtClaims(token: string): IdTokenClaims | undefined {
	const parts = token.split(".")
	if (parts.length !== 3 || !parts[1]) return undefined
	try {
		const payload = Buffer.from(parts[1], "base64url").toString("utf-8")
		return JSON.parse(payload) as IdTokenClaims
	} catch {
		return undefined
	}
}

function extractAccountIdFromClaims(claims: IdTokenClaims): string | undefined {
	return (
		claims.chatgpt_account_id ||
		claims["https://api.openai.com/auth"]?.chatgpt_account_id ||
		claims.organizations?.[0]?.id
	)
}

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

function generateCodeVerifier(): string {
	return crypto.randomBytes(32).toString("base64url")
}

function generateCodeChallenge(verifier: string): string {
	return crypto.createHash("sha256").update(verifier).digest().toString("base64url")
}

function generateState(): string {
	return crypto.randomBytes(16).toString("hex")
}

function buildAuthorizationUrl(codeChallenge: string, state: string): string {
	const params = new URLSearchParams({
		client_id: OPENAI_CODEX_OAUTH_CONFIG.clientId,
		redirect_uri: OPENAI_CODEX_OAUTH_CONFIG.redirectUri,
		scope: OPENAI_CODEX_OAUTH_CONFIG.scopes,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		response_type: "code",
		state,
		codex_cli_simplified_flow: "true",
		originator: "roo-code",
	})
	return `${OPENAI_CODEX_OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`
}

async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OpenAiCodexCredentials> {
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		client_id: OPENAI_CODEX_OAUTH_CONFIG.clientId,
		code,
		redirect_uri: OPENAI_CODEX_OAUTH_CONFIG.redirectUri,
		code_verifier: codeVerifier,
	})

	const response = await fetch(OPENAI_CODEX_OAUTH_CONFIG.tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
		signal: AbortSignal.timeout(30000),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`)
	}

	const data = await response.json()

	if (!data.access_token || !data.refresh_token) {
		throw new Error("Token exchange did not return required tokens")
	}

	const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000
	const accountId = extractAccountId({
		id_token: data.id_token,
		access_token: data.access_token,
	})

	return {
		type: "openai-codex",
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		expires: expiresAt,
		email: data.email,
		accountId,
	}
}

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

export async function openaiCodexLogin({
	timeout = 5 * 60 * 1000,
	verbose = false,
}: OpenAiCodexLoginOptions = {}): Promise<OpenAiCodexLoginResult> {
	const codeVerifier = generateCodeVerifier()
	const codeChallenge = generateCodeChallenge(codeVerifier)
	const state = generateState()

	if (verbose) {
		console.log(`[Auth] Starting OpenAI Codex OAuth flow on port ${OPENAI_CODEX_OAUTH_CONFIG.callbackPort}`)
	}

	const credentialsPromise = new Promise<OpenAiCodexCredentials>((resolve, reject) => {
		const server = http.createServer(async (req, res) => {
			try {
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
					res.writeHead(400)
					res.end(`Authentication failed: ${error}`)
					reject(new Error(`OAuth error: ${error}`))
					server.close()
					return
				}

				if (!code || !receivedState) {
					res.writeHead(400)
					res.end("Missing code or state parameter")
					reject(new Error("Missing code or state parameter"))
					server.close()
					return
				}

				if (receivedState !== state) {
					res.writeHead(400)
					res.end("State mismatch - possible CSRF attack")
					reject(new Error("State mismatch"))
					server.close()
					return
				}

				try {
					const credentials = await exchangeCodeForTokens(code, codeVerifier)

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
  .container { text-align: center; padding: 2rem; }
  h1 { font-size: 2rem; margin-bottom: 1rem; }
  p { opacity: 0.9; }
</style>
</head>
<body>
<div class="container">
<h1>&#10003; Authentication Successful</h1>
<p>You can close this window and return to the terminal.</p>
</div>
<script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`)

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

		server.listen(OPENAI_CODEX_OAUTH_CONFIG.callbackPort, () => {
			if (verbose) {
				console.log(`[Auth] Callback server listening on port ${OPENAI_CODEX_OAUTH_CONFIG.callbackPort}`)
			}
		})

		server.on("close", () => {
			clearTimeout(timeoutId)
		})
	})

	const authUrl = buildAuthorizationUrl(codeChallenge, state)

	console.log("Opening browser for OpenAI authentication...")
	console.log(`If the browser doesn't open, visit: ${authUrl}`)

	try {
		await openBrowser(authUrl)
	} catch (error) {
		if (verbose) {
			console.warn("[Auth] Failed to open browser automatically:", error)
		}
		console.log("Please open the URL above in your browser manually.")
	}

	try {
		const credentials = await credentialsPromise
		await saveOpenAiCodexCredentials(credentials)
		const emailInfo = credentials.email ? ` (${credentials.email})` : ""
		console.log(`✓ Successfully authenticated with OpenAI${emailInfo}`)
		return { success: true, email: credentials.email }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`✗ OpenAI authentication failed: ${message}`)
		return { success: false, error: message }
	}
}
