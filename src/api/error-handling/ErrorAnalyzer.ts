/**
 * ErrorAnalyzer - Focused component for error classification and analysis
 *
 * This class is responsible for analyzing errors and extracting detailed information
 * from them, including classification, severity, and provider-specific details.
 */

import { ErrorType, ErrorContext } from "../../core/interfaces/types"

/**
 * Detailed error analysis result
 */
export interface ErrorAnalysis {
	/** Classified error type */
	errorType: ErrorType
	/** Error severity level */
	severity: "low" | "medium" | "high" | "critical"
	/** Whether the error is retryable */
	isRetryable: boolean
	/** Provider-specific retry delay if available */
	providerRetryDelay?: number
	/** Extracted error message */
	message: string
	/** Additional metadata about the error */
	metadata: {
		statusCode?: number
		errorName?: string
		errorCode?: string
		provider?: string
	}
}

export class ErrorAnalyzer {
	/**
	 * Analyze an error and return detailed classification information
	 */
	analyze(error: unknown, context?: ErrorContext): ErrorAnalysis {
		const errorType = this.classifyError(error)
		const severity = this.determineSeverity(errorType)
		const isRetryable = this.isErrorRetryable(errorType)
		const providerRetryDelay = this.extractProviderRetryDelay(error)
		const message = this.extractMessage(error)
		const metadata = this.extractMetadata(error, context)

		return {
			errorType,
			severity,
			isRetryable,
			providerRetryDelay,
			message,
			metadata,
		}
	}

	/**
	 * Classify error into standardized error types
	 */
	private classifyError(error: unknown): ErrorType {
		// Handle null/undefined
		if (!error) return "UNKNOWN"

		// Check for HTTP 429 (highest priority)
		if ((error as any).status === 429 || (error as any).$metadata?.httpStatusCode === 429) {
			return "THROTTLING"
		}

		// Check for specific error names/types (AWS, etc.)
		const errorName = (error as any).name || ""
		const errorType = (error as any).__type || ""

		if (errorName === "ThrottlingException" || errorType === "ThrottlingException") {
			return "THROTTLING"
		}

		if (errorName === "ServiceUnavailableException" || errorType === "ServiceUnavailableException") {
			return "SERVICE_UNAVAILABLE"
		}

		if (errorName === "AccessDeniedException" || errorType === "AccessDeniedException") {
			return "ACCESS_DENIED"
		}

		if (errorName === "ResourceNotFoundException" || errorType === "ResourceNotFoundException") {
			return "NOT_FOUND"
		}

		if (errorName === "ValidationException" || errorType === "ValidationException") {
			return "INVALID_REQUEST"
		}

		// Pattern matching in error message (check both error.message and direct message property)
		const message = ((error as any).message || "").toLowerCase()

		if (message) {
			// Throttling patterns (most specific first)
			if (this.matchesThrottlingPatterns(message)) {
				return "THROTTLING"
			}

			// Rate limiting patterns
			if (this.matchesRateLimitPatterns(message)) {
				return "RATE_LIMITED"
			}

			// Quota patterns
			if (this.matchesQuotaPatterns(message)) {
				return "QUOTA_EXCEEDED"
			}

			// Service availability patterns
			if (this.matchesServiceUnavailablePatterns(message)) {
				return "SERVICE_UNAVAILABLE"
			}

			// Access/permission patterns
			if (this.matchesAccessDeniedPatterns(message)) {
				return "ACCESS_DENIED"
			}

			// Not found patterns
			if (this.matchesNotFoundPatterns(message)) {
				return "NOT_FOUND"
			}

			// Network/timeout patterns
			if (this.matchesNetworkErrorPatterns(message)) {
				return "NETWORK_ERROR"
			}

			if (this.matchesTimeoutPatterns(message)) {
				return "TIMEOUT"
			}
		}

		// If it's an Error instance or has a message, classify as GENERIC
		// Otherwise classify as UNKNOWN
		if (error instanceof Error || (error as any).message) {
			return "GENERIC"
		}

		return "UNKNOWN"
	}

