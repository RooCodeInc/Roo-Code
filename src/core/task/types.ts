/**
 * Type definitions for Task-related metadata
 */

/**
 * Extended ClineMessage type with metadata
 */
export interface ClineMessageWithMetadata {
	metadata?: {
		[key: string]: any
	}
}
