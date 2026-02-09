import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

import type { TextPart, ImagePart, FilePart, ToolCallPart, ToolResultPart } from "ai"

// ---------------------------------------------------------------------------
// AI SDK content part types (re-exported from "ai" package)
// Plus custom extensions for types not covered by the AI SDK.
// ---------------------------------------------------------------------------

/**
 * Reasoning content part — matches AI SDK's internal ReasoningPart from @ai-sdk/provider-utils.
 * Defined locally because the `ai` package does not re-export it.
 */
export interface ReasoningPart {
	type: "reasoning"
	text: string
	providerOptions?: Record<string, Record<string, unknown>>
}

/**
 * Custom type for Anthropic's redacted thinking blocks — no AI SDK equivalent.
 */
export interface RedactedReasoningPart {
	type: "redacted_thinking"
	data: string
}

/**
 * Union of all content block types used in Roo messages.
 * Uses AI SDK standard types + our custom extension for redacted thinking.
 */
export type RooContentBlock =
	| TextPart
	| ImagePart
	| FilePart
	| ReasoningPart
	| ToolCallPart
	| ToolResultPart
	| RedactedReasoningPart

// ---------------------------------------------------------------------------
// Roo message param — the provider-agnostic message format
// ---------------------------------------------------------------------------

export interface RooMessageParam {
	role: "user" | "assistant"
	content: string | RooContentBlock[]
}

// ---------------------------------------------------------------------------
// Roo-specific metadata carried on every API conversation message
// ---------------------------------------------------------------------------

export interface RooMessageMetadata {
	ts?: number
	isSummary?: boolean
	id?: string
	// For reasoning items stored in API history
	type?: "reasoning"
	summary?: any[]
	encrypted_content?: string
	text?: string
	// For OpenRouter reasoning_details array format (used by Gemini 3, etc.)
	reasoning_details?: any[]
	// For DeepSeek/Z.ai interleaved thinking: reasoning_content that must be preserved during tool call sequences
	// See: https://api-docs.deepseek.com/guides/thinking_mode#tool-calls
	reasoning_content?: string
	// For non-destructive condense: unique identifier for summary messages
	condenseId?: string
	// For non-destructive condense: points to the condenseId of the summary that replaces this message
	// Messages with condenseParent are filtered out when sending to API if the summary exists
	condenseParent?: string
	// For non-destructive truncation: unique identifier for truncation marker messages
	truncationId?: string
	// For non-destructive truncation: points to the truncationId of the marker that hides this message
	// Messages with truncationParent are filtered out when sending to API if the marker exists
	truncationParent?: string
	// Identifies a message as a truncation boundary marker
	isTruncationMarker?: boolean
}

// ---------------------------------------------------------------------------
// ApiMessage — the primary persistence type for conversation history
// ---------------------------------------------------------------------------

export type ApiMessage = RooMessageParam & RooMessageMetadata

// ---------------------------------------------------------------------------
// Backward-compatible aliases — these will be removed once all consumers are migrated
// ---------------------------------------------------------------------------

/** @deprecated Use TextPart from "ai" */
export type NeutralTextBlock = TextPart
/** @deprecated Use ToolCallPart from "ai" */
export type NeutralToolUseBlock = ToolCallPart
/** @deprecated Use ToolResultPart from "ai" */
export type NeutralToolResultBlock = ToolResultPart
/** @deprecated Use ImagePart from "ai" */
export type NeutralImageBlock = ImagePart
/** @deprecated Use ReasoningPart from "ai" */
export type NeutralThinkingBlock = ReasoningPart
/** @deprecated Use RedactedReasoningPart */
export type NeutralRedactedThinkingBlock = RedactedReasoningPart
/** @deprecated Use RooContentBlock */
export type NeutralContentBlock = RooContentBlock
/** @deprecated Use RooMessageParam */
export type NeutralMessageParam = RooMessageParam

// ---------------------------------------------------------------------------
// Migration: old "Neutral" format → AI SDK format
// ---------------------------------------------------------------------------

