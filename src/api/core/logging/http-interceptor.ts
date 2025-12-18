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
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
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
 * Parse body as JSON if possible, otherwise return as-is
 */
function parseBodyIfJson(body: BodyInit | string): unknown {
	try {
		const bodyStr = typeof body === "string" ? body : body.toString()
		return JSON.parse(bodyStr)
	} catch {
		return body
	}
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
 * @returns A fetch function that logs requests and responses
 */
export function createLoggingFetch(providerName: string): typeof fetch {
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
				body: init?.body ? parseBodyIfJson(init.body) : undefined,
			})
		}

		// Execute the actual fetch
		const response = await fetch(input, init)

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

/**
 * Export a default logging fetch for convenience
 */
export const loggingFetch = createLoggingFetch("API")
