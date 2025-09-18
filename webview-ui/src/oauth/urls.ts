import { Package } from "@roo/package"
import { HUGGING_FACE_OAUTH_CLIENT_ID } from "../../../src/shared/oauth-constants"

export function getCallbackUrl(provider: string, uriScheme?: string) {
	return encodeURIComponent(`${uriScheme || "vscode"}://${Package.publisher}.${Package.name}/${provider}`)
}

export function getGlamaAuthUrl(uriScheme?: string) {
	return `https://glama.ai/oauth/authorize?callback_url=${getCallbackUrl("glama", uriScheme)}`
}

export function getOpenRouterAuthUrl(uriScheme?: string) {
	return `https://openrouter.ai/auth?callback_url=${getCallbackUrl("openrouter", uriScheme)}`
}

export function getRequestyAuthUrl(uriScheme?: string) {
	return `https://app.requesty.ai/oauth/authorize?callback_url=${getCallbackUrl("requesty", uriScheme)}`
}

export function getHuggingFaceAuthUrl(uriScheme?: string, codeChallenge?: string, state?: string) {
	const callback = getCallbackUrl("huggingface", uriScheme)
	const scope = encodeURIComponent("openid profile inference-api")

	let url = `https://huggingface.co/oauth/authorize?client_id=${HUGGING_FACE_OAUTH_CLIENT_ID}&redirect_uri=${callback}&response_type=code&scope=${scope}`

	// Add PKCE parameters if provided
	if (codeChallenge) {
		url += `&code_challenge=${codeChallenge}&code_challenge_method=S256`
	}

	if (state) {
		url += `&state=${encodeURIComponent(state)}`
	}

	return url
}
