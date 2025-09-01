import { Agent } from "http"

/**
 * Get proxy configuration from environment variables
 * Respects standard proxy environment variables: HTTP_PROXY, HTTPS_PROXY, NO_PROXY
 */
export function getProxyConfig(targetUrl: string): { httpAgent?: Agent } | undefined {
	// Dynamic import to avoid bundling issues
	let HttpsProxyAgent: any
	try {
		HttpsProxyAgent = require("https-proxy-agent").HttpsProxyAgent
	} catch (error) {
		// If the module is not available, return undefined
		console.warn("https-proxy-agent module not available, proxy support disabled")
		return undefined
	}

	// Check if the target URL should bypass proxy based on NO_PROXY
	const noProxy = process.env.NO_PROXY || process.env.no_proxy
	if (noProxy) {
		const noProxyList = noProxy.split(",").map((s) => s.trim())
		const url = new URL(targetUrl)
		const hostname = url.hostname

		for (const pattern of noProxyList) {
			// Handle wildcard patterns like *.example.com
			if (pattern.startsWith("*")) {
				const domain = pattern.slice(1)
				if (hostname.endsWith(domain)) {
					return undefined
				}
			}
			// Handle exact matches
			else if (hostname === pattern || hostname.endsWith(`.${pattern}`)) {
				return undefined
			}
		}
	}

	// Determine which proxy to use based on the protocol
	const url = new URL(targetUrl)
	const isHttps = url.protocol === "https:"

	// Check for proxy environment variables
	const proxyUrl = isHttps
		? process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
		: process.env.HTTP_PROXY || process.env.http_proxy

	if (proxyUrl) {
		try {
			// Validate the proxy URL before creating the agent
			new URL(proxyUrl)
			// Create and return the proxy agent
			const agent = new HttpsProxyAgent(proxyUrl)
			return { httpAgent: agent }
		} catch (error) {
			console.warn(`Invalid proxy URL: ${proxyUrl}`)
			return undefined
		}
	}

	return undefined
}
