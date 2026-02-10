/**
 * RooMessage Type System
 *
 * This module defines the internal message storage format using AI SDK types directly.
 * Message types extend the AI SDK's `ModelMessage` variants with Roo-specific metadata,
 * and content part types (`TextPart`, `ImagePart`, etc.) are re-exported from the AI SDK.
 *
 * @see {@link ../../plans/ext-646-modelmessage-schema-migration-strategy.md} for full migration context
 */

import type { UserModelMessage, AssistantModelMessage, ToolModelMessage, AssistantContent } from "ai"

// Re-export AI SDK content part types for convenience
export type { TextPart, ImagePart, FilePart, ToolCallPart, ToolResultPart } from "ai"

/**
 * `ReasoningPart` is used by the AI SDK in `AssistantContent` but is not directly
 * exported from `"ai"`. We extract it from the `AssistantContent` union to get the
 * exact same type without adding a dependency on `@ai-sdk/provider-utils`.
 */
type AssistantContentPart = Exclude<AssistantContent, string>[number]
export type ReasoningPart = Extract<AssistantContentPart, { type: "reasoning" }>

// ────────────────────────────────────────────────────────────────────────────
// Version
// ────────────────────────────────────────────────────────────────────────────

/** Current format version for the RooMessage storage schema. */
export const ROO_MESSAGE_VERSION = 2 as const

// ────────────────────────────────────────────────────────────────────────────
// Metadata
// ────────────────────────────────────────────────────────────────────────────

/**
 * Metadata fields shared across all RooMessage types.
 * These are Roo-specific extensions that do not exist in the AI SDK types.
 */
export interface RooMessageMetadata {
	/** Unix timestamp (ms) when the message was created. */
	ts?: number
	/** Unique identifier for non-destructive condense summary messages. */
	condenseId?: string
	/** Points to the `condenseId` of the summary that replaces this message. */
	condenseParent?: string
	/** Unique identifier for non-destructive truncation marker messages. */
	truncationId?: string
	/** Points to the `truncationId` of the marker that hides this message. */
	truncationParent?: string
	/** Identifies this message as a truncation boundary marker. */
	isTruncationMarker?: boolean
	/** Identifies this message as a condense summary. */
	isSummary?: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// Message Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * A user-authored message. Content may be a plain string or an array of
 * text, image, and file parts. Extends AI SDK `UserModelMessage` with metadata.
 */
export type RooUserMessage = UserModelMessage & RooMessageMetadata

/**
 * An assistant-authored message. Content may be a plain string or an array of
 * text, tool-call, and reasoning parts. Extends AI SDK `AssistantModelMessage`
 * with metadata and a provider response ID.
 */
export type RooAssistantMessage = AssistantModelMessage &
	RooMessageMetadata & {
		/** Provider response ID (e.g. OpenAI `response.id`). */
		id?: string
	}

/**
 * A tool result message containing one or more tool outputs.
 * Extends AI SDK `ToolModelMessage` with metadata.
 */
export type RooToolMessage = ToolModelMessage & RooMessageMetadata

/**
 * A standalone encrypted reasoning item (e.g. OpenAI Native reasoning format).
 * These are stored as top-level items in the message history, not nested
 * inside an assistant message's content array.
 * This has no AI SDK equivalent.
 */
export interface RooReasoningMessage extends RooMessageMetadata {
	type: "reasoning"
	/** Encrypted reasoning content from the provider. */
	encrypted_content: string
	/** Provider response ID. */
	id?: string
	/** Summary of the reasoning, if provided by the model. */
	summary?: Array<{ type: string; text: string }>
}

/**
 * Union of all message types that can appear in a Roo conversation history.
 */
export type RooMessage = RooUserMessage | RooAssistantMessage | RooToolMessage | RooReasoningMessage

// ────────────────────────────────────────────────────────────────────────────
// Storage Wrapper
// ────────────────────────────────────────────────────────────────────────────

/**
 * Versioned wrapper for persisted message history.
 * The `version` field enables forward-compatible schema migrations.
 */
export interface RooMessageHistory {
	version: 2
	messages: RooMessage[]
}

// ────────────────────────────────────────────────────────────────────────────
// Type Guards
// ────────────────────────────────────────────────────────────────────────────

/**
 * Type guard that checks whether a message is a {@link RooUserMessage}.
 * Matches objects with `role === "user"`.
 */
export function isRooUserMessage(msg: RooMessage): msg is RooUserMessage {
	return "role" in msg && msg.role === "user"
}

/**
 * Type guard that checks whether a message is a {@link RooAssistantMessage}.
 * Matches objects with `role === "assistant"`.
 */
export function isRooAssistantMessage(msg: RooMessage): msg is RooAssistantMessage {
	return "role" in msg && msg.role === "assistant"
}

/**
 * Type guard that checks whether a message is a {@link RooToolMessage}.
 * Matches objects with `role === "tool"`.
 */
export function isRooToolMessage(msg: RooMessage): msg is RooToolMessage {
	return "role" in msg && msg.role === "tool"
}

/**
 * Type guard that checks whether a message is a {@link RooReasoningMessage}.
 * Matches objects with `type === "reasoning"` and no `role` property,
 * distinguishing it from reasoning content parts or assistant messages.
 */
export function isRooReasoningMessage(msg: RooMessage): msg is RooReasoningMessage {
	return "type" in msg && (msg as RooReasoningMessage).type === "reasoning" && !("role" in msg)
}