/**
 * Migrate a single content block from old Neutral format to AI SDK format.
 * Blocks already in the new format pass through unchanged (idempotent).
 *
 * Old formats detected by `type` field:
 *  - "tool_use"  → "tool-call"
 *  - "tool_result" → "tool-result"
 *  - "thinking"  → "reasoning"
 *  - "image" with `source.type === "base64"` → "image" with `image` + `mediaType`
 *  - "document" with `source` → "file" with `data` + `mediaType`
 */
function migrateContentBlock(block: Record<string, unknown>): Record<string, unknown> {
	if (block == null || typeof block !== "object") {
		return block
	}

	const type = block.type as string | undefined

	switch (type) {
		// ----- tool_use → tool-call -----
		case "tool_use":
			return {
				type: "tool-call" as const,
				toolCallId: block.id ?? "",
				toolName: block.name ?? "",
				input: block.input ?? {},
			}

		// ----- tool_result → tool-result -----
		case "tool_result":
			return {
				type: "tool-result" as const,
				toolCallId: block.tool_use_id ?? "",
				toolName: "",
				output: convertToolResultContent(block.content),
				...(block.is_error != null ? { isError: Boolean(block.is_error) } : {}),
			}

		// ----- thinking → reasoning -----
		case "thinking":
			return {
				type: "reasoning" as const,
				text: (block.thinking as string) ?? "",
				...(block.signature != null
					? {
							providerOptions: {
								anthropic: { thinkingSignature: block.signature },
							},
						}
					: {}),
			}

		// ----- image with old base64 source → image with data + mediaType -----
		case "image": {
			const source = block.source as Record<string, unknown> | undefined
			if (source && source.type === "base64" && source.data != null) {
				return {
					type: "image" as const,
					image: source.data,
					mediaType: source.media_type ?? "image/png",
				}
			}
			// Already in new format or unknown shape — pass through
			return block
		}

		// ----- document → file -----
		case "document": {
			const docSource = block.source as Record<string, unknown> | undefined
			if (docSource && docSource.data != null) {
				return {
					type: "file" as const,
					data: docSource.data,
					mediaType: docSource.media_type ?? "application/pdf",
				}
			}
			return block
		}

		// Already new format or unrecognized — pass through unchanged
		default:
			return block
	}
}

/**
 * Convert old tool_result `content` field to new `output` discriminated union.
 *
 * - string → `{ type: "text", value: theString }`
 * - array  → `{ type: "content", value: migratedArray }`
 * - null/undefined → `{ type: "text", value: "" }`
 */
function convertToolResultContent(
	content: unknown,
): { type: "text"; value: string } | { type: "content"; value: unknown[] } {
	if (content == null) {
		return { type: "text" as const, value: "" }
	}
	if (typeof content === "string") {
		return { type: "text" as const, value: content }
	}
	if (Array.isArray(content)) {
		return {
			type: "content" as const,
			value: content.map((item: unknown) =>
				typeof item === "object" && item !== null ? migrateContentBlock(item as Record<string, unknown>) : item,
			),
		}
	}
	// Unexpected shape — wrap as JSON text
	return { type: "text" as const, value: typeof content === "string" ? content : JSON.stringify(content) }
}

/**
 * Migrate an array of ApiMessages from old "Neutral" format to AI SDK format.
 *
 * **Idempotent**: if the data is already in the new format it passes through
 * unchanged. Detection is based on the `type` field of each content block
 * (e.g. `"tool_use"` = old, `"tool-call"` = new).
 *
 * This is automatically called by `readApiMessages()` when loading from disk.
 */