	/**
	 * Determine error severity based on error type
	 */
	private determineSeverity(errorType: ErrorType): "low" | "medium" | "high" | "critical" {
		switch (errorType) {
			case "ACCESS_DENIED":
			case "NOT_FOUND":
			case "INVALID_REQUEST":
				return "critical" // These are usually configuration/permission issues

			case "QUOTA_EXCEEDED":
				return "high" // Requires attention but might resolve

			case "THROTTLING":
			case "RATE_LIMITED":
			case "SERVICE_UNAVAILABLE":
				return "medium" // Temporary issues that should resolve

			case "TIMEOUT":
			case "NETWORK_ERROR":
				return "low" // Often transient connectivity issues

			case "GENERIC":
				return "medium" // Unknown but could be important

			case "UNKNOWN":
			default:
				return "low" // Default to low for unknown issues
		}
	}

	/**
	 * Determine if an error type is generally retryable
	 */
	private isErrorRetryable(errorType: ErrorType): boolean {
		const retryableTypes: ErrorType[] = [
			"THROTTLING",
			"RATE_LIMITED",
			"SERVICE_UNAVAILABLE",
			"TIMEOUT",
			"NETWORK_ERROR",
			"QUOTA_EXCEEDED",
		]

		return retryableTypes.includes(errorType)
	}

	/**
	 * Extract provider-specific retry delay (e.g., Google Gemini retry info)
	 */
	private extractProviderRetryDelay(error: unknown): number | undefined {
		if (!error || !(error as any).errorDetails) return undefined

		// Google Gemini retry info
		const geminiRetryDetails = (error as any).errorDetails?.find(
			(detail: any) => detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
		)

		if (geminiRetryDetails?.retryDelay) {
			const match = geminiRetryDetails.retryDelay.match(/^(\d+)s$/)
			if (match) {
				return Number(match[1]) + 1 // Add 1 second buffer
			}
		}

		return undefined
	}

	/**
	 * Extract clean error message
	 */
	private extractMessage(error: unknown): string {
		let message = error instanceof Error ? error.message : "Unknown error"

		// Clean up common noise in error messages
		message = message.replace(/\s+/g, " ").trim()

		return message
	}

	/**
	 * Extract metadata from error and context
	 */
	private extractMetadata(error: unknown, context?: ErrorContext): ErrorAnalysis["metadata"] {
		const metadata: ErrorAnalysis["metadata"] = {}

		if (!error) return metadata

		// Extract status code
		if ((error as any).status) {
			metadata.statusCode = (error as any).status
		} else if ((error as any).$metadata?.httpStatusCode) {
			metadata.statusCode = (error as any).$metadata.httpStatusCode
		}

		// Extract error name and code
		if ((error as any).name) {
			metadata.errorName = (error as any).name
		}

		if ((error as any).code) {
			metadata.errorCode = (error as any).code
		}

		// Add provider from context
		if (context?.provider) {
			metadata.provider = context.provider
		}

		return metadata
	}

	// Pattern matching helper methods
	private matchesThrottlingPatterns(message: string): boolean {
		const patterns = [
			"throttl",
			"overloaded",
			"too many requests",
			"request limit",
			"concurrent requests",
			"bedrock is unable to process",
		]
		return patterns.some((pattern) => message.includes(pattern))
	}

	private matchesRateLimitPatterns(message: string): boolean {
		const patterns = ["rate", "limit", "please wait"]
		return patterns.some((pattern) => message.includes(pattern))
	}

	private matchesQuotaPatterns(message: string): boolean {
		const patterns = ["quota exceeded", "quota", "billing", "credits"]
		return patterns.some((pattern) => message.includes(pattern))
	}

	private matchesServiceUnavailablePatterns(message: string): boolean {
		const patterns = ["service unavailable", "busy", "temporarily unavailable", "server error"]
		return patterns.some((pattern) => message.includes(pattern))
	}

	private matchesAccessDeniedPatterns(message: string): boolean {
		const patterns = ["access", "denied", "unauthorized", "forbidden", "permission"]
		return patterns.some((pattern) => message.includes(pattern))
	}

	private matchesNotFoundPatterns(message: string): boolean {
		const patterns = ["not found", "does not exist", "invalid model"]
		return patterns.some((pattern) => message.includes(pattern))
	}

	private matchesNetworkErrorPatterns(message: string): boolean {
		const patterns = ["network", "connection", "dns", "host", "socket"]
		return patterns.some((pattern) => message.includes(pattern))
	}

	private matchesTimeoutPatterns(message: string): boolean {
		const patterns = ["timeout", "timed out", "deadline", "abort"]
		return patterns.some((pattern) => message.includes(pattern))
	}
}
