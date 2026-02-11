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

import type { TextPart, ImagePart, FilePart, ToolCallPart, ToolResultPart } from "ai"

/**
 * Union of content parts that can appear in a user message's content array.
 */
export type UserContentPart = TextPart | ImagePart | FilePart

/**
 * A minimal content block with a type discriminator and optional text.
 * Structurally compatible with Anthropic's `TextBlockParam` (which `countTokens` accepts)
 * without importing provider-specific types.
 */
export type ContentBlockParam = { type: string; text?: string }

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

/**
 * Union of RooMessage types that have a `role` property (i.e. everything except
 * {@link RooReasoningMessage}). Useful for narrowing before accessing `.role` or `.content`.
 */
export type RooRoleMessage = RooUserMessage | RooAssistantMessage | RooToolMessage

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

/**
 * Type guard that checks whether a message is a {@link RooRoleMessage}
 * (i.e. any message with a `role` property — user, assistant, or tool).
 */
export function isRooRoleMessage(msg: RooMessage): msg is RooRoleMessage {
	return "role" in msg
}

// ────────────────────────────────────────────────────────────────────────────
// Content Part Type Guards
// ────────────────────────────────────────────────────────────────────────────

/** Type guard for AI SDK `TextPart` content blocks. */
export function isTextPart(part: { type: string }): part is TextPart {
	return part.type === "text"
}

/** Type guard for AI SDK `ToolCallPart` content blocks. */
export function isToolCallPart(part: { type: string }): part is ToolCallPart {
	return part.type === "tool-call"
}

/** Type guard for AI SDK `ToolResultPart` content blocks. */
export function isToolResultPart(part: { type: string }): part is ToolResultPart {
	return part.type === "tool-result"
}

/** Type guard for AI SDK `ImagePart` content blocks. */
export function isImagePart(part: { type: string }): part is ImagePart {
	return part.type === "image"
}

// ────────────────────────────────────────────────────────────────────────────
// Legacy (Anthropic) Block Types — for dual-format backward compatibility
// ────────────────────────────────────────────────────────────────────────────

/** Legacy Anthropic `tool_use` content block shape (persisted data from older versions). */
export interface LegacyToolUseBlock {
	type: "tool_use"
	id: string
	name: string
	input: unknown
}

/** Legacy Anthropic `tool_result` content block shape (persisted data from older versions). */
export interface LegacyToolResultBlock {
	type: "tool_result"
	tool_use_id: string
	content?: string | ContentBlockParam[]
	is_error?: boolean
}

/** Union of AI SDK `ToolCallPart` and legacy Anthropic `tool_use` block. */
export type AnyToolCallBlock = ToolCallPart | LegacyToolUseBlock

/** Union of AI SDK `ToolResultPart` and legacy Anthropic `tool_result` block. */
export type AnyToolResultBlock = ToolResultPart | LegacyToolResultBlock

// ────────────────────────────────────────────────────────────────────────────
// Dual-Format Type Guards
// ────────────────────────────────────────────────────────────────────────────

/** Type guard matching both AI SDK `tool-call` and legacy Anthropic `tool_use` blocks. */
export function isAnyToolCallBlock(block: { type: string }): block is AnyToolCallBlock {
	return block.type === "tool-call" || block.type === "tool_use"
}

/** Type guard matching both AI SDK `tool-result` and legacy Anthropic `tool_result` blocks. */
export function isAnyToolResultBlock(block: { type: string }): block is AnyToolResultBlock {
	return block.type === "tool-result" || block.type === "tool_result"
}

// ────────────────────────────────────────────────────────────────────────────
// Dual-Format Accessor Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Get the tool call ID from either format. */
export function getToolCallId(block: AnyToolCallBlock): string {
	return block.type === "tool-call" ? block.toolCallId : block.id
}

/** Get the tool name from either format. */
export function getToolCallName(block: AnyToolCallBlock): string {
	return block.type === "tool-call" ? block.toolName : block.name
}

/** Get the tool call arguments/input from either format. */
export function getToolCallInput(block: AnyToolCallBlock): unknown {
	return block.input
}

/** Get the referenced tool call ID from a tool result in either format. */
export function getToolResultCallId(block: AnyToolResultBlock): string {
	return block.type === "tool-result" ? block.toolCallId : block.tool_use_id
}

/** Get the tool result content/output from either format. */
export function getToolResultContent(block: AnyToolResultBlock): unknown {
	if (block.type === "tool-result") {
		return block.output
	}
	return block.content
}

/** Get the error flag from a tool result in either format. */
export function getToolResultIsError(block: AnyToolResultBlock): boolean | undefined {
	if (block.type === "tool-result") {
		// AI SDK ToolResultPart has no dedicated error field.
		// We use the established "[ERROR]" prefix convention in text output.
		const output: unknown = block.output
		if (typeof output === "string") {
			return output.trimStart().startsWith("[ERROR]")
		}
		if (Array.isArray(output)) {
			return output.some(
				(item) =>
					typeof item === "object" &&
					item !== null &&
					"type" in item &&
					(item as { type?: string }).type === "text" &&
					"value" in item &&
					typeof (item as { value?: unknown }).value === "string" &&
					(item as { value: string }).value.trimStart().startsWith("[ERROR]"),
			)
		}
		if (
			output &&
			typeof output === "object" &&
			"value" in output &&
			typeof (output as { value: unknown }).value === "string"
		) {
			return (output as { value: string }).value.trimStart().startsWith("[ERROR]")
		}
		return undefined
	}
	return block.is_error
}

/** Set the tool result's reference to a tool call ID, returning a new block. */
export function setToolResultCallId(block: AnyToolResultBlock, id: string): AnyToolResultBlock {
	if (block.type === "tool-result") {
		return { ...block, toolCallId: id }
	}
	return { ...block, tool_use_id: id }
}