export function migrateApiMessages(messages: ApiMessage[]): ApiMessage[] {
	return messages.map((msg) => {
		// String content doesn't need migration
		if (typeof msg.content === "string" || !Array.isArray(msg.content)) {
			return msg
		}

		// Check if any block needs migration by looking for old-format type values
		const hasOldFormat = msg.content.some((block: unknown) => {
			if (block == null || typeof block !== "object") return false
			const t = (block as Record<string, unknown>).type
			return (
				t === "tool_use" ||
				t === "tool_result" ||
				t === "thinking" ||
				isOldImageBlock(block) ||
				isOldDocumentBlock(block)
			)
		})

		if (!hasOldFormat) {
			return msg
		}

		return {
			...msg,
			content: msg.content.map((block: unknown) =>
				typeof block === "object" && block !== null
					? (migrateContentBlock(block as Record<string, unknown>) as unknown as RooContentBlock)
					: block,
			) as RooContentBlock[],
		}
	})
}

/** Detect old-format image block: has `source.type === "base64"` instead of `image` field */
function isOldImageBlock(block: unknown): boolean {
	if (block == null || typeof block !== "object") return false
	const b = block as Record<string, unknown>
	if (b.type !== "image") return false
	const source = b.source as Record<string, unknown> | undefined
	return source != null && source.type === "base64"
}

/** Detect old-format document block: type === "document" (new format is "file") */
function isOldDocumentBlock(block: unknown): boolean {
	if (block == null || typeof block !== "object") return false
	return (block as Record<string, unknown>).type === "document"
}

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

export async function readApiMessages({
	taskId,
	globalStoragePath,
}: {
	taskId: string
	globalStoragePath: string
}): Promise<ApiMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

	if (await fileExistsAtPath(filePath)) {
		const fileContent = await fs.readFile(filePath, "utf8")
		try {
			const parsedData = JSON.parse(fileContent)
			if (!Array.isArray(parsedData)) {
				console.warn(
					`[readApiMessages] Parsed data is not an array (got ${typeof parsedData}), returning empty. TaskId: ${taskId}, Path: ${filePath}`,
				)
				return []
			}
			if (parsedData.length === 0) {
				console.error(
					`[Roo-Debug] readApiMessages: Found API conversation history file, but it's empty (parsed as []). TaskId: ${taskId}, Path: ${filePath}`,
				)
			}
			return migrateApiMessages(parsedData)
		} catch (error) {
			console.warn(
				`[readApiMessages] Error parsing API conversation history file, returning empty. TaskId: ${taskId}, Path: ${filePath}, Error: ${error}`,
			)
			return []
		}
	} else {
		const oldPath = path.join(taskDir, "claude_messages.json")

		if (await fileExistsAtPath(oldPath)) {
			const fileContent = await fs.readFile(oldPath, "utf8")
			try {
				const parsedData = JSON.parse(fileContent)
				if (!Array.isArray(parsedData)) {
					console.warn(
						`[readApiMessages] Parsed OLD data is not an array (got ${typeof parsedData}), returning empty. TaskId: ${taskId}, Path: ${oldPath}`,
					)
					return []
				}
				if (parsedData.length === 0) {
					console.error(
						`[Roo-Debug] readApiMessages: Found OLD API conversation history file (claude_messages.json), but it's empty (parsed as []). TaskId: ${taskId}, Path: ${oldPath}`,
					)
				}
				await fs.unlink(oldPath)
				return migrateApiMessages(parsedData)
			} catch (error) {
				console.warn(
					`[readApiMessages] Error parsing OLD API conversation history file (claude_messages.json), returning empty. TaskId: ${taskId}, Path: ${oldPath}, Error: ${error}`,
				)
				// DO NOT unlink oldPath if parsing failed.
				return []
			}
		}
	}

	// If we reach here, neither the new nor the old history file was found.
	console.error(
		`[Roo-Debug] readApiMessages: API conversation history file not found for taskId: ${taskId}. Expected at: ${filePath}`,
	)
	return []
}

export async function saveApiMessages({
	messages,
	taskId,
	globalStoragePath,
}: {
	messages: ApiMessage[]
	taskId: string
	globalStoragePath: string
}) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)
	await safeWriteJson(filePath, messages)
}
