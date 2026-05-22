import { Agent, fetch as undiciFetch } from "undici"

import { getApiRequestTimeout } from "./timeout-config"

/**
 * Default Undici headersTimeout is 300 seconds (5 minutes), which can cause
 * premature HeadersTimeoutError for slow providers (e.g. local models via
 * LM Studio, Ollama) even when the SDK-level timeout is set higher.
 *
 * This utility creates a custom `fetch` function backed by an Undici `Agent`
 * whose `headersTimeout` and `bodyTimeout` are aligned with the user's
 * configured `apiRequestTimeout`. This ensures the transport layer won't
 * abort the connection before the SDK-level timeout fires.
 *
 * @see https://github.com/RooCodeInc/Roo-Code/issues/12244
 */

/**
 * Builds a `fetch` function that uses an Undici Agent with headersTimeout
 * and bodyTimeout set to match the configured API request timeout.
 *
 * The returned function has the same signature as the global `fetch` and
 * can be passed directly to the OpenAI SDK's `fetch` constructor option.
 */
export function createFetchWithUndiciTimeout(): typeof globalThis.fetch {
	const timeoutMs = getApiRequestTimeout()

	// When timeout is undefined (user disabled it), use 0 which means
	// "no timeout" in Undici.
	const agentTimeout = timeoutMs ?? 0

	const agent = new Agent({
		headersTimeout: agentTimeout,
		bodyTimeout: agentTimeout,
	})

	// Return a fetch wrapper that injects the custom dispatcher.
	// The OpenAI SDK expects the standard fetch signature.
	return ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		return undiciFetch(
			input as any,
			{
				...init,
				dispatcher: agent,
			} as any,
		) as unknown as Promise<Response>
	}) as typeof globalThis.fetch
}
