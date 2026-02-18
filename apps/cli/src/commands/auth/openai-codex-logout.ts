import { logoutOpenAiCodex } from "@/lib/auth/openai-codex-oauth.js"

export async function openaiCodexLogout(): Promise<void> {
	await logoutOpenAiCodex()
	console.log("✓ Successfully logged out of OpenAI Codex")
}
