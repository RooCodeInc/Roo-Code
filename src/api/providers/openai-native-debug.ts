/**
 * @fileoverview Comprehensive debugging utilities for OpenAI Native provider API calls.
 *
 * This module provides detailed logging capabilities specifically designed for debugging
 * API calls with custom base URLs (Azure OpenAI, custom proxies, etc.).
 *
 * Features:
 * - Request ID generation and timestamp formatting
 * - Sensitive data masking (API keys)
 * - URL construction/transformation logging
 * - Full request lifecycle logging (headers, body, method, timeout)
 * - Response lifecycle logging (status, headers, body, timing)
 * - Error-specific debugging (connection, SSL, DNS, timeout, malformed responses)
 * - Debug mode via OPENAI_DEBUG environment variable
 *
 * @example
 * // Enable debug mode via environment variable:
 * // OPENAI_DEBUG=true
 *
 * // Or programmatically:
 * import { OpenAINativeDebugger } from './openai-native-debug';
 * const debugger = new OpenAINativeDebugger({ enabled: true });
 */

import { randomUUID } from "crypto"

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Log levels for debug output
 */
export type DebugLogLevel = "debug" | "info" | "warn" | "error"

/**
 * Configuration options for the debugger
 */
export interface OpenAINativeDebugConfig {
	/** Enable or disable debug logging */
	enabled?: boolean
	/** Log level filter (defaults to 'debug' which logs everything) */
	logLevel?: DebugLogLevel
	/** Custom log output function (defaults to console.log) */
	logOutput?: (message: string) => void
	/** Whether to include request body in logs (may contain sensitive data) */
	includeRequestBody?: boolean
	/** Whether to include response body in logs (may be verbose) */
	includeResponseBody?: boolean
	/** Maximum length for body content in logs (truncates if exceeded) */
	maxBodyLength?: number
	/** Whether to mask sensitive headers completely (true) or partially (false) */
	fullMask?: boolean
}

/**
 * Request metadata for debugging
 */
export interface DebugRequestInfo {
	requestId: string
	method: string
	url: string
	baseUrl?: string
	resolvedUrl?: string
	headers: Record<string, string>
	body?: unknown
	timeout?: number
	timestamp: string
	isAzure: boolean
	urlTransformations?: UrlTransformation[]
	proxyConfig?: ProxyConfig
}

/**
 * Response metadata for debugging
 */
export interface DebugResponseInfo {
	requestId: string
	status: number
	statusText: string
	headers: Record<string, string>
	body?: unknown
	timestamp: string
	durationMs: number
	/** OpenAI-specific headers */
	openaiOrganization?: string
	openaiProcessingMs?: number
	openaiVersion?: string
	xRequestId?: string
	/** Rate limiting headers */
	rateLimitInfo?: RateLimitInfo
}

/**
 * Rate limit information from headers
 */
export interface RateLimitInfo {
	limitRequests?: number
	limitTokens?: number
	remainingRequests?: number
	remainingTokens?: number
	resetRequests?: string
	resetTokens?: string
}

/**
 * URL transformation step for debugging
 */
export interface UrlTransformation {
	step: string
	before: string
	after: string
	reason?: string
}

/**
 * Proxy configuration details
 */
export interface ProxyConfig {
	enabled: boolean
	host?: string
	port?: number
	protocol?: string
}

/**
 * Error categories for debugging
 */
export type ErrorCategory =
	| "connection"
	| "ssl_tls"
	| "dns"
	| "timeout"
	| "malformed_response"
	| "auth"
	| "rate_limit"
	| "server_error"
	| "unknown"

/**
 * Enhanced error information for debugging
 */
export interface DebugErrorInfo {
	requestId: string
	category: ErrorCategory
	code?: string
	message: string
	timestamp: string
	durationMs?: number
	originalError?: Error
	/** Additional context for the error */
	context?: Record<string, unknown>
	/** Suggestions for fixing the error */
	suggestions?: string[]
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Headers that should be masked in logs
 */
const SENSITIVE_HEADERS = new Set([
	"authorization",
	"api-key",
	"x-api-key",
	"openai-api-key",
	"azure-api-key",
	"cookie",
	"set-cookie",
	"x-client-secret",
])

/**
 * Log level hierarchy for filtering
 */
const LOG_LEVEL_ORDER: Record<DebugLogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
}

