/**
 * UnifiedErrorHandler - Provides consistent error handling across streaming and non-streaming contexts
 *
 * This handler orchestrates error analysis and retry strategy selection using focused components
 * to prevent inconsistent behavior during API retry cycles.
 */

import { IErrorHandler } from "../../core/interfaces/IErrorHandler"
import { ErrorContext, ErrorHandlerResponse, ErrorType } from "../../core/interfaces/types"
import { ErrorAnalyzer } from "./ErrorAnalyzer"
import { RetryStrategyFactory } from "../retry/RetryStrategyFactory"

// Re-export types for backward compatibility
export type { ErrorContext, ErrorHandlerResponse, ErrorType }

export class UnifiedErrorHandler implements IErrorHandler {
	private static instance: UnifiedErrorHandler = new UnifiedErrorHandler()
	private readonly errorAnalyzer: ErrorAnalyzer
	private readonly retryStrategyFactory: RetryStrategyFactory

	constructor(errorAnalyzer?: ErrorAnalyzer, retryStrategyFactory?: RetryStrategyFactory) {
		this.errorAnalyzer = errorAnalyzer || new ErrorAnalyzer()
		this.retryStrategyFactory = retryStrategyFactory || new RetryStrategyFactory()
	}

	/**
	 * Static method for backward compatibility
	 */
	static handle(error: unknown, context: ErrorContext): ErrorHandlerResponse {
		return UnifiedErrorHandler.instance.handle(error, context)
	}

	/**
	 * Main error handling entry point (instance method)
	 */
	handle(error: unknown, context: ErrorContext): ErrorHandlerResponse {
		// Analyze the error using the dedicated analyzer
		const analysis = this.errorAnalyzer.analyze(error, context)

		// Get appropriate retry strategy
		const retryStrategy = this.retryStrategyFactory.createProviderAwareStrategy(
			analysis.errorType,
			analysis.providerRetryDelay,
			context,
		)

		// Determine retry behavior
		const shouldRetry = retryStrategy.shouldRetry(analysis.errorType, context.retryAttempt || 0)
		const shouldThrow = this.shouldThrowImmediately(analysis.errorType, context.isStreaming)
		const retryDelay = retryStrategy.calculateDelay(analysis.errorType, context.retryAttempt || 0)

		const formattedMessage = this.formatErrorMessage(error, analysis.errorType, context)

		const response: ErrorHandlerResponse = {
			shouldRetry,
			shouldThrow,
			errorType: analysis.errorType,
			formattedMessage,
			retryDelay,
		}

		// For streaming context, provide chunks when not throwing immediately
		if (context.isStreaming && !shouldThrow) {
			response.streamChunks = [
				{ type: "text", text: `Error: ${formattedMessage}` },
				{ type: "usage", inputTokens: 0, outputTokens: 0 },
			]
		}

		return response
	}

	/**
	 * Determine if error should be thrown immediately (for proper retry handling)
	 */
	private shouldThrowImmediately(errorType: ErrorType, isStreaming: boolean): boolean {
		// For throttling errors in streaming context, throw immediately for proper retry handling
		if ((errorType === "THROTTLING" || errorType === "RATE_LIMITED") && isStreaming) {
			return true
		}

		// For other critical errors, throw immediately regardless of context
		const immediateThrowTypes: ErrorType[] = ["ACCESS_DENIED", "NOT_FOUND", "INVALID_REQUEST"]

		return immediateThrowTypes.includes(errorType)
	}

	/**
	 * Format error message with context information
	 */
	private formatErrorMessage(error: unknown, errorType: ErrorType, context: ErrorContext): string {
		let message = error instanceof Error ? error.message : "Unknown error"

		// Clean up common noise in error messages
		message = message.replace(/\s+/g, " ").trim()

		// Add context-specific information
		const contextInfo = `[${context.provider}:${context.modelId}]`

		// Add retry information if applicable
		const retryInfo = context.retryAttempt ? ` (Retry ${context.retryAttempt})` : ""

		// Add error type for debugging
		const typeInfo = `[${errorType}]`

		return `${contextInfo} ${typeInfo} ${message}${retryInfo}`
	}
}
