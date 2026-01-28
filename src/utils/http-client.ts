import * as vscode from "vscode"
import * as fs from "node:fs"
import * as http from "node:http"
import * as https from "node:https"

import { NodeHttpHandler } from "@smithy/node-http-handler"
import { ProxyAgent } from "proxy-agent"

type RooHttpClientConfig = {
	/**
	 * Proxy URL to use for outbound HTTP(S) requests.
	 * If not provided, environment variables (HTTPS_PROXY/HTTP_PROXY/ALL_PROXY) may still apply.
	 */
	proxyUrl?: string
	/**
	 * Comma-separated list of hostnames that should bypass the proxy.
	 * Merged from VS Code `http.noProxy` and `NO_PROXY`.
	 */
	noProxy?: string
	/**
	 * When false, disables TLS certificate verification for this client's requests only.
	 * Defaults to VS Code `http.proxyStrictSSL` (true by default).
	 */
	strictSSL: boolean
	/**
	 * Additional CA certificate bundle(s), loaded from `NODE_EXTRA_CA_CERTS` and/or `AWS_CA_BUNDLE`.
	 */
	ca?: string[]
}

type RooAxiosAgentConfig = {
	// axios uses these node agents for transport; setting `proxy: false` ensures the agent is used.
	proxy: false
	httpAgent: http.Agent
	httpsAgent: https.Agent
}

let cachedConfig: RooHttpClientConfig | undefined
let cachedProxyAgent: ProxyAgent | undefined
let cachedDirectHttpAgent: http.Agent | undefined
let cachedDirectHttpsAgent: https.Agent | undefined
const cachedNodeHttpHandlers = new Map<number | "default", NodeHttpHandler>()

function getEnv(name: string): string | undefined {
	const v = process.env[name] ?? process.env[name.toLowerCase()]
	return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined
}

function mergeNoProxy(envNoProxy?: string, vsCodeNoProxy?: string): string | undefined {
	// Default bypasses for local connections.
	const merged = ["localhost,127.0.0.1,::1", envNoProxy, vsCodeNoProxy]
		.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
		.join(",")
		.trim()
	return merged.length > 0 ? merged : undefined
}

function loadCaBundleFromPath(filePath: string): string | undefined {
	try {
		return fs.readFileSync(filePath, "utf8")
	} catch {
		// If an admin configures a CA path but it isn't readable (or doesn't exist),
		// we fall back to default Node CA behavior rather than crashing.
		return undefined
	}
}

function getVsCodeHttpSettings(): { proxyUrl?: string; noProxy?: string; strictSSL: boolean } {
	const config = vscode.workspace.getConfiguration("http")

	// VS Code settings:
	// - http.proxy: string | undefined
	// - http.proxyStrictSSL: boolean (defaults to true)
	// - http.noProxy: string | undefined
	const proxyUrl = config.get<string>("proxy")
	const noProxy = config.get<string>("noProxy")
	const strictSSL = config.get<boolean>("proxyStrictSSL", true)

	return {
		proxyUrl: typeof proxyUrl === "string" && proxyUrl.trim().length > 0 ? proxyUrl.trim() : undefined,
		noProxy: typeof noProxy === "string" && noProxy.trim().length > 0 ? noProxy.trim() : undefined,
		strictSSL,
	}
}

function resolveProxyUrl(vsCodeProxyUrl?: string): string | undefined {
	// Prefer explicit environment variables when set, otherwise fall back to VS Code settings.
	return (
		getEnv("HTTPS_PROXY") ??
		getEnv("HTTP_PROXY") ??
		getEnv("ALL_PROXY") ??
		(vsCodeProxyUrl && vsCodeProxyUrl.trim().length > 0 ? vsCodeProxyUrl.trim() : undefined)
	)
}

function parseNoProxyList(noProxy?: string): string[] {
	if (!noProxy) return []
	return noProxy
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
}

function shouldBypassProxy(url: URL, noProxyList: string[]): boolean {
	if (noProxyList.length === 0) return false
	if (noProxyList.includes("*")) return true

	const host = url.hostname
	const port = url.port
	const hostWithPort = port ? `${host}:${port}` : host

	for (const entry of noProxyList) {
		// Exact host or host:port match
		if (entry === host || entry === hostWithPort) return true

		// Domain suffix match:
		// - ".example.com" matches "foo.example.com" and "example.com"
		// - "example.com" matches "example.com" and "foo.example.com"
		const normalized = entry.startsWith(".") ? entry.slice(1) : entry
		if (host === normalized || host.endsWith(`.${normalized}`)) return true
	}

	return false
}

