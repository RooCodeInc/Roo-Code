import { clearOpenAiCodexCredentials, hasOpenAiCodexCredentials } from "@/lib/storage/openai-codex-credentials.js"

export interface OpenAiCodexLogoutOptions {
	verbose?: boolean
}

export interface OpenAiCodexLogoutResult {
	success: boolean
	wasLoggedIn: boolean
}

export async function openaiCodexLogout({
	verbose = false,
}: OpenAiCodexLogoutOptions = {}): Promise<OpenAiCodexLogoutResult> {
	const wasLoggedIn = await hasOpenAiCodexCredentials()

	if (!wasLoggedIn) {
		console.log("You are not currently logged in to OpenAI Codex.")
		return { success: true, wasLoggedIn: false }
	}

	if (verbose) {
		console.log("[Auth] Removing OpenAI Codex OAuth credentials")
	}

	await clearOpenAiCodexCredentials()
	console.log("✓ Successfully logged out from OpenAI Codex")
	return { success: true, wasLoggedIn: true }
}
