/**
 * Proxy-Aware HTTP Agent Module
 *
 * Provides proxy support for SDKs that use `node-fetch` with custom agents
 * (e.g. Anthropic SDK v0.x), routing their traffic through the user's
 * configured proxy (VSCode `http.proxy` setting or standard environment
 * variables).
 *
 * Background:
 * - VSCode patches Node.js `http`/`https` modules to honour `http.proxy`, so
 *   libraries that use those modules (e.g. axios) are already proxied.
 * - The Anthropic SDK uses `node-fetch` with custom `agentkeepalive` agents,
 *   which bypass VSCode's proxy patching. For these SDKs, we provide
 *   `getProxyHttpAgent()` to create an `HttpsProxyAgent` that can be passed
 *   as the `httpAgent` option.
 */

import * as vscode from "vscode"
import type { Agent } from "node:http"
import { HttpsProxyAgent } from "https-proxy-agent"

/**
 * Resolve the effective proxy URL.
 *
 * Priority:
 *   1. VSCode `http.proxy` setting (works in both local and remote mode)
 *   2. Standard environment variables (`HTTPS_PROXY`, `HTTP_PROXY`, `https_proxy`, `http_proxy`)
 *
 * Returns `undefined` when no proxy is configured.
 */
export function resolveProxyUrl(): string | undefined {
	// 1. VSCode setting
	const httpConfig = vscode.workspace.getConfiguration("http")
	const vsCodeProxy = httpConfig.get<string>("proxy")
	if (typeof vsCodeProxy === "string" && vsCodeProxy.trim()) {
		return vsCodeProxy.trim()
	}

	// 2. Environment variables (standard precedence)
	const envProxy =
		process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
	if (envProxy && envProxy.trim()) {
		return envProxy.trim()
	}

	return undefined
}

/**
 * Check whether TLS certificate verification should be strict.
 *
 * Reads VSCode's `http.proxyStrictSSL` setting (defaults to `true`).
 */
function isStrictSSL(): boolean {
	const httpConfig = vscode.workspace.getConfiguration("http")
	return httpConfig.get<boolean>("proxyStrictSSL") ?? true
}

/**
 * Redact credentials from a proxy URL for safe logging.
 */
function redactUrl(url: string): string {
	try {
		const parsed = new URL(url)
		parsed.username = ""
		parsed.password = ""
		return parsed.toString()
	} catch {
		return url.replace(/\/\/[^@/]+@/g, "//REDACTED@")
	}
}

/**
 * Create an `HttpsProxyAgent` for SDKs that use `node-fetch` with custom
 * agents (e.g. Anthropic SDK v0.x).
 *
 * Returns `undefined` when no proxy is configured, so callers can use:
 *
 * ```ts
 * new Anthropic({ httpAgent: getProxyHttpAgent() })
 * ```
 *
 * The Anthropic SDK falls back to its default `agentkeepalive` agent when
 * `httpAgent` is `undefined`, which is the correct behaviour when no proxy
 * is needed.
 */
export function getProxyHttpAgent(): Agent | undefined {
	const proxyUrl = resolveProxyUrl()
	if (!proxyUrl) {
		return undefined
	}

	const strictSSL = isStrictSSL()

	try {
		return new HttpsProxyAgent(proxyUrl, {
			rejectUnauthorized: strictSSL,
		})
	} catch (error) {
		console.error(
			`[ProxyFetch] Failed to create HttpsProxyAgent for "${redactUrl(proxyUrl)}": ${error instanceof Error ? error.message : String(error)}`,
		)
		return undefined
	}
}
