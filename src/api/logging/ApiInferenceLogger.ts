/**
 * Lightweight logger for API inference requests/responses.
 *
 * This logger is designed to capture raw inference inputs/outputs across providers
 * for debugging purposes. It emits structured objects to a configurable sink.
 *
 * For streaming requests, only the final assembled response is logged (not individual chunks).
 *
 * Enable via environment variable: process.env.ROO_CODE_API_LOGGING === "true"
 */

export interface ApiInferenceLoggerConfig {
	enabled: boolean
	sink: (...args: unknown[]) => void
}

export interface ApiInferenceContext {
	provider: string
	operation: string
	model?: string
	taskId?: string
	requestId?: string
}

export interface ApiInferenceHandle {
	success: (responsePayload: unknown) => void
	error: (errorPayload: unknown) => void
}

/**
 * Configuration for payload size limiting to avoid freezing the Output Channel.
 */
const PAYLOAD_LIMITS = {
	/** Maximum string length before truncation */
	MAX_STRING_LENGTH: 10_000,
	/** Maximum array entries to log */
	MAX_ARRAY_LENGTH: 200,
	/** Maximum object keys to log */
	MAX_OBJECT_KEYS: 200,
}

/**
 * Regex pattern for detecting base64 image data URLs.
 */
const BASE64_IMAGE_PATTERN = /^data:image\/[^;]+;base64,/

/**
 * Secret field patterns to redact in logged payloads.
 * Case-insensitive matching is applied.
 * Note: Patterns are designed to avoid false positives (e.g., "inputTokens" should not be redacted).
 */
const SECRET_PATTERNS = [
	"authorization",
	"apikey",
	"api_key",
	"x-api-key",
	"access_token",
	"accesstoken",
	"bearer",
	"secret",
	"password",
	"credential",
]

/**
 * Patterns that indicate a field is NOT a secret (allowlist).
 * These are checked before secret patterns to prevent false positives.
 */
const NON_SECRET_PATTERNS = ["inputtokens", "outputtokens", "cachetokens", "reasoningtokens", "totaltokens"]

/**
 * Check if a key name looks like a secret field.
 */
function isSecretKey(key: string): boolean {
	const lowerKey = key.toLowerCase()
	// Check allowlist first to avoid false positives
	if (NON_SECRET_PATTERNS.some((pattern) => lowerKey.includes(pattern))) {
		return false
	}
	return SECRET_PATTERNS.some((pattern) => lowerKey.includes(pattern))
}

/**
 * Truncate a string if it exceeds the maximum length.
 * Also replaces base64 image data with a placeholder.
 */
function sanitizeString(str: string): string {
	// Check for base64 image data URLs first
	if (BASE64_IMAGE_PATTERN.test(str)) {
		return `[ImageData len=${str.length}]`
	}

	// Truncate long strings
	if (str.length > PAYLOAD_LIMITS.MAX_STRING_LENGTH) {
		return `[Truncated len=${str.length}]`
	}

	return str
}

/**
 * Recursively sanitize and redact secrets from an object.
 * Applies size limiting to prevent Output Channel from freezing:
 * - Strings longer than MAX_STRING_LENGTH are truncated
 * - Arrays longer than MAX_ARRAY_LENGTH are capped
 * - Objects with more than MAX_OBJECT_KEYS are capped
 * - Base64 image data URLs are replaced with placeholders
 * - Secret fields are redacted
 * Returns a sanitized copy of the object.
 */
function sanitizePayload(obj: unknown, visited = new WeakSet<object>()): unknown {
	if (obj === null || obj === undefined) {
		return obj
	}

	// Handle strings
	if (typeof obj === "string") {
		return sanitizeString(obj)
	}

	// Handle other primitives
	if (typeof obj !== "object") {
		return obj
	}

	// Prevent infinite recursion on circular references
	if (visited.has(obj as object)) {
		return "[Circular Reference]"
	}
	visited.add(obj as object)

	// Handle arrays with length limiting
	if (Array.isArray(obj)) {
		const maxLen = PAYLOAD_LIMITS.MAX_ARRAY_LENGTH
		if (obj.length > maxLen) {
			const truncated = obj.slice(0, maxLen).map((item) => sanitizePayload(item, visited))
			truncated.push(`[...${obj.length - maxLen} more items]`)
			return truncated
		}
		return obj.map((item) => sanitizePayload(item, visited))
	}

	// Handle objects with key limiting
	const entries = Object.entries(obj as Record<string, unknown>)
	const maxKeys = PAYLOAD_LIMITS.MAX_OBJECT_KEYS
	const result: Record<string, unknown> = {}
	let keyCount = 0

	for (const [key, value] of entries) {
		if (keyCount >= maxKeys) {
			result["[...]"] = `${entries.length - maxKeys} more keys omitted`
			break
		}

		if (isSecretKey(key)) {
			result[key] = "[REDACTED]"
		} else if (typeof value === "string") {
			result[key] = sanitizeString(value)
		} else if (typeof value === "object" && value !== null) {
			result[key] = sanitizePayload(value, visited)
		} else {
			result[key] = value
		}

		keyCount++
	}

	return result
}

