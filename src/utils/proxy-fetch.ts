import * as http from "node:http"
import * as https from "node:https"
import { URL } from "node:url"

/**
 * Gets the HTTP(S) agent configured with proxy settings if needed
 * This checks environment variables for proxy configuration
 */
export function getProxyAgent(): { httpAgent?: http.Agent; httpsAgent?: https.Agent } {
	const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
	const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
	const noProxy = process.env.NO_PROXY || process.env.no_proxy

	const agents: { httpAgent?: http.Agent; httpsAgent?: https.Agent } = {}

	// Configure HTTP agent with proxy if needed
	if (httpProxy) {
		try {
			const HttpsProxyAgent = require("https-proxy-agent").HttpsProxyAgent
			agents.httpAgent = new HttpsProxyAgent(httpProxy)
		} catch (error) {
			// If https-proxy-agent is not available, we'll try another approach
			console.warn("https-proxy-agent not available, proxy support may be limited")
		}
	}

	// Configure HTTPS agent with proxy if needed
	if (httpsProxy) {
		try {
			const HttpsProxyAgent = require("https-proxy-agent").HttpsProxyAgent
			agents.httpsAgent = new HttpsProxyAgent(httpsProxy)
		} catch (error) {
			// If https-proxy-agent is not available, we'll try another approach
			console.warn("https-proxy-agent not available, proxy support may be limited")
		}
	}

	return agents
}

/**
 * Creates a custom fetch that respects proxy settings
 * Falls back to axios if native fetch fails with proxy
 */
export function createProxyAwareFetch(): typeof fetch {
	const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
	const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy

	// If no proxy is configured, return the native fetch
	if (!httpProxy && !httpsProxy) {
		return fetch
	}

	// Create a custom fetch that falls back to axios for proxy support
	return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url

		try {
			// First try native fetch
			return await fetch(input, init)
		} catch (fetchError) {
			// If fetch fails and we have proxy settings, try axios as fallback
			console.warn("Native fetch failed, attempting with axios for proxy support:", (fetchError as Error).message)

			try {
				const axios = require("axios")

				// Convert RequestInit to axios config
				const axiosConfig: any = {
					url,
					method: init?.method || "GET",
					headers: init?.headers || {},
					data: init?.body,
					responseType: "arraybuffer",
					// Let axios handle proxy from environment variables
					proxy: false, // Disable axios default proxy to use env vars
				}

				// Configure proxy if needed
				if (httpProxy || httpsProxy) {
					const isHttps = url.toLowerCase().startsWith("https://")
					const proxyUrl = isHttps ? httpsProxy || httpProxy : httpProxy

					if (proxyUrl) {
						const proxyUrlObj = new URL(proxyUrl)
						axiosConfig.proxy = {
							protocol: proxyUrlObj.protocol.replace(":", ""),
							host: proxyUrlObj.hostname,
							port: parseInt(proxyUrlObj.port) || (proxyUrlObj.protocol === "https:" ? 443 : 80),
							auth: proxyUrlObj.username
								? {
										username: proxyUrlObj.username,
										password: proxyUrlObj.password,
									}
								: undefined,
						}
					}
				}

				const response = await axios(axiosConfig)

				// Convert axios response to fetch Response
				return new Response(response.data, {
					status: response.status,
					statusText: response.statusText,
					headers: new Headers(response.headers as HeadersInit),
				})
			} catch (axiosError) {
				// If axios also fails, throw the original fetch error
				console.error("Both fetch and axios failed:", axiosError)
				throw fetchError
			}
		}
	}
}

/**
 * Sets up global fetch to use proxy-aware implementation
 * This should be called before creating API clients that use fetch
 */
export function setupGlobalProxyFetch(): void {
	const proxyFetch = createProxyAwareFetch()

	// Only override if we have a custom implementation
	if (proxyFetch !== fetch) {
		;(globalThis as any).fetch = proxyFetch
	}
}

/**
 * Restores the original fetch implementation
 */
export function restoreOriginalFetch(): void {
	// Store original fetch if not already stored
	if (!(globalThis as any).__originalFetch && globalThis.fetch) {
		;(globalThis as any).__originalFetch = globalThis.fetch
	}

	// Restore original fetch
	if ((globalThis as any).__originalFetch) {
		;(globalThis as any).fetch = (globalThis as any).__originalFetch
	}
}
