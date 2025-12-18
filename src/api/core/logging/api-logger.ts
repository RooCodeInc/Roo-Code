/**
 * @fileoverview Centralized API logging service
 * Provides consistent logging for all API requests and responses across providers
 *
 * Enable logging by:
 * 1. Setting ROO_CODE_API_LOGGING=true in workspace .env.local file
 * Logs will appear in the Output/Debug console as simple console.log statements.
 */

import type {
	ApiLogContext,
	ApiLoggerConfig,
	ApiRequestLog,
	ApiRequestMetadata,
	ApiResponseLog,
	ApiResponseMetrics,
	ApiErrorDetails,
} from "./types"
import { isLoggingEnabled } from "./env-config"

/**
 * Centralized API logging service
 * Singleton instance that all providers route through for consistent logging
 *
 * When ROO_CODE_API_LOGGING=true, logs are output via console.log/console.error
 * for visibility in VS Code's Output panel and Debug Console.
 */
class ApiLoggerService {
	private config: ApiLoggerConfig = {
		enabled: true,
		logRequests: true,
		logResponses: true,
		logErrors: true,
	}

	/** Maps request IDs to their start timestamps for duration calculation */
	private requestTimestamps = new Map<string, number>()

	/**
	 * Configure the logger behavior
	 * @param config Partial configuration to merge with current settings
	 */
	configure(config: Partial<ApiLoggerConfig>): void {
		this.config = { ...this.config, ...config }
	}

	/**
	 * Get the current configuration
	 */
	getConfig(): Readonly<ApiLoggerConfig> {
		return { ...this.config }
	}

	/**
	 * Check if logging should actually output
	 * Requires both: config.enabled AND ROO_CODE_API_LOGGING=true
	 */
	private shouldLog(): boolean {
		return this.config.enabled && isLoggingEnabled()
	}

	/**
	 * Log an outbound API request
	 * Call this BEFORE making the API call
	 *
	 * @param context The API call context (provider, model, operation, etc.)
	 * @param request Sanitized request metadata (no actual content or keys)
	 * @returns A unique requestId to correlate with the response
	 */
	logRequest(context: Omit<ApiLogContext, "requestId">, request: ApiRequestMetadata): string {
		const requestId = this.generateRequestId()
		const timestamp = Date.now()

		// Always track timestamp for duration calculation
		this.requestTimestamps.set(requestId, timestamp)

		if (!this.shouldLog() || !this.config.logRequests) {
			return requestId
		}

		const log: ApiRequestLog = {
			context: { ...context, requestId },
			timestamp,
			request,
		}

		// Emit to custom callback if configured
		if (this.config.onLog) {
			this.config.onLog("request", log)
		}

		// Log using console.log for visibility in VS Code Output/Debug
		console.log(`[API Request] ${context.provider} ${context.model} ${context.operation}`)

		// If raw body is provided, output it for debugging
		if (request.rawBody) {
			console.log("[API Request Body]", JSON.stringify(request.rawBody, null, 2))
		} else {
			// Fallback to metadata if no raw body
			console.log("[API Request Metadata]", {
				requestId,
				taskId: context.taskId,
				messageCount: request.messageCount,
				hasTools: request.hasTools,
				toolCount: request.toolCount,
				stream: request.stream,
			})
		}

		return requestId
	}

	/**
	 * Log a successful API response
	 * Call this AFTER receiving and processing the response
	 *
	 * @param requestId The requestId returned from logRequest
	 * @param context The API call context
	 * @param response Response metrics (token usage, content length, etc.)
	 */
	logResponse(
		requestId: string,
		context: Omit<ApiLogContext, "requestId">,
		response: Omit<ApiResponseMetrics, "error" | "success"> & { success?: true },
	): void {
		const startTime = this.requestTimestamps.get(requestId)
		const timestamp = Date.now()
		const durationMs = startTime ? timestamp - startTime : 0

		// Clean up the timestamp tracking
		this.requestTimestamps.delete(requestId)

		if (!this.shouldLog() || !this.config.logResponses) {
			return
		}

		const log: ApiResponseLog = {
			context: { ...context, requestId },
			timestamp,
			durationMs,
			response: { ...response, success: true },
		}

		// Emit to custom callback if configured
		if (this.config.onLog) {
			this.config.onLog("response", log)
		}

		// Log using console.log for visibility in VS Code Output/Debug
		console.log(`[API Response] ${context.provider} ${context.model} ${context.operation} (${durationMs}ms)`, {
			requestId,
			success: true,
			textLength: response.textLength,
			reasoningLength: response.reasoningLength,
			toolCallCount: response.toolCallCount,
			inputTokens: response.usage?.inputTokens,
			outputTokens: response.usage?.outputTokens,
			totalCost: response.usage?.totalCost,
		})
	}

	/**
	 * Log an API error
	 * Call this when an error occurs during the API call
	 *
	 * @param requestId The requestId returned from logRequest
	 * @param context The API call context
	 * @param error Error details
	 */
	logError(requestId: string, context: Omit<ApiLogContext, "requestId">, error: ApiErrorDetails): void {
		const startTime = this.requestTimestamps.get(requestId)
		const timestamp = Date.now()
		const durationMs = startTime ? timestamp - startTime : 0

		// Clean up the timestamp tracking
		this.requestTimestamps.delete(requestId)

		if (!this.shouldLog() || !this.config.logErrors) {
			return
		}

		const log: ApiResponseLog = {
			context: { ...context, requestId },
			timestamp,
			durationMs,
			response: {
				success: false,
				error,
			},
		}

		// Emit to custom callback if configured
		if (this.config.onLog) {
			this.config.onLog("response", log)
		}

		// Log using console.error for visibility in VS Code Output/Debug
		console.error(`[API Error] ${context.provider} ${context.model} ${context.operation} (${durationMs}ms)`, {
			requestId,
			errorMessage: error.message,
			errorCode: error.code,
			isRetryable: error.isRetryable,
		})
	}

	/**
	 * Generate a unique request ID
	 */
	private generateRequestId(): string {
		return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
	}

	/**
	 * Clear all tracked request timestamps
	 * Useful for testing or cleanup
	 */
	clearTimestamps(): void {
		this.requestTimestamps.clear()
	}

	/**
	 * Get the number of currently tracked requests
	 * Useful for debugging/monitoring
	 */
	getTrackedRequestCount(): number {
		return this.requestTimestamps.size
	}
}

// Singleton instance
export const ApiLogger = new ApiLoggerService()

// Export the class for testing purposes
export { ApiLoggerService }
