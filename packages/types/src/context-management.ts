/**
 * Context Management Types
 *
 * This module provides type definitions and utility functions for context management events.
 * These events are used to handle different strategies for managing conversation context
 * when approaching token limits.
 *
 * Event Types:
 * - `condense_context`: Context was condensed using AI summarization
 * - `condense_context_error`: An error occurred during context condensation
 * - `sliding_window_truncation`: Context was truncated using sliding window strategy
 */

/**
 * Array of all context management event types.
 * Used for runtime type checking and exhaustiveness verification.
 *
 * @constant
 * @readonly
 */
export const CONTEXT_MANAGEMENT_EVENTS = [
	"condense_context",
	"condense_context_error",
	"sliding_window_truncation",
] as const

/**
 * Union type representing all possible context management event types.
 * Derived from the CONTEXT_MANAGEMENT_EVENTS array for type safety.
 *
 * @example
 * ```typescript
 * const event: ContextManagementEvent = "condense_context"
 * ```
 */
export type ContextManagementEvent = (typeof CONTEXT_MANAGEMENT_EVENTS)[number]

/**
 * Type guard function to check if a value is a valid context management event.
 * Useful for runtime validation and TypeScript type narrowing.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid ContextManagementEvent, `false` otherwise
 *
 * @example
 * ```typescript
 * if (isContextManagementEvent(message.say)) {
 *   // TypeScript now knows message.say is ContextManagementEvent
 *   handleContextManagementEvent(message)
 * }
 * ```
 */
export function isContextManagementEvent(value: unknown): value is ContextManagementEvent {
	return typeof value === "string" && (CONTEXT_MANAGEMENT_EVENTS as readonly string[]).includes(value)
}

/**
 * Helper function for exhaustive switch statements on context management events.
 * Throws an error if an unhandled case is reached, ensuring TypeScript catches
 * missing cases at compile time.
 *
 * @param value - A value that should be of type `never` if all cases are handled
 * @throws Error if called at runtime (indicates unhandled case)
 *
 * @example
 * ```typescript
 * switch (event) {
 *   case "condense_context":
 *     return <CondenseRow />
 *   case "condense_context_error":
 *     return <ErrorRow />
 *   case "sliding_window_truncation":
 *     return <TruncationRow />
 *   default:
 *     assertNever(event) // TypeScript error if any case is missing
 * }
 * ```
 */
export function assertNever(value: never): never {
	throw new Error(`Unhandled context management event: ${JSON.stringify(value)}`)
}
