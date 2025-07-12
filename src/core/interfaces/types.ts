/**
 * Core error handling types used across the application
 *
 * These types define the contracts for error handling, retry strategies,
 * and related functionality without depending on implementation details.
 */

/**
 * Context information about where and how an error occurred
 */
export interface ErrorContext {
	/** Whether the error occurred during streaming */
	isStreaming: boolean
	/** The API provider being used */
	provider: string
	/** The specific model ID */
	modelId: string
	/** Current retry attempt number */
	retryAttempt?: number
	/** Unique request identifier */
	requestId?: string
}

/**
 * Standardized response from error handlers
 */
export interface ErrorHandlerResponse {
	/** Whether the operation should be retried */
	shouldRetry: boolean
	/** Whether the error should be thrown immediately */
	shouldThrow: boolean
	/** Classified error type */
	errorType: string
	/** Human-readable error message */
	formattedMessage: string
	/** Suggested delay before retry (in seconds) */
	retryDelay?: number
	/** Stream chunks to emit for streaming contexts */
	streamChunks?: Array<StreamChunk>
}

/**
 * Stream chunk type for error responses in streaming contexts
 */
export interface StreamChunk {
	/** Type of the chunk */
	type: string
	/** Text content if applicable */
	text?: string
	/** Input token count if applicable */
	inputTokens?: number
	/** Output token count if applicable */
	outputTokens?: number
}

/**
 * Standardized error types for classification
 */
export type ErrorType =
	| "THROTTLING"
	| "RATE_LIMITED"
	| "ACCESS_DENIED"
	| "NOT_FOUND"
	| "INVALID_REQUEST"
	| "SERVICE_UNAVAILABLE"
	| "TIMEOUT"
	| "NETWORK_ERROR"
	| "QUOTA_EXCEEDED"
	| "GENERIC"
	| "UNKNOWN"