/**
 * Default maximum body length in logs
 */
const DEFAULT_MAX_BODY_LENGTH = 10000

// ============================================================================
// OpenAINativeDebugger Class
// ============================================================================

/**
 * Comprehensive debugger for OpenAI Native provider API calls.
 *
 * @example
 * ```typescript
 * const debugger = new OpenAINativeDebugger({ enabled: true });
 *
 * // Log a request
 * const requestId = debugger.generateRequestId();
 * debugger.logRequest({
 *   requestId,
 *   method: 'POST',
 *   url: 'https://api.openai.com/v1/responses',
 *   headers: { 'Authorization': 'Bearer sk-xxx' },
 *   body: { model: 'gpt-4' },
 *   timestamp: new Date().toISOString(),
 *   isAzure: false
 * });
 * ```
 */
export class OpenAINativeDebugger {
	private config: Required<OpenAINativeDebugConfig>
	private activeRequests: Map<string, { startTime: number; info: Partial<DebugRequestInfo> }> = new Map()

	constructor(config: OpenAINativeDebugConfig = {}) {
		this.config = {
			enabled: config.enabled ?? this.isDebugEnabled(),
			logLevel: config.logLevel ?? "debug",
			logOutput: config.logOutput ?? console.log.bind(console),
			includeRequestBody: config.includeRequestBody ?? true,
			includeResponseBody: config.includeResponseBody ?? true,
			maxBodyLength: config.maxBodyLength ?? DEFAULT_MAX_BODY_LENGTH,
			fullMask: config.fullMask ?? false,
		}
	}

	// ========================================================================
	// Public Methods - Core Functionality
	// ========================================================================

	/**
	 * Check if debug mode is enabled via environment variable or configuration
	 */
	isDebugEnabled(): boolean {
		if (typeof process !== "undefined" && process.env) {
			const debugEnv = process.env.OPENAI_DEBUG || process.env.OPENAI_NATIVE_DEBUG
			return debugEnv === "true" || debugEnv === "1"
		}
		return false
	}

	/**
	 * Enable or disable debug mode programmatically
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled
	}

	/**
	 * Check if the debugger is currently enabled
	 */
	get enabled(): boolean {
		return this.config.enabled
	}

	/**
	 * Generate a unique request ID for correlation
	 */
	generateRequestId(): string {
		return `req_${randomUUID().replace(/-/g, "").slice(0, 24)}`
	}

	/**
	 * Get current timestamp in ISO format with milliseconds
	 */
	getTimestamp(): string {
		return new Date().toISOString()
	}

	// ========================================================================
	// Public Methods - Request Logging
	// ========================================================================

	/**
	 * Log the start of a request
	 */
	logRequest(info: DebugRequestInfo): void {
		if (!this.config.enabled) return

		this.activeRequests.set(info.requestId, {
			startTime: Date.now(),
			info,
		})

		const lines: string[] = [
			this.formatHeader("REQUEST", info.requestId, info.timestamp),
			this.formatLine("Method", info.method),
			this.formatLine("URL", info.url),
		]

		if (info.baseUrl && info.baseUrl !== info.url) {
			lines.push(this.formatLine("Base URL", info.baseUrl))
		}

		if (info.resolvedUrl && info.resolvedUrl !== info.url) {
			lines.push(this.formatLine("Resolved URL", info.resolvedUrl))
		}

		lines.push(this.formatLine("Is Azure", String(info.isAzure)))

		if (info.timeout) {
			lines.push(this.formatLine("Timeout", `${info.timeout}ms`))
		}

		// Log URL transformations
		if (info.urlTransformations && info.urlTransformations.length > 0) {
			lines.push(this.formatSubheader("URL Transformations"))
			for (const transform of info.urlTransformations) {
				lines.push(
					this.formatLine(
						`  ${transform.step}`,
						`"${transform.before}" → "${transform.after}"`,
						transform.reason,
					),
				)
			}
		}

		// Log proxy configuration
		if (info.proxyConfig?.enabled) {
			lines.push(this.formatSubheader("Proxy Configuration"))
			lines.push(this.formatLine("  Protocol", info.proxyConfig.protocol ?? "http"))
			lines.push(this.formatLine("  Host", info.proxyConfig.host ?? "unknown"))
			lines.push(this.formatLine("  Port", String(info.proxyConfig.port ?? "unknown")))
		}

		// Log headers (with masking)
		lines.push(this.formatSubheader("Headers"))
		for (const [key, value] of Object.entries(info.headers)) {
			lines.push(this.formatLine(`  ${key}`, this.maskSensitiveValue(key, value)))
		}

		// Log body if enabled
		if (this.config.includeRequestBody && info.body) {
			lines.push(this.formatSubheader("Body"))
			lines.push(this.formatBody(info.body))
		}

		lines.push(this.formatFooter())
		this.log("info", lines.join("\n"))
	}

