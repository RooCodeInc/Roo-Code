/**
 * @fileoverview Type definitions for the centralized API logging component
 */

/**
 * Context information for an API call
 */
export interface ApiLogContext {
	/** The provider name (e.g., "anthropic", "openai", "gemini") */
	provider: string
	/** The model identifier being used */
	model: string
	/** The type of API operation */
	operation: "createMessage" | "completePrompt" | "countTokens" | "fetchModels"
	/** Optional task ID for correlation */
	taskId?: string
	/** Unique request ID for correlating request/response logs */
	requestId?: string
}

/**
 * Sanitized request metadata for logging
 * Does NOT include actual message content or API keys
 */
export interface ApiRequestMetadata {
	/** Length of the system prompt in characters */
	systemPromptLength?: number
	/** Number of messages in the conversation */
	messageCount?: number
	/** Whether tools are being used */
	hasTools?: boolean
	/** Number of tools available */
	toolCount?: number
	/** Whether this is a streaming request */
	stream?: boolean
	/** Additional sanitized parameters */
	params?: Record<string, unknown>
	/**
	 * Raw API request body for debugging
	 * Contains the full request object sent to the provider API
	 * WARNING: May contain sensitive data - only use in development/debug mode
	 */
	rawBody?: unknown
}

/**
 * Log entry for an outbound API request
 */
export interface ApiRequestLog {
	/** Context information */
	context: ApiLogContext
	/** Timestamp when request was made */
	timestamp: number
	/** Sanitized request metadata */
	request: ApiRequestMetadata
}

/**
 * Usage metrics from an API response
 */
export interface ApiUsageMetrics {
	/** Number of input tokens */
	inputTokens: number
	/** Number of output tokens */
	outputTokens: number
	/** Tokens read from cache */
	cacheReadTokens?: number
	/** Tokens written to cache */
	cacheWriteTokens?: number
	/** Reasoning/thinking tokens */
	reasoningTokens?: number
	/** Total cost in dollars */
	totalCost?: number
}

/**
 * Error details for logging
 */
export interface ApiErrorDetails {
	/** Error message */
	message: string
	/** Error code (HTTP status or provider-specific) */
	code?: string | number
	/** Whether this error can be retried */
	isRetryable?: boolean
}

/**
 * Response metrics for logging
 */
export interface ApiResponseMetrics {
	/** Whether the request was successful */
	success: boolean
	/** Length of text content in characters */
	textLength?: number
	/** Length of reasoning content in characters */
	reasoningLength?: number
	/** Number of tool calls made */
	toolCallCount?: number
	/** Token usage metrics */
	usage?: ApiUsageMetrics
	/** Error details if request failed */
	error?: ApiErrorDetails
}

/**
 * Log entry for an inbound API response
 */
export interface ApiResponseLog {
	/** Context information */
	context: ApiLogContext
	/** Timestamp when response was received */
	timestamp: number
	/** Duration of the request in milliseconds */
	durationMs: number
	/** Response metrics */
	response: ApiResponseMetrics
}

/**
 * Callback type for custom log handling
 */
export type ApiLogCallback = (type: "request" | "response", log: ApiRequestLog | ApiResponseLog) => void

/**
 * Configuration options for the API logger
 */
export interface ApiLoggerConfig {
	/** Whether logging is enabled */
	enabled: boolean
	/** Whether to log outbound requests */
	logRequests: boolean
	/** Whether to log successful responses */
	logResponses: boolean
	/** Whether to log errors */
	logErrors: boolean
	/** Optional callback for custom log destinations */
	onLog?: ApiLogCallback
}
