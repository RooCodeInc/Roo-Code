import type { SupportedProvider } from "@/types/index.js"
import { clearToken, hasToken, getCredentialsPath } from "@/lib/storage/index.js"

import { logoutOpenAiCodex } from "./openai-codex-auth.js"

type AuthProvider = "roo" | "openai-codex"

function resolveAuthProvider(provider: SupportedProvider | undefined): AuthProvider | null {
	if (!provider || provider === "roo") {
		return "roo"
	}

	if (provider === "openai-codex") {
		return "openai-codex"
	}

	return null
}

export interface LogoutOptions {
	verbose?: boolean
	provider?: SupportedProvider
	workspace?: string
	extension?: string
	timeoutMs?: number
}

export interface LogoutResult {
	success: boolean
	wasLoggedIn: boolean
}

export async function logout(options: LogoutOptions = {}): Promise<LogoutResult> {
	const { verbose = false, provider, workspace, extension, timeoutMs } = options
	const authProvider = resolveAuthProvider(provider)

	if (!authProvider) {
		console.error(`[CLI] Unsupported auth provider: ${provider}. Use roo or openai-codex.`)
		return { success: false, wasLoggedIn: false }
	}

	if (authProvider === "openai-codex") {
		const result = await logoutOpenAiCodex({
			workspace,
			extension,
			debug: verbose,
			timeoutMs,
		})

		if (!result.success) {
			console.error(`✗ Failed to sign out from OpenAI Codex: ${result.reason ?? "Unknown error"}`)
			return { success: false, wasLoggedIn: result.wasAuthenticated }
		}

		if (!result.wasAuthenticated) {
			console.log("You are not currently signed in to OpenAI Codex.")
			return { success: true, wasLoggedIn: false }
		}

		console.log("✓ Successfully signed out from OpenAI Codex")
		return { success: true, wasLoggedIn: true }
	}

	const wasLoggedIn = await hasToken()

	if (!wasLoggedIn) {
		console.log("You are not currently logged in.")
		return { success: true, wasLoggedIn: false }
	}

	if (verbose) {
		console.log(`[Auth] Removing credentials from ${getCredentialsPath()}`)
	}

	await clearToken()
	console.log("✓ Successfully logged out")
	return { success: true, wasLoggedIn: true }
}