	/**
	 * Log URL construction and transformation details
	 */
	logUrlConstruction(
		requestId: string,
		baseUrl: string,
		transformations: UrlTransformation[],
		finalUrl: string,
	): void {
		if (!this.config.enabled) return

		const lines: string[] = [
			this.formatHeader("URL CONSTRUCTION", requestId, this.getTimestamp()),
			this.formatLine("Input Base URL", baseUrl),
			this.formatSubheader("Transformation Steps"),
		]

		for (let i = 0; i < transformations.length; i++) {
			const t = transformations[i]
			lines.push(`  ${i + 1}. ${t.step}`)
			lines.push(`     Before: "${t.before}"`)
			lines.push(`     After:  "${t.after}"`)
			if (t.reason) {
				lines.push(`     Reason: ${t.reason}`)
			}
		}

		lines.push(this.formatLine("Final URL", finalUrl))
		lines.push(this.formatFooter())

		this.log("debug", lines.join("\n"))
	}

	// ========================================================================
	// Public Methods - Response Logging
	// ========================================================================

	/**
	 * Log a successful response
	 */
	logResponse(info: DebugResponseInfo): void {
		if (!this.config.enabled) return

		const lines: string[] = [
			this.formatHeader("RESPONSE", info.requestId, info.timestamp),
			this.formatLine("Status", `${info.status} ${info.statusText}`),
			this.formatLine("Duration", `${info.durationMs}ms`),
		]

		// Log OpenAI-specific headers
		if (info.openaiOrganization) {
			lines.push(this.formatLine("OpenAI-Organization", info.openaiOrganization))
		}
		if (info.openaiProcessingMs !== undefined) {
			lines.push(this.formatLine("OpenAI-Processing-Ms", `${info.openaiProcessingMs}ms`))
		}
		if (info.openaiVersion) {
			lines.push(this.formatLine("OpenAI-Version", info.openaiVersion))
		}
		if (info.xRequestId) {
			lines.push(this.formatLine("X-Request-ID", info.xRequestId))
		}

		// Log rate limit information
		if (info.rateLimitInfo) {
			lines.push(this.formatSubheader("Rate Limit Info"))
			const rl = info.rateLimitInfo
			if (rl.limitRequests !== undefined) {
				lines.push(this.formatLine("  Limit Requests", String(rl.limitRequests)))
			}
			if (rl.remainingRequests !== undefined) {
				lines.push(this.formatLine("  Remaining Requests", String(rl.remainingRequests)))
			}
			if (rl.limitTokens !== undefined) {
				lines.push(this.formatLine("  Limit Tokens", String(rl.limitTokens)))
			}
			if (rl.remainingTokens !== undefined) {
				lines.push(this.formatLine("  Remaining Tokens", String(rl.remainingTokens)))
			}
			if (rl.resetRequests) {
				lines.push(this.formatLine("  Reset Requests", rl.resetRequests))
			}
			if (rl.resetTokens) {
				lines.push(this.formatLine("  Reset Tokens", rl.resetTokens))
			}
		}

		// Log response headers
		lines.push(this.formatSubheader("Headers"))
		for (const [key, value] of Object.entries(info.headers)) {
			lines.push(this.formatLine(`  ${key}`, this.maskSensitiveValue(key, value)))
		}

		// Log body if enabled
		if (this.config.includeResponseBody && info.body) {
			lines.push(this.formatSubheader("Body"))
			lines.push(this.formatBody(info.body))
		}

		lines.push(this.formatFooter())

		// Use appropriate log level based on status
		const level = info.status >= 400 ? "error" : info.status >= 300 ? "warn" : "info"
		this.log(level, lines.join("\n"))

		// Clean up active request
		this.activeRequests.delete(info.requestId)
	}