function getProxyForUrlFactory(proxyUrl?: string, noProxy?: string) {
	const noProxyList = parseNoProxyList(noProxy)
	return async (urlString: string): Promise<string> => {
		// `proxy-agent` expects a string; return empty string to disable proxying for this URL.
		if (!proxyUrl) return ""
		if (!URL.canParse(urlString)) return proxyUrl
		const url = new URL(urlString)
		return shouldBypassProxy(url, noProxyList) ? "" : proxyUrl
	}
}

/**
 * Centralized HTTP config for the extension runtime.
 *
 * Sources (in priority order where applicable):
 * - Proxy URL: env (HTTPS_PROXY/HTTP_PROXY/ALL_PROXY) → VS Code `http.proxy`
 * - No proxy: env (NO_PROXY) + VS Code `http.noProxy`
 * - TLS strictness: VS Code `http.proxyStrictSSL` (defaults to true)
 * - Custom CA bundles: `NODE_EXTRA_CA_CERTS`, `AWS_CA_BUNDLE`
 */
export function getRooHttpClientConfig(): RooHttpClientConfig {
	if (cachedConfig) return cachedConfig

	const vsCode = getVsCodeHttpSettings()
	const proxyUrl = resolveProxyUrl(vsCode.proxyUrl)
	const noProxy = mergeNoProxy(getEnv("NO_PROXY"), vsCode.noProxy)

	const caPaths = [getEnv("NODE_EXTRA_CA_CERTS"), getEnv("AWS_CA_BUNDLE")].filter(
		(p): p is string => typeof p === "string" && p.length > 0,
	)
	const ca = caPaths.map(loadCaBundleFromPath).filter((c): c is string => typeof c === "string" && c.length > 0)

	cachedConfig = {
		proxyUrl,
		noProxy,
		strictSSL: vsCode.strictSSL,
		ca: ca.length > 0 ? ca : undefined,
	}

	return cachedConfig
}

/**
 * Returns a Node agent configuration suitable for axios requests.
 * Note: `proxy: false` is intentional; we route proxying through the agent.
 */
export function getRooAxiosAgentConfig(): RooAxiosAgentConfig {
	const cfg = getRooHttpClientConfig()

	const tlsOptions: https.AgentOptions = {
		keepAlive: true,
		rejectUnauthorized: cfg.strictSSL,
		...(cfg.ca ? { ca: cfg.ca } : {}),
	}

	if (cfg.proxyUrl) {
		if (!cachedProxyAgent) {
			cachedProxyAgent = new ProxyAgent({
				...tlsOptions,
				getProxyForUrl: getProxyForUrlFactory(cfg.proxyUrl, cfg.noProxy),
			})
		}

		// ProxyAgent can act as both httpAgent and httpsAgent.
		return { proxy: false, httpAgent: cachedProxyAgent as unknown as http.Agent, httpsAgent: cachedProxyAgent }
	}

	if (!cachedDirectHttpAgent) {
		cachedDirectHttpAgent = new http.Agent({ keepAlive: true })
	}
	if (!cachedDirectHttpsAgent) {
		cachedDirectHttpsAgent = new https.Agent(tlsOptions)
	}

	return { proxy: false, httpAgent: cachedDirectHttpAgent, httpsAgent: cachedDirectHttpsAgent }
}

/**
 * Creates a Smithy `NodeHttpHandler` configured with the same proxy + CA settings
 * used across the extension. Prefer reusing this for AWS SDK v3 clients and
 * credential providers (via `clientConfig`).
 */
export function getRooNodeHttpHandler(options?: { requestTimeout?: number }): NodeHttpHandler {
	const key = typeof options?.requestTimeout === "number" ? options.requestTimeout : "default"
	const cached = cachedNodeHttpHandlers.get(key)
	if (cached) return cached

	const { httpAgent, httpsAgent } = getRooAxiosAgentConfig()

	const handler = new NodeHttpHandler({
		httpAgent,
		httpsAgent,
		...(typeof options?.requestTimeout === "number" ? { requestTimeout: options.requestTimeout } : {}),
	})

	cachedNodeHttpHandlers.set(key, handler)
	return handler
}
