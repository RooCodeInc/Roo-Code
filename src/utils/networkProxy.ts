/**
 * Network Proxy Configuration Module
 *
 * Provides proxy configuration for all outbound HTTP/HTTPS requests from the Roo Code extension.
 * When running in debug mode (F5), TLS certificate verification is bypassed to allow
 * MITM proxy inspection. Normal runs enforce full TLS verification.
 *
 * Uses global-agent to globally route all HTTP/HTTPS traffic through the proxy,
 * which works with axios, fetch, and most SDKs that use native Node.js http/https.
 */

import * as vscode from "vscode"
import { bootstrap } from "global-agent"
import { ProxyAgent, setGlobalDispatcher, fetch as undiciFetch } from "undici"
import { Package } from "../shared/package"

/**
 * Proxy configuration state
 */
export interface ProxyConfig {
	/** The proxy URL (e.g., http://localhost:8080) */
	proxyUrl: string | undefined
	/** Whether running in debug/development mode */
	isDebugMode: boolean
}

let extensionContext: vscode.ExtensionContext | null = null
let proxyInitialized = false
let undiciProxyInitialized = false
let fetchPatched = false
let originalFetch: typeof fetch | undefined
let outputChannel: vscode.OutputChannel | null = null

function redactProxyUrl(proxyUrl: string | undefined): string {
	if (!proxyUrl) {
		return "(not set)"
	}

	try {
		const url = new URL(proxyUrl)
		url.username = ""
		url.password = ""
		return url.toString()
	} catch {
		// Fallback for invalid URLs: redact basic auth if present.
		return proxyUrl.replace(/\/\/[^@/]+@/g, "//REDACTED@")
	}
}

function restoreGlobalFetchPatch(): void {
	if (!fetchPatched) {
		return
	}

	if (originalFetch) {
		globalThis.fetch = originalFetch
	}

	fetchPatched = false
	originalFetch = undefined
}

/**
 * Initialize the network proxy module with the extension context.
 * Must be called early in extension activation before any network requests.
 *
 * @param context The VS Code extension context
 * @param channel Optional output channel for logging
 */
export function initializeNetworkProxy(context: vscode.ExtensionContext, channel?: vscode.OutputChannel): void {
	extensionContext = context
	outputChannel = channel ?? null

	log(`Initializing network proxy module...`)
	log(
		`Extension mode: ${context.extensionMode} (Development=${vscode.ExtensionMode.Development}, Production=${vscode.ExtensionMode.Production}, Test=${vscode.ExtensionMode.Test})`,
	)

	const config = getProxyConfig()
	log(`Proxy config: proxyUrl=${redactProxyUrl(config.proxyUrl)}, isDebugMode=${config.isDebugMode}`)

	// Listen for configuration changes (always register; but only applies proxy in debug mode)
	// In unit tests, vscode.workspace.onDidChangeConfiguration may not be mocked.
	const onDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration
	if (typeof onDidChangeConfiguration === "function") {
		context.subscriptions.push(
			onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration(`${Package.name}.proxyUrl`)) {
					const newConfig = getProxyConfig()
					if (!newConfig.isDebugMode) {
						log(
							`Proxy setting changed, but proxy is only applied in debug mode. Restart VS Code after changing debug mode.`,
						)
						return
					}

					// Debug mode: apply proxy if configured.
					if (newConfig.proxyUrl) {
						configureGlobalProxy(newConfig)
						configureUndiciProxy(newConfig)
					} else {
						// Proxy removed - but we can't easily un-bootstrap global-agent or reset undici dispatcher safely.
						// We *can* restore any global fetch patch immediately.
						restoreGlobalFetchPatch()
						log("Proxy URL removed. Restart VS Code to fully disable proxy routing.")
					}
				}
			}),
		)
	} else {
		log("vscode.workspace.onDidChangeConfiguration is not available; skipping config change listener")
	}

	// Security policy:
	// - Debug (F5): route traffic through proxy if configured.
	// - Normal runs: do NOT route through proxy even if configured.
	if (!config.isDebugMode) {
		if (config.proxyUrl) {
			log(`Proxy URL is set but will be ignored because extension is not running in debug mode`)
		}
		log(`Not in debug mode - proxy disabled`)
		return
	}

	if (config.proxyUrl) {
		configureGlobalProxy(config)
		configureUndiciProxy(config)
	} else {
		log(`No proxy URL configured (debug mode).`)
	}

	// (configuration listener registered above)
}

/**
 * Get the current proxy configuration based on VS Code settings and extension mode.
 */