	/**
	 * Log a streaming event
	 */
	logStreamEvent(requestId: string, eventType: string, data?: unknown): void {
		if (!this.config.enabled) return

		const lines: string[] = [
			this.formatHeader("STREAM EVENT", requestId, this.getTimestamp()),
			this.formatLine("Event Type", eventType),
		]

		if (data !== undefined) {
			lines.push(this.formatSubheader("Data"))
			lines.push(this.formatBody(data))
		}

		lines.push(this.formatFooter())
		this.log("debug", lines.join("\n"))
	}

	// ========================================================================
	// Public Methods - Error Logging
	// ========================================================================

	/**
	 * Log an error with detailed debugging information
	 */
	logError(info: DebugErrorInfo): void {
		if (!this.config.enabled) return

		const lines: string[] = [
			this.formatHeader("ERROR", info.requestId, info.timestamp),
			this.formatLine("Category", info.category),
		]

		if (info.code) {
			lines.push(this.formatLine("Code", info.code))
		}

		lines.push(this.formatLine("Message", info.message))

		if (info.durationMs !== undefined) {
			lines.push(this.formatLine("Duration", `${info.durationMs}ms`))
		}

		// Log additional context
		if (info.context && Object.keys(info.context).length > 0) {
			lines.push(this.formatSubheader("Context"))
			for (const [key, value] of Object.entries(info.context)) {
				lines.push(this.formatLine(`  ${key}`, String(value)))
			}
		}

		// Log original error details
		if (info.originalError) {
			lines.push(this.formatSubheader("Original Error"))
			lines.push(this.formatLine("  Name", info.originalError.name))
			lines.push(this.formatLine("  Message", info.originalError.message))
			if (info.originalError.stack) {
				lines.push("  Stack Trace:")
				const stackLines = info.originalError.stack.split("\n").slice(1, 6) // First 5 stack frames
				for (const stackLine of stackLines) {
					lines.push(`    ${stackLine.trim()}`)
				}
			}
		}

		// Log suggestions
		if (info.suggestions && info.suggestions.length > 0) {
			lines.push(this.formatSubheader("Suggestions"))
			for (const suggestion of info.suggestions) {
				lines.push(`  • ${suggestion}`)
			}
		}

		lines.push(this.formatFooter())
		this.log("error", lines.join("\n"))

		// Clean up active request
		this.activeRequests.delete(info.requestId)
	}

