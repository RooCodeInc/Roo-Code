import type { SupportedProvider } from "@/types/index.js"
import { loadToken, loadCredentials, getCredentialsPath } from "@/lib/storage/index.js"
import { isTokenExpired, isTokenValid, getTokenExpirationDate } from "@/lib/auth/index.js"

import { statusOpenAiCodex } from "./openai-codex-auth.js"

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

export interface StatusOptions {
	verbose?: boolean
	provider?: SupportedProvider
	workspace?: string
	extension?: string
}

export interface StatusResult {
	authenticated: boolean
	expired?: boolean
	expiringSoon?: boolean
	userId?: string
	orgId?: string | null
	expiresAt?: Date
	createdAt?: Date
}

export async function status(options: StatusOptions = {}): Promise<StatusResult> {
	const { verbose = false, provider, workspace, extension } = options
	const authProvider = resolveAuthProvider(provider)

	if (!authProvider) {
		console.error(`[CLI] Unsupported auth provider: ${provider}. Use roo or openai-codex.`)
		return { authenticated: false }
	}

	if (authProvider === "openai-codex") {
		const codexStatus = await statusOpenAiCodex({
			workspace,
			extension,
			debug: verbose,
		})

		if (codexStatus.authenticated) {
			console.log("✓ Authenticated with OpenAI Codex")
			return { authenticated: true }
		}

		console.log("✗ Not authenticated with OpenAI Codex")
		console.log("")
		console.log("Run: roo auth login --provider openai-codex")
		if (codexStatus.reason && verbose) {
			console.log(`Reason: ${codexStatus.reason}`)
		}
		return { authenticated: false }
	}

	const token = await loadToken()

	if (!token) {
		console.log("✗ Not authenticated")
		console.log("")
		console.log("Run: roo auth login")
		return { authenticated: false }
	}

	const expiresAt = getTokenExpirationDate(token)
	const expired = !isTokenValid(token)
	const expiringSoon = isTokenExpired(token, 24 * 60 * 60) && !expired

	const credentials = await loadCredentials()
	const createdAt = credentials?.createdAt ? new Date(credentials.createdAt) : undefined

	if (expired) {
		console.log("✗ Authentication token expired")
		console.log("")
		console.log("Run: roo auth login")

		return {
			authenticated: false,
			expired: true,
			expiresAt: expiresAt ?? undefined,
		}
	}

	if (expiringSoon) {
		console.log("⚠ Expires soon; refresh with `roo auth login`")
	} else {
		console.log("✓ Authenticated")
	}

	if (expiresAt) {
		const remaining = getTimeRemaining(expiresAt)
		console.log(`  Expires:      ${formatDate(expiresAt)} (${remaining})`)
	}

	if (createdAt && verbose) {
		console.log(`  Created:      ${formatDate(createdAt)}`)
	}

	if (verbose) {
		console.log(`  Credentials:  ${getCredentialsPath()}`)
	}

	return {
		authenticated: true,
		expired: false,
		expiringSoon,
		expiresAt: expiresAt ?? undefined,
		createdAt,
	}
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function getTimeRemaining(date: Date): string {
	const now = new Date()
	const diff = date.getTime() - now.getTime()

	if (diff <= 0) {
		return "expired"
	}

	const days = Math.floor(diff / (1000 * 60 * 60 * 24))
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

	if (days > 0) {
		return `${days} day${days === 1 ? "" : "s"}`
	}

	return `${hours} hour${hours === 1 ? "" : "s"}`
}
