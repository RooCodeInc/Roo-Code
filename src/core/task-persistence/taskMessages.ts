import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"

import type { ClineMessage } from "@roo-code/types"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

/**
 * Redaction utilities:
 * We only need to ensure sensitive file payloads are NOT persisted to disk (ui_messages.json).
 * Centralizing the sanitization in the persistence layer keeps Task.ts simple and avoids scattering
 * redaction logic across multiple call-sites.
 */

function sanitizeMessageText(text?: string): string | undefined {
	if (!text) return text

	// Scrub helper that replaces inner contents of known file payload tags with an omission marker
	const scrub = (s: string): string => {
		// Order matters: scrub more specific tags first
		s = s.replace(/<file_content\b[\s\S]*?<\/file_content>/gi, "<file_content>[omitted]</file_content>")
		s = s.replace(/<content\b[^>]*>[\s\S]*?<\/content>/gi, "<content>[omitted]</content>")
		s = s.replace(/<file\b[^>]*>[\s\S]*?<\/file>/gi, "<file>[omitted]</file>")
		s = s.replace(/<files\b[^>]*>[\s\S]*?<\/files>/gi, "<files>[omitted]</files>")
		return s
	}

	// If JSON payload (e.g. api_req_started), try to sanitize its 'request' field
	try {
		const obj = JSON.parse(text)
		if (obj && typeof obj === "object" && typeof obj.request === "string") {
			obj.request = scrub(obj.request)
			return JSON.stringify(obj)
		}
	} catch {
		// Not JSON; fall through to raw scrub
	}

	return scrub(text)
}

function sanitizeMessages(messages: ClineMessage[]): ClineMessage[] {
	return messages.map((m) => {
		if (typeof (m as any).text === "string") {
			return { ...m, text: sanitizeMessageText((m as any).text) }
		}
		return m
	})
}

export type ReadTaskMessagesOptions = {
	taskId: string
	globalStoragePath: string
}

export async function readTaskMessages({
	taskId,
	globalStoragePath,
}: ReadTaskMessagesOptions): Promise<ClineMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	const fileExists = await fileExistsAtPath(filePath)

	if (fileExists) {
		// Sanitize on read as a safety net for any legacy persisted content
		const raw = JSON.parse(await fs.readFile(filePath, "utf8"))
		return sanitizeMessages(raw)
	}

	return []
}

export type SaveTaskMessagesOptions = {
	messages: ClineMessage[]
	taskId: string
	globalStoragePath: string
}

export async function saveTaskMessages({ messages, taskId, globalStoragePath }: SaveTaskMessagesOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)

	// Persist a sanitized copy to disk to avoid storing sensitive file payloads
	const sanitized = sanitizeMessages(messages)
	await safeWriteJson(filePath, sanitized)
}
