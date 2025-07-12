/**
 * IErrorHandler - Core interface for error handling in the application
 *
 * This interface defines the contract for error handlers, allowing the core layer
 * to depend on abstractions rather than concrete implementations from the API layer.
 */

import { ErrorContext, ErrorHandlerResponse } from "./types"

/**
 * Interface for handling errors in a consistent manner across the application
 */
export interface IErrorHandler {
	/**
	 * Handle an error and return a standardized response
	 *
	 * @param error - The error to handle (can be any type)
	 * @param context - Context information about where and how the error occurred
	 * @returns A standardized error response with retry information and formatting
	 */
	handle(error: unknown, context: ErrorContext): ErrorHandlerResponse
}
