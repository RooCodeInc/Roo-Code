import { loadOpenAiCodexCredentials, isCredentialsExpired } from "@/lib/storage/openai-codex-credentials.js"

export interface OpenAiCodexStatusOptions {
	verbose?: boolean
}

export interface OpenAiCodexStatusResult {
	authenticated: boolean
	expired?: boolean
	email?: string
	expiresAt?: Date
}

export async function openaiCodexStatus({
	verbose = false,
}: OpenAiCodexStatusOptions = {}): Promise<OpenAiCodexStatusResult> {
	const credentials = await loadOpenAiCodexCredentials()

	if (!credentials) {
		console.log("✗ Not authenticated with OpenAI Codex")
		console.log("")
		console.log("Run: roo auth login-openai")
		return { authenticated: false }
	}

	const expired = isCredentialsExpired(credentials)
	const expiresAt = new Date(credentials.expires)

	if (expired) {
		console.log("⚠ OpenAI Codex access token expired (will auto-refresh on next use)")
	} else {
		console.log("✓ Authenticated with OpenAI Codex")
	}

	if (credentials.email) {
		console.log(`  Email:        ${credentials.email}`)
	}

	const remaining = getTimeRemaining(expiresAt)
	console.log(`  Token:        ${expired ? "expired" : `expires ${formatDate(expiresAt)} (${remaining})`}`)

	if (verbose && credentials.accountId) {
		console.log(`  Account ID:   ${credentials.accountId}`)
	}

	return {
		authenticated: true,
		expired,
		email: credentials.email,
		expiresAt,
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