export function getProxyConfig(): ProxyConfig {
	if (!extensionContext) {
		// Fallback if called before initialization
		return {
			proxyUrl: undefined,
			isDebugMode: false,
		}
	}

	const config = vscode.workspace.getConfiguration(Package.name)
	const rawProxyUrl = config.get<unknown>("proxyUrl")
	const proxyUrl = typeof rawProxyUrl === "string" ? rawProxyUrl : undefined

	// Debug mode only.
	const isDebugMode = extensionContext.extensionMode === vscode.ExtensionMode.Development

	return {
		proxyUrl: proxyUrl?.trim() || undefined,
		isDebugMode,
	}
}

/**
 * Configure global-agent to route all HTTP/HTTPS traffic through the proxy.
 */
function configureGlobalProxy(config: ProxyConfig): void {
	if (proxyInitialized) {
		// global-agent can only be bootstrapped once
		// Update environment variables for any new connections
		log(`Proxy already initialized, updating env vars only`)
		updateProxyEnvVars(config)
		return
	}

	// Set up environment variables before bootstrapping
	log(`Setting proxy environment variables before bootstrap (values redacted)...`)
	updateProxyEnvVars(config)

	// Bootstrap global-agent to intercept all HTTP/HTTPS requests
	log(`Calling global-agent bootstrap()...`)
	try {
		bootstrap()
		proxyInitialized = true
		log(`global-agent bootstrap() completed successfully`)
	} catch (error) {
		log(`global-agent bootstrap() FAILED: ${error instanceof Error ? error.message : String(error)}`)
		return
	}

	log(`Network proxy configured: ${redactProxyUrl(config.proxyUrl)}`)
}

/**
 * Configure undici's global dispatcher so Node's built-in `fetch()` and any undici-based
 * clients route through the proxy.
 */
function configureUndiciProxy(config: ProxyConfig): void {
	if (!config.proxyUrl) {
		return
	}

	if (undiciProxyInitialized) {
		log(`undici global dispatcher already configured; restart VS Code to change proxy safely`)
		return
	}

	try {
		const proxyAgent = new ProxyAgent({
			uri: config.proxyUrl,
		})

		setGlobalDispatcher(proxyAgent)
		undiciProxyInitialized = true
		log(`undici global dispatcher configured for proxy: ${redactProxyUrl(config.proxyUrl)}`)

		// Node's built-in `fetch()` (Node 18+) is powered by an internal undici copy.
		// Setting a dispatcher on our `undici` dependency does NOT affect that internal fetch.
		// To ensure Roo Code's `fetch()` calls are proxied, patch global fetch in debug mode.
		// This patch is scoped to the extension lifecycle (restored on deactivate) and can be restored
		// immediately if the proxyUrl is removed.
		if (!fetchPatched) {
			if (typeof globalThis.fetch === "function") {
				originalFetch = globalThis.fetch
			}

			globalThis.fetch = undiciFetch as unknown as typeof fetch
			fetchPatched = true
			log(`globalThis.fetch patched to undici.fetch (debug proxy mode)`)

			if (extensionContext) {
				extensionContext.subscriptions.push({
					dispose: () => restoreGlobalFetchPatch(),
				})
			}
		}
	} catch (error) {
		log(`Failed to configure undici proxy dispatcher: ${error instanceof Error ? error.message : String(error)}`)
	}
}
/**
 * Update environment variables for proxy configuration.
 * global-agent reads from GLOBAL_AGENT_* environment variables.
 */
function updateProxyEnvVars(config: ProxyConfig): void {
	if (config.proxyUrl) {
		// global-agent uses these environment variables
		process.env.GLOBAL_AGENT_HTTP_PROXY = config.proxyUrl
		process.env.GLOBAL_AGENT_HTTPS_PROXY = config.proxyUrl
		process.env.GLOBAL_AGENT_NO_PROXY = "" // Proxy all requests
	}
}

/**
 * Check if a proxy is currently configured and active.
 */
export function isProxyEnabled(): boolean {
	const config = getProxyConfig()
	// Active proxy is only applied in debug mode.
	return Boolean(config.proxyUrl) && config.isDebugMode
}

/**
 * Check if we're running in debug mode.
 */
export function isDebugMode(): boolean {
	if (!extensionContext) {
		return false
	}
	return extensionContext.extensionMode === vscode.ExtensionMode.Development
}

/**
 * Log a message to the output channel if available.
 */
function log(message: string): void {
	const logMessage = `[NetworkProxy] ${message}`
	if (outputChannel) {
		outputChannel.appendLine(logMessage)
	}
	console.log(logMessage)
}
