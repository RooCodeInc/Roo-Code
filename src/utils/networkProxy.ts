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
	/** Whether to reject unauthorized TLS certificates */
	rejectUnauthorized: boolean
	/** Whether running in debug/development mode */
	isDebugMode: boolean
}

let extensionContext: vscode.ExtensionContext | null = null
let proxyInitialized = false
let undiciProxyInitialized = false
let fetchPatched = false
let outputChannel: vscode.OutputChannel | null = null

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
	log(
		`Proxy config: proxyUrl=${config.proxyUrl || "(not set)"}, isDebugMode=${config.isDebugMode}, rejectUnauthorized=${config.rejectUnauthorized}`,
	)

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

					// Debug mode: apply TLS bypass regardless; apply proxy if configured.
					disableTlsVerification()
					if (newConfig.proxyUrl) {
						configureGlobalProxy(newConfig)
						configureUndiciProxy(newConfig)
					} else {
						// Proxy removed - but we can't easily un-bootstrap global-agent or reset undici dispatcher safely.
						// User will need to restart the extension host.
						log("Proxy URL removed. Restart VS Code to fully disable proxy.")
					}
				}
			}),
		)
	} else {
		log("vscode.workspace.onDidChangeConfiguration is not available; skipping config change listener")
	}

	// Security policy:
	// - Debug (F5): allow MITM inspection by disabling TLS verification; optionally route through proxy if configured.
	// - Normal runs: do NOT disable TLS verification, and do NOT route through proxy even if configured.
	if (!config.isDebugMode) {
		if (config.proxyUrl) {
			log(`Proxy URL is set but will be ignored because extension is not running in debug mode`)
		}
		log(`Not in debug mode - proxy disabled and TLS verification enforced`)
		return
	}

	// Debug mode: always disable TLS verification (MITM-friendly).
	disableTlsVerification()

	if (config.proxyUrl) {
		configureGlobalProxy(config)
		configureUndiciProxy(config)
	} else {
		log(`No proxy URL configured (debug mode). TLS verification disabled only.`)
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
			rejectUnauthorized: true,
			isDebugMode: false,
		}
	}

	const config = vscode.workspace.getConfiguration(Package.name)
	const rawProxyUrl = config.get<unknown>("proxyUrl")
	const proxyUrl = typeof rawProxyUrl === "string" ? rawProxyUrl : undefined

	// In debug/development mode, disable TLS verification for MITM proxy inspection
	const isDebugMode = extensionContext.extensionMode === vscode.ExtensionMode.Development

	return {
		proxyUrl: proxyUrl?.trim() || undefined,
		rejectUnauthorized: !isDebugMode,
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
	log(`Setting proxy environment variables before bootstrap...`)
	updateProxyEnvVars(config)

	log(`Environment after setup:`)
	log(`  GLOBAL_AGENT_HTTP_PROXY=${process.env.GLOBAL_AGENT_HTTP_PROXY}`)
	log(`  GLOBAL_AGENT_HTTPS_PROXY=${process.env.GLOBAL_AGENT_HTTPS_PROXY}`)
	log(`  NODE_TLS_REJECT_UNAUTHORIZED=${process.env.NODE_TLS_REJECT_UNAUTHORIZED}`)

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

	log(
		`Network proxy configured: ${config.proxyUrl} (TLS verification: ${config.rejectUnauthorized ? "enabled" : "disabled"})`,
	)
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
			// Debug mode uses rejectUnauthorized=false to allow MITM inspection.
			requestTls: { rejectUnauthorized: config.rejectUnauthorized },
			proxyTls: { rejectUnauthorized: config.rejectUnauthorized },
		})

		setGlobalDispatcher(proxyAgent)
		undiciProxyInitialized = true
		log(`undici global dispatcher configured for proxy: ${config.proxyUrl}`)

		// Node's built-in `fetch()` (Node 18+) is powered by an internal undici copy.
		// Setting a dispatcher on our `undici` dependency does NOT affect that internal fetch.
		// To ensure Roo Code's `fetch()` calls are proxied, patch global fetch in debug mode.
		if (!fetchPatched) {
			globalThis.fetch = undiciFetch as unknown as typeof fetch
			fetchPatched = true
			log(`globalThis.fetch patched to undici.fetch (debug proxy mode)`)
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

	// TLS bypass is controlled separately and ONLY in debug mode.
}

/**
 * Disable TLS verification without setting up a proxy.
 * Used in debug mode when no proxy is configured but user might add one later.
 */
function disableTlsVerification(): void {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
	log("TLS certificate verification disabled (debug mode)")
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
