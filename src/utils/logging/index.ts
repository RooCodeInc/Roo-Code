/**
 * @fileoverview Main entry point for the compact logging system
 * Provides a default logger instance with Jest environment detection
 */

import { CompactLogger } from "./CompactLogger"

/**
 * No-operation logger implementation for production environments
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
 * Default logger instance
 * Uses CompactLogger for test environment, switches to noop logger in production
 *
 * Note: For API logging, use the ApiLogger from src/api/core/logging which
 * outputs to console.log when ROO_CODE_API_LOGGING=true
 */
export const logger = process.env.NODE_ENV === "test" ? new CompactLogger() : noopLogger
