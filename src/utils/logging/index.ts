/**
 * @fileoverview Main entry point for the compact logging system
 * Provides a default logger instance with environment-based configuration
 */

import { CompactLogger } from "./CompactLogger"
import { CompactTransport } from "./CompactTransport"

/**
 * No-operation logger implementation for environments where logging is disabled
 */
const noopLogger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
	fatal: () => {},
	child: () => noopLogger,
	close: () => {},
}

/**
 * Create logger instance based on environment and configuration
 * - Test environment: Uses CompactLogger for test visibility
 * - Production: Uses CompactLogger with configurable log level
 * - Can be disabled via ROO_DEBUG_LOGGING environment variable
 */
function createLogger() {
	// Always use CompactLogger in test environment
	if (process.env.NODE_ENV === "test") {
		return new CompactLogger()
	}

	// Check if debug logging is explicitly disabled
	if (process.env.ROO_DEBUG_LOGGING === "false") {
		return noopLogger
	}

	// Create logger with configurable level (default to 'info')
	const logLevel = process.env.ROO_LOG_LEVEL || "info"
	const transport = new CompactTransport({ level: logLevel as any })
	return new CompactLogger(transport)
}

/**
 * Default logger instance
 * Configured based on environment variables:
 * - ROO_DEBUG_LOGGING: Set to "false" to disable all logging
 * - ROO_LOG_LEVEL: Set to "debug", "info", "warn", "error", or "fatal" (default: "info")
 */
export const logger = createLogger()