/**
 * Generate a unique request ID.
 */
function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Singleton logger class for API inference logging.
 */
class ApiInferenceLoggerSingleton {
	private enabled = false
	private sink: ((...args: unknown[]) => void) | null = null

	/**
	 * Configure the logger with enabled state and output sink.
	 * Should be called once during extension activation.
	 */
	configure(config: ApiInferenceLoggerConfig): void {
		this.enabled = config.enabled
		this.sink = config.enabled ? config.sink : null
	}

	/**
	 * Check if logging is currently enabled.
	 */
	isEnabled(): boolean {
		return this.enabled && this.sink !== null
	}

	/**
	 * Start logging an API inference request.
	 * Returns a handle to log the response or error.
	 *
	 * @param context - Context information about the request
	 * @param requestPayload - The request payload to log
	 * @returns A handle with success() and error() methods
	 */
	start(context: ApiInferenceContext, requestPayload: unknown): ApiInferenceHandle {
		const requestId = context.requestId ?? generateRequestId()
		const startTime = Date.now()
		const startTimestamp = new Date().toISOString()

		// Log the request
		if (this.isEnabled()) {
			this.logRequest({
				...context,
				requestId,
				timestamp: startTimestamp,
				payload: requestPayload,
			})
		}

		return {
			success: (responsePayload: unknown) => {
				if (this.isEnabled()) {
					const endTime = Date.now()
					this.logResponse({
						...context,
						requestId,
						timestamp: new Date().toISOString(),
						durationMs: endTime - startTime,
						payload: responsePayload,
					})
				}
			},
			error: (errorPayload: unknown) => {
				if (this.isEnabled()) {
					const endTime = Date.now()
					this.logError({
						...context,
						requestId,
						timestamp: new Date().toISOString(),
						durationMs: endTime - startTime,
						error: errorPayload,
					})
				}
			},
		}
	}

	/**
	 * Log a request with stable tag format.
	 */
	private logRequest(data: {
		provider: string
		operation: string
		model?: string
		taskId?: string
		requestId: string
		timestamp: string
		payload: unknown
	}): void {
		if (!this.sink) return

		try {
			this.sink("[API][request]", {
				provider: data.provider,
				operation: data.operation,
				model: data.model,
				taskId: data.taskId,
				requestId: data.requestId,
				timestamp: data.timestamp,
				payload: sanitizePayload(data.payload),
			})
		} catch {
			// Silently ignore logging errors to avoid breaking the application
		}
	}

	/**
	 * Log a successful response with stable tag format.
	 */
	private logResponse(data: {
		provider: string
		operation: string
		model?: string
		taskId?: string
		requestId: string
		timestamp: string
		durationMs: number
		payload: unknown
	}): void {
		if (!this.sink) return

		try {
			this.sink("[API][response]", {
				provider: data.provider,
				operation: data.operation,
				model: data.model,
				taskId: data.taskId,
				requestId: data.requestId,
				timestamp: data.timestamp,
				durationMs: data.durationMs,
				payload: sanitizePayload(data.payload),
			})
		} catch {
			// Silently ignore logging errors to avoid breaking the application
		}
	}

	/**
	 * Log an error response with stable tag format.
	 */
	private logError(data: {
		provider: string
		operation: string
		model?: string
		taskId?: string
		requestId: string
		timestamp: string
		durationMs: number
		error: unknown
	}): void {
		if (!this.sink) return

		try {
			// Handle Error objects specially
			let errorData: unknown
			if (data.error instanceof Error) {
				errorData = {
					name: data.error.name,
					message: data.error.message,
					stack: data.error.stack,
				}
			} else {
				errorData = sanitizePayload(data.error)
			}

			this.sink("[API][error]", {
				provider: data.provider,
				operation: data.operation,
				model: data.model,
				taskId: data.taskId,
				requestId: data.requestId,
				timestamp: data.timestamp,
				durationMs: data.durationMs,
				error: errorData,
			})
		} catch {
			// Silently ignore logging errors to avoid breaking the application
		}
	}
}

/**
 * Singleton instance of the API inference logger.
 */
export const ApiInferenceLogger = new ApiInferenceLoggerSingleton()