	/**
	 * Categorize an error and return debugging information
	 */
	categorizeError(error: Error, requestId: string, startTime?: number): DebugErrorInfo {
		const timestamp = this.getTimestamp()
		const durationMs = startTime ? Date.now() - startTime : undefined
		const errorMessage = error.message.toLowerCase()

		// DNS errors (check before connection errors since some overlap)
		if (
			errorMessage.includes("getaddrinfo") ||
			errorMessage.includes("dns") ||
			errorMessage.includes("enotfound") ||
			errorMessage.includes("name resolution")
		) {
			return {
				requestId,
				category: "dns",
				message: error.message,
				timestamp,
				durationMs,
				originalError: error,
				suggestions: [
					"Verify the hostname in the base URL is correct",
					"Check DNS resolution: try `nslookup <hostname>`",
					"Check if you're using a custom DNS server",
					"Ensure the domain exists and is properly configured",
				],
			}
		}

		// Connection errors
		if (
			errorMessage.includes("econnrefused") ||
			errorMessage.includes("econnreset") ||
			errorMessage.includes("failed to connect") ||
			errorMessage.includes("network error")
		) {
			return {
				requestId,
				category: "connection",
				message: error.message,
				timestamp,
				durationMs,
				originalError: error,
				suggestions: [
					"Check if the API endpoint is accessible from your network",
					"Verify the base URL is correct",
					"Check for firewall or proxy blocking the connection",
					"Ensure the service is running and accepting connections",
				],
			}
		}

		// SSL/TLS errors
		if (
			errorMessage.includes("ssl") ||
			errorMessage.includes("tls") ||
			errorMessage.includes("certificate") ||
			errorMessage.includes("cert_") ||
			errorMessage.includes("unable to verify")
		) {
			return {
				requestId,
				category: "ssl_tls",
				message: error.message,
				timestamp,
				durationMs,
				originalError: error,
				suggestions: [
					"Verify the SSL certificate is valid and not expired",
					"Check if the certificate chain is complete",
					"For self-signed certificates, configure NODE_TLS_REJECT_UNAUTHORIZED=0 (not recommended for production)",
					"Ensure the certificate matches the hostname",
				],
			}
		}

		// Timeout errors
		if (
			errorMessage.includes("timeout") ||
			errorMessage.includes("etimedout") ||
			errorMessage.includes("timed out") ||
			errorMessage.includes("deadline")
		) {
			return {
				requestId,
				category: "timeout",
				message: error.message,
				timestamp,
				durationMs,
				originalError: error,
				suggestions: [
					"Increase the timeout value if the request requires more time",
					"Check network latency to the API endpoint",
					"Consider using a closer regional endpoint",
					"Check if the request payload is too large",
				],
			}
		}

		// Malformed response errors
		if (
			errorMessage.includes("json") ||
			errorMessage.includes("parse") ||
			errorMessage.includes("unexpected token") ||
			errorMessage.includes("malformed") ||
			errorMessage.includes("invalid response")
		) {
			return {
				requestId,
				category: "malformed_response",
				message: error.message,
				timestamp,
				durationMs,
				originalError: error,
				suggestions: [
					"The API returned an unexpected response format",
					"Check if the API endpoint is correct",
					"Verify you're not hitting a proxy or load balancer error page",
					"The API may be experiencing issues - check status page",
				],
			}
		}

		// Auth errors
		if (
			errorMessage.includes("401") ||
			errorMessage.includes("403") ||
			errorMessage.includes("authentication") ||
			errorMessage.includes("unauthorized") ||
			errorMessage.includes("forbidden") ||
			errorMessage.includes("invalid api key")
		) {
			return {
				requestId,
				category: "auth",
				message: error.message,
				timestamp,
				durationMs,
				originalError: error,
				suggestions: [
					"Verify your API key is correct and not expired",
					"Check if the API key has the required permissions",
					"Ensure the Authorization header format is correct",
					"For Azure, verify you're using the correct authentication method",
				],
			}
		}

		// Rate limit errors
		if (
			errorMessage.includes("429") ||
			errorMessage.includes("rate limit") ||
			errorMessage.includes("too many requests") ||
			errorMessage.includes("quota exceeded")
		) {
			return {
				requestId,
				category: "rate_limit",
				message: error.message,
				timestamp,
				durationMs,
				originalError: error,
				suggestions: [
					"Implement exponential backoff retry logic",
					"Reduce the frequency of API requests",
					"Consider upgrading your API plan for higher limits",
					"Check the rate limit headers for reset timing",
				],
			}
		}

		// Server errors
		if (
			errorMessage.includes("500") ||
			errorMessage.includes("502") ||
			errorMessage.includes("503") ||
			errorMessage.includes("504") ||
			errorMessage.includes("server error") ||
			errorMessage.includes("internal error")
		) {
			return {
				requestId,
				category: "server_error",
				message: error.message,
				timestamp,
				durationMs,
				originalError: error,
				suggestions: [
					"The API service may be experiencing issues",
					"Try again after a short delay",
					"Check the OpenAI/Azure status page",
					"If persistent, contact support with the request ID",
				],
			}
		}

		// Unknown error
		return {
			requestId,
			category: "unknown",
			message: error.message,
			timestamp,
			durationMs,
			originalError: error,
			suggestions: [
				"Review the error message for specific details",
				"Enable verbose logging for more information",
				"Check the API documentation for this error",
				"Contact support if the issue persists",
			],
		}
	}

	// ========================================================================
	// Public Methods - Utility Functions
	// ========================================================================

	/**
	 * Mask sensitive data in a string (e.g., API keys)
	 */
	maskApiKey(key: string): string {
		if (!key || key.length < 8) {
			return "***"
		}

		if (this.config.fullMask) {
			return "***"
		}

		// Show first 4 and last 4 characters
		return `${key.slice(0, 4)}...${key.slice(-4)}`
	}

