/**
 * @fileoverview Centralized API logging component exports
 *
 * This module provides:
 * - ApiLogger: Singleton service for logging API requests/responses
 * - withLogging: Generator wrapper for automatic request logging
 * - createLoggingFetch: HTTP fetch wrapper for raw request logging
 * - isLoggingEnabled: Check if logging is enabled (via .env.local or process.env)
 */

// Main logger service
export { ApiLogger, ApiLoggerService } from "./api-logger"

// Generator wrapper helper
export { withLogging } from "./with-logging"
export type { WithLoggingOptions } from "./with-logging"

// HTTP interceptor for raw request logging
export { createLoggingFetch, loggingFetch } from "./http-interceptor"

// Environment configuration
export { isLoggingEnabled, clearEnvCache, getEnvLocalValue } from "./env-config"

// Type definitions
export type {
	ApiLogContext,
	ApiRequestMetadata,
	ApiRequestLog,
	ApiUsageMetrics,
	ApiErrorDetails,
	ApiResponseMetrics,
	ApiResponseLog,
	ApiLogCallback,
	ApiLoggerConfig,
} from "./types"
