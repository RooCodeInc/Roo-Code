import * as fs from "fs/promises"
import type { ApiMessage } from "../task-persistence/apiMessages"
import type { TaskMetadata, FileMetadataEntry } from "./FileContextTrackerTypes"

/**
 * Reasons why a file may or may not need to be re-read
 */
export type FileContextStatusReason =
	| "never_read" // No prior read record exists
	| "file_modified" // File has been modified on disk since last read
	| "message_deleted" // The API message containing file content no longer exists
	| "content_condensed" // The content was summarized during context condensation
	| "content_truncated" // The content was removed during sliding window truncation
	| "content_current" // File unchanged AND content still in effective context

/**
 * Result of checking whether a file needs to be re-read
 */
export type FileContextStatus = {
	shouldReRead: boolean
	reason: FileContextStatusReason
	lastReadDate?: number
}

/**
 * Checks whether a file needs to be re-read based on:
 * 1. File modification time vs last read time
 * 2. Whether the message containing the file content is still in effective context
 *
 * @param filePath - Relative path to the file
 * @param fullPath - Full absolute path to the file
 * @param metadata - Task metadata containing file context tracking info
 * @param messages - Current API message history
 * @returns Status indicating whether the file should be re-read and why
 */
export async function checkFileContextStatus(
	filePath: string,
	fullPath: string,
	metadata: TaskMetadata,
	messages: ApiMessage[],
): Promise<FileContextStatus> {
	// Find the latest active entry for this file
	const latestEntry = getLatestActiveEntry(metadata, filePath)

	if (!latestEntry || !latestEntry.roo_read_date) {
		return { shouldReRead: true, reason: "never_read" }
	}

	// 1. Check if file changed on disk using mtime
	try {
		const stats = await fs.stat(fullPath)
		if (stats.mtimeMs > latestEntry.roo_read_date) {
			return {
				shouldReRead: true,
				reason: "file_modified",
				lastReadDate: latestEntry.roo_read_date,
			}
		}
	} catch {
		// File might not exist, let the read_file tool handle this error
		return { shouldReRead: true, reason: "file_modified" }
	}

	// 2. Check if the message containing file content is still in effective context
	if (latestEntry.containingMessageTs) {
		const containingMsg = messages.find((m) => m.ts === latestEntry.containingMessageTs)

		if (!containingMsg) {
			return {
				shouldReRead: true,
				reason: "message_deleted",
				lastReadDate: latestEntry.roo_read_date,
			}
		}

		// Check if message was condensed (content replaced with summary)
		if (containingMsg.condenseParent) {
			const summaryExists = messages.some((m) => m.isSummary && m.condenseId === containingMsg.condenseParent)
			if (summaryExists) {
				return {
					shouldReRead: true,
					reason: "content_condensed",
					lastReadDate: latestEntry.roo_read_date,
				}
			}
		}

		// Check if message was truncated (hidden from context)
		if (containingMsg.truncationParent) {
			const truncationMarkerExists = messages.some(
				(m) => m.isTruncationMarker && m.truncationId === containingMsg.truncationParent,
			)
			if (truncationMarkerExists) {
				return {
					shouldReRead: true,
					reason: "content_truncated",
					lastReadDate: latestEntry.roo_read_date,
				}
			}
		}
	}

	// File unchanged AND content still in effective context
	return {
		shouldReRead: false,
		reason: "content_current",
		lastReadDate: latestEntry.roo_read_date,
	}
}

/**
 * Gets the latest active entry for a file from the task metadata
 *
 * @param metadata - Task metadata containing file context tracking info
 * @param filePath - Relative path to the file
 * @returns The most recent active entry for the file, or null if none exists
 */
function getLatestActiveEntry(metadata: TaskMetadata, filePath: string): FileMetadataEntry | null {
	const entries = metadata.files_in_context
		.filter((e) => e.path === filePath && e.record_state === "active" && e.roo_read_date)
		.sort((a, b) => (b.roo_read_date ?? 0) - (a.roo_read_date ?? 0))

	return entries[0] ?? null
}

/**
 * Generates a human-readable notice explaining why a file is being re-read
 *
 * @param reason - The reason the file needs to be re-read
 * @returns A descriptive string explaining the re-read reason
 */
export function getReReadNotice(reason: FileContextStatusReason): string | undefined {
	switch (reason) {
		case "content_condensed":
			return "Previous content was summarized during context condensation."
		case "content_truncated":
			return "Previous content was removed during sliding window truncation."
		case "file_modified":
			return "File has been modified since last read."
		case "message_deleted":
			return "Previous message containing file content was deleted."
		case "never_read":
		case "content_current":
		default:
			return undefined
	}
}