	/**
	 * Parse response headers and extract debugging information
	 */
	parseResponseHeaders(headers: Headers | Record<string, string>): {
		headers: Record<string, string>
		rateLimitInfo?: RateLimitInfo
		openaiHeaders: {
			organization?: string
			processingMs?: number
			version?: string
			requestId?: string
		}
	} {
		const result: Record<string, string> = {}
		const rateLimitInfo: RateLimitInfo = {}
		const openaiHeaders: {
			organization?: string
			processingMs?: number
			version?: string
			requestId?: string
		} = {}

		const getHeader = (name: string): string | null => {
			if (headers instanceof Headers) {
				return headers.get(name)
			}
			// Case-insensitive lookup for plain objects
			const lowerName = name.toLowerCase()
			for (const [key, value] of Object.entries(headers)) {
				if (key.toLowerCase() === lowerName) {
					return value
				}
			}
			return null
		}

		// Collect all headers
		if (headers instanceof Headers) {
			headers.forEach((value, key) => {
				result[key] = value
			})
		} else {
			Object.assign(result, headers)
		}

		// Extract OpenAI-specific headers
		const org = getHeader("openai-organization")
		if (org) openaiHeaders.organization = org

		const processingMs = getHeader("openai-processing-ms")
		if (processingMs) openaiHeaders.processingMs = parseInt(processingMs, 10)

		const version = getHeader("openai-version")
		if (version) openaiHeaders.version = version

		const xRequestId = getHeader("x-request-id")
		if (xRequestId) openaiHeaders.requestId = xRequestId

		// Extract rate limit headers
		const limitRequests = getHeader("x-ratelimit-limit-requests")
		if (limitRequests) rateLimitInfo.limitRequests = parseInt(limitRequests, 10)

		const limitTokens = getHeader("x-ratelimit-limit-tokens")
		if (limitTokens) rateLimitInfo.limitTokens = parseInt(limitTokens, 10)

		const remainingRequests = getHeader("x-ratelimit-remaining-requests")
		if (remainingRequests) rateLimitInfo.remainingRequests = parseInt(remainingRequests, 10)

		const remainingTokens = getHeader("x-ratelimit-remaining-tokens")
		if (remainingTokens) rateLimitInfo.remainingTokens = parseInt(remainingTokens, 10)

		const resetRequests = getHeader("x-ratelimit-reset-requests")
		if (resetRequests) rateLimitInfo.resetRequests = resetRequests

		const resetTokens = getHeader("x-ratelimit-reset-tokens")
		if (resetTokens) rateLimitInfo.resetTokens = resetTokens

		return {
			headers: result,
			rateLimitInfo: Object.keys(rateLimitInfo).length > 0 ? rateLimitInfo : undefined,
			openaiHeaders,
		}
	}

	/**
	 * Track URL transformations for debugging
	 */
	trackUrlTransformation(
		transformations: UrlTransformation[],
		step: string,
		before: string,
		after: string,
		reason?: string,
	): void {
		transformations.push({ step, before, after, reason })
	}

	/**
	 * Start tracking a request and return tracking info
	 */
	startRequest(requestId: string): { startTime: number } {
		const startTime = Date.now()
		this.activeRequests.set(requestId, {
			startTime,
			info: { requestId },
		})
		return { startTime }
	}

	/**
	 * Get the duration of an active request
	 */
	getRequestDuration(requestId: string): number | undefined {
		const request = this.activeRequests.get(requestId)
		if (request) {
			return Date.now() - request.startTime
		}
		return undefined
	}

	/**
	 * End request tracking
	 */
	endRequest(requestId: string): void {
		this.activeRequests.delete(requestId)
	}

	// ========================================================================
	// Private Methods - Formatting
	// ========================================================================

	/**
	 * Format a log header
	 */
	private formatHeader(title: string, requestId: string, timestamp: string): string {
		const separator = "═".repeat(60)
		return [
			"",
			`╔${separator}╗`,
			`║ [OPENAI DEBUG] ${title.padEnd(42)} ║`,
			`╠${separator}╣`,
			`║ Request ID: ${requestId.padEnd(45)} ║`,
			`║ Timestamp:  ${timestamp.padEnd(45)} ║`,
			`╠${separator}╣`,
		].join("\n")
	}

	/**
	 * Format a subheader
	 */
	private formatSubheader(title: string): string {
		return `\n┌─ ${title} ${"─".repeat(Math.max(0, 55 - title.length))}`
	}

