import { isAuthenticatedOpenAiCodex } from "@/lib/auth/openai-codex-oauth.js"
import { loadOpenAiCodexCredentials } from "@/lib/storage/openai-codex-credentials.js"

export async function openaiCodexStatus(): Promise<void> {
	const authenticated = await isAuthenticatedOpenAiCodex()

	if (authenticated) {
		const credentials = await loadOpenAiCodexCredentials()
		console.log("✓ Authenticated with OpenAI Codex")
		if (credentials?.email) {
			console.log(`  Email: ${credentials.email}`)
		}
	} else {
		console.log("✗ Not authenticated with OpenAI Codex")
		console.log("  Run 'roo-code auth openai-codex:login' to authenticate")
	}
}
