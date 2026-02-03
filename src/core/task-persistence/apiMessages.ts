import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"

import { Anthropic } from "@anthropic-ai/sdk"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

/**
 * Validates and sanitizes a deserialized API message to ensure it meets type contract.
 * Fixes common corruption issues like undefined/null/non-array content.
 *
 * @param message - Raw deserialized message object
 * @param taskId - Task ID for logging purposes
 * @param index - Message index for logging purposes
 * @returns Validated message or null if the message is irreparably malformed
 */
function validateApiMessage(message: any, taskId: string, index: number): ApiMessage | null {
	// Basic structure validation
	if (!message || typeof message !== "object") {
		console.error(
			`[readApiMessages] Invalid message at index ${index} for task ${taskId}: not an object. Skipping.`,
		)
		return null
	}

	// Validate role
	if (message.role !== "user" && message.role !== "assistant") {
		console.error(
			`[readApiMessages] Invalid message role at index ${index} for task ${taskId}: "${message.role}". Skipping.`,
		)
		return null
	}

	// Validate and fix content field
	if (message.content === undefined || message.content === null) {
		// Content is missing - fix it with empty array for array content or empty string for string content
		console.warn(
			`[readApiMessages] Message at index ${index} for task ${taskId} has undefined/null content. Fixing with empty array.`,
		)
		message.content = []
	} else if (!Array.isArray(message.content) && typeof message.content !== "string") {
		// Content is wrong type - try to recover
		console.warn(
			`[readApiMessages] Message at index ${index} for task ${taskId} has invalid content type (${typeof message.content}). Fixing with empty array.`,
		)
		message.content = []
	} else if (Array.isArray(message.content)) {
		// Content is an array - validate each block has a type
		const validatedContent = message.content.filter((block: any) => {
			if (!block || typeof block !== "object" || typeof block.type !== "string") {
				console.warn(
					`[readApiMessages] Removing invalid content block at index ${index} for task ${taskId}: missing or invalid type field.`,
				)
				return false
			}
			return true
		})
		message.content = validatedContent
	}

	return message as ApiMessage
}

export type ApiMessage = Anthropic.MessageParam & {
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
			if (Array.isArray(parsedData) && parsedData.length === 0) {
				console.error(
					`[Roo-Debug] readApiMessages: Found API conversation history file, but it's empty (parsed as []). TaskId: ${taskId}, Path: ${filePath}`,
				)
			}

			// Validate and sanitize each message
			if (!Array.isArray(parsedData)) {
				console.error(
					`[readApiMessages] Parsed data is not an array for task ${taskId}. Returning empty array.`,
				)
				return []
			}

			const validatedMessages = parsedData
				.map((msg, index) => validateApiMessage(msg, taskId, index))
				.filter((msg): msg is ApiMessage => msg !== null)

			if (validatedMessages.length < parsedData.length) {
				console.warn(
					`[readApiMessages] Filtered out ${parsedData.length - validatedMessages.length} invalid messages for task ${taskId}`,
				)
			}

			return validatedMessages
		} catch (error) {
			console.error(
				`[Roo-Debug] readApiMessages: Error parsing API conversation history file. TaskId: ${taskId}, Path: ${filePath}, Error: ${error}`,
			)
			throw error
		}
	} else {
		const oldPath = path.join(taskDir, "claude_messages.json")

		if (await fileExistsAtPath(oldPath)) {
			const fileContent = await fs.readFile(oldPath, "utf8")
			try {
				const parsedData = JSON.parse(fileContent)
				if (Array.isArray(parsedData) && parsedData.length === 0) {
					console.error(
						`[Roo-Debug] readApiMessages: Found OLD API conversation history file (claude_messages.json), but it's empty (parsed as []). TaskId: ${taskId}, Path: ${oldPath}`,
					)
				}

				// Validate and sanitize each message
				if (!Array.isArray(parsedData)) {
					console.error(
						`[readApiMessages] Parsed old data is not an array for task ${taskId}. Returning empty array.`,
					)
					return []
				}

				const validatedMessages = parsedData
					.map((msg, index) => validateApiMessage(msg, taskId, index))
					.filter((msg): msg is ApiMessage => msg !== null)

				if (validatedMessages.length < parsedData.length) {
					console.warn(
						`[readApiMessages] Filtered out ${parsedData.length - validatedMessages.length} invalid messages from old format for task ${taskId}`,
					)
				}

				await fs.unlink(oldPath)
				return validatedMessages
			} catch (error) {
				console.error(
					`[Roo-Debug] readApiMessages: Error parsing OLD API conversation history file (claude_messages.json). TaskId: ${taskId}, Path: ${oldPath}, Error: ${error}`,
				)
				// DO NOT unlink oldPath if parsing failed, throw error instead.
				throw error
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