	/**
	 * Format a key-value line
	 */
	private formatLine(key: string, value: string, note?: string): string {
		const noteStr = note ? ` (${note})` : ""
		return `│ ${key}: ${value}${noteStr}`
	}

	/**
	 * Format the footer
	 */
	private formatFooter(): string {
		const separator = "═".repeat(60)
		return `╚${separator}╝\n`
	}

	/**
	 * Format a body for logging
	 */
	private formatBody(body: unknown): string {
		try {
			let bodyStr: string

			if (typeof body === "string") {
				bodyStr = body
			} else {
				bodyStr = JSON.stringify(body, null, 2)
			}

			if (bodyStr.length > this.config.maxBodyLength) {
				return `${bodyStr.slice(0, this.config.maxBodyLength)}\n... [truncated, ${bodyStr.length - this.config.maxBodyLength} more characters]`
			}

			return bodyStr
		} catch {
			return "[Unable to serialize body]"
		}
	}

	/**
	 * Mask sensitive header values
	 */
	private maskSensitiveValue(key: string, value: string): string {
		if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
			// Extract the actual key value (after "Bearer " if present)
			if (value.toLowerCase().startsWith("bearer ")) {
				const token = value.slice(7)
				return `Bearer ${this.maskApiKey(token)}`
			}
			return this.maskApiKey(value)
		}
		return value
	}

	/**
	 * Internal logging function with level filtering
	 */
	private log(level: DebugLogLevel, message: string): void {
		if (LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[this.config.logLevel]) {
			const prefix = `[${level.toUpperCase()}]`
			this.config.logOutput(`${prefix} ${message}`)
		}
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default debugger instance that can be used throughout the codebase
 */
export const openAINativeDebugger = new OpenAINativeDebugger()

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Helper function to create a URL transformation tracker
 */
export function createUrlTransformationTracker(): {
	transformations: UrlTransformation[]
	track: (step: string, before: string, after: string, reason?: string) => void
} {
	const transformations: UrlTransformation[] = []
	return {
		transformations,
		track: (step: string, before: string, after: string, reason?: string) => {
			transformations.push({ step, before, after, reason })
		},
	}
}

/**
 * Helper function to build debug request info from fetch parameters
 */
export function buildDebugRequestInfo(
	requestId: string,
	url: string,
	options: RequestInit,
	extras: {
		baseUrl?: string
		isAzure: boolean
		urlTransformations?: UrlTransformation[]
		proxyConfig?: ProxyConfig
	},
): DebugRequestInfo {
	const headers: Record<string, string> = {}

	if (options.headers) {
		if (options.headers instanceof Headers) {
			options.headers.forEach((value, key) => {
				headers[key] = value
			})
		} else if (Array.isArray(options.headers)) {
			for (const [key, value] of options.headers) {
				headers[key] = value
			}
		} else {
			Object.assign(headers, options.headers)
		}
	}

	return {
		requestId,
		method: options.method || "GET",
		url,
		baseUrl: extras.baseUrl,
		headers,
		body: options.body ? safeJsonParse(options.body as string) : undefined,
		timestamp: new Date().toISOString(),
		isAzure: extras.isAzure,
		urlTransformations: extras.urlTransformations,
		proxyConfig: extras.proxyConfig,
	}
}

/**
 * Helper function to build debug response info from fetch response
 */
export function buildDebugResponseInfo(
	requestId: string,
	response: Response,
	startTime: number,
	body?: unknown,
): DebugResponseInfo {
	// Handle cases where response.headers may be undefined (e.g., in tests with mock responses)
	const responseHeaders = response.headers ?? new Headers()
	const { headers, rateLimitInfo, openaiHeaders } = openAINativeDebugger.parseResponseHeaders(responseHeaders)

	return {
		requestId,
		status: response.status ?? 0,
		statusText: response.statusText ?? "",
		headers,
		body,
		timestamp: new Date().toISOString(),
		durationMs: Date.now() - startTime,
		rateLimitInfo,
		openaiOrganization: openaiHeaders.organization,
		openaiProcessingMs: openaiHeaders.processingMs,
		openaiVersion: openaiHeaders.version,
		xRequestId: openaiHeaders.requestId,
	}
}

/**
 * Safe JSON parse that returns the original string if parsing fails
 */
function safeJsonParse(str: string): unknown {
	try {
		return JSON.parse(str)
	} catch {
		return str
	}
}
