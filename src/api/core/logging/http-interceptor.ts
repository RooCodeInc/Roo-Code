/**
 * @fileoverview HTTP request interceptor for logging raw API requests
 *
 * This module provides a custom fetch function that logs the full raw request
 * including URL, headers, and body before sending it to the API.
 */

import { isLoggingEnabled } from "./env-config"

/**
 * Sanitize headers by removing sensitive data like API keys
 */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
	const sensitiveKeys = ["authorization", "x-api-key", "api-key", "openai-api-key", "anthropic-api-key"]

	const sanitized: Record<string, string> = {}
	for (const [key, value] of Object.entries(headers)) {
		const lowerKey = key.toLowerCase()
		if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
			// Mask the value, showing only first/last few chars
			if (value.length > 8) {
				sanitized[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
			} else {
				sanitized[key] = "****"
			}
		} else {
			sanitized[key] = value
		}
	}
	return sanitized
}

/**
 * Parse body as JSON if possible, otherwise return as-is.
 * Only processes string and URLSearchParams bodies; returns a placeholder
 * for binary types (Blob, ArrayBuffer, FormData) to avoid misleading output.
 */
function parseBodyIfJson(body: BodyInit | null | undefined): unknown {
	if (body === null || body === undefined) {
		return undefined
	}

	// Handle string bodies directly
	if (typeof body === "string") {
		try {
			return JSON.parse(body)
		} catch {
			return body
		}
	}

	// URLSearchParams can be safely converted to string
	if (body instanceof URLSearchParams) {
		return body.toString()
	}

	// For binary types, return a placeholder to avoid misleading output
	if (body instanceof Blob) {
		return `[Blob: ${body.size} bytes, type: ${body.type || "unknown"}]`
	}

	if (body instanceof ArrayBuffer) {
		return `[ArrayBuffer: ${body.byteLength} bytes]`
	}

	if (typeof FormData !== "undefined" && body instanceof FormData) {
		return "[FormData]"
	}

	if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
		return "[ReadableStream]"
	}

	// For any other type (e.g., BufferSource), return a generic placeholder
	return "[non-string body]"
}

/**
 * Extract headers from a Headers object to a plain object
 */
function headersToObject(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {}
	headers.forEach((value, key) => {
		result[key] = value
	})
	return result
}

/**
 * Creates a fetch wrapper that logs raw HTTP requests and responses
 *
 * @param providerName - Name of the provider for logging context
 * @param baseFetch - Optional base fetch implementation to wrap (defaults to current global fetch)
 * @returns A fetch function that logs requests and responses
 */

export function createLoggingFetch(providerName: string, baseFetch: typeof fetch = globalThis.fetch): typeof fetch {
	return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const loggingEnabled = isLoggingEnabled()
		const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
		const method = init?.method || "GET"

		if (loggingEnabled) {
			// Extract request headers
			let headers: Record<string, string> = {}
			if (init?.headers) {
				if (init.headers instanceof Headers) {
					init.headers.forEach((value, key) => {
						headers[key] = value
					})
				} else if (Array.isArray(init.headers)) {
					for (const [key, value] of init.headers) {
						headers[key] = value
					}
				} else {
					headers = init.headers as Record<string, string>
				}
			}

			// Log the raw request as objects for native expandability in dev tools
			console.log(`[${providerName}] RAW HTTP REQUEST`, {
				method,
				url,
				headers: sanitizeHeaders(headers),
				body: init?.body === undefined || init.body === null ? undefined : parseBodyIfJson(init.body),
			})
		}

		// Execute the actual fetch (avoid recursion if globalThis.fetch has been replaced)
		const response = await baseFetch(input, init)

		if (loggingEnabled) {
			const contentType = response.headers.get("content-type") || ""
			const isStreaming = contentType.includes("text/event-stream") || contentType.includes("stream")

			// Log response info
			const responseLog: {
				status: number
				statusText: string
				headers: Record<string, string>
				body?: unknown
				streaming?: boolean
			} = {
				status: response.status,
				statusText: response.statusText,
				headers: sanitizeHeaders(headersToObject(response.headers)),
			}

			if (isStreaming) {
				responseLog.streaming = true
				console.log(`[${providerName}] RAW HTTP RESPONSE`, responseLog)
			} else {
				// For non-streaming responses, clone and read the body
				try {
					const cloned = response.clone()
					const bodyText = await cloned.text()
					responseLog.body = parseBodyIfJson(bodyText)
				} catch {
					responseLog.body = "[unable to read body]"
				}
				console.log(`[${providerName}] RAW HTTP RESPONSE`, responseLog)
			}
		}

		return response
	}
}

const scopedFetchStack: Array<typeof fetch> = []

/**
 * Temporarily replaces globalThis.fetch with a logging fetch for the duration of the callback.
 *
 * Intended for SDKs that call global fetch internally and do not support injecting a custom fetch.
 *
 * Requirements:
 * - Always restore in finally
 * - Support nesting
 * - No-op when logging disabled
 * - Preserve typeof fetch
 */
export async function withScopedFetchLogging<T>(providerName: string, callback: () => Promise<T>): Promise<T> {
	if (!isLoggingEnabled()) {
		return callback()
	}

	const previousFetch = globalThis.fetch
	scopedFetchStack.push(previousFetch)
	globalThis.fetch = createLoggingFetch(providerName, previousFetch)

	try {
		return await callback()
	} finally {
		const restoreFetch = scopedFetchStack.pop()
		globalThis.fetch = restoreFetch ?? previousFetch
	}
}

/**
 * Export a default logging fetch for convenience
 */
export const loggingFetch = createLoggingFetch("API")
