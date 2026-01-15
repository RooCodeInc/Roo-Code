import {
	loginOpenAiCodex,
	type OpenAiCodexLoginOptions,
	type OpenAiCodexLoginResult,
} from "@/lib/auth/openai-codex-oauth.js"

export async function openaiCodexLogin(options: OpenAiCodexLoginOptions = {}): Promise<OpenAiCodexLoginResult> {
	return loginOpenAiCodex(options)
}
