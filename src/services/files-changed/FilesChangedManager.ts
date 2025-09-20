import { FileChange, FileChangeset } from "@roo-code/types"
import type { FileContextTracker } from "../../core/context-tracking/FileContextTracker"

/**
 * Minimal in-memory store for Files Changed Overview state.
 * Entries are added/updated one at a time based on the latest diff event.
 */
export class FilesChangedManager {
	private baseCheckpoint: string
	private files = new Map<string, FileChange>()

	constructor(baseCheckpoint: string = "HEAD") {
		this.baseCheckpoint = baseCheckpoint
	}

	public getChanges(): FileChangeset {
		return {
			baseCheckpoint: this.baseCheckpoint,
			files: Array.from(this.files.values()),
		}
	}

	/**
	 * For compatibility with existing handler flow. Since we only ever add
	 * `roo_edited` entries, just return the current changeset.
	 */
	public async getLLMOnlyChanges(_taskId: string, _fileContextTracker: FileContextTracker): Promise<FileChangeset> {
		return this.getChanges()
	}

	public getFileChange(uri: string): FileChange | undefined {
		return this.files.get(uri)
	}

	public upsertFile(change: FileChange): void {
		this.files.set(change.uri, change)
	}

	public removeFile(uri: string): void {
		this.files.delete(uri)
	}

	public acceptChange(uri: string): void {
		this.removeFile(uri)
	}

	public rejectChange(uri: string): void {
		this.removeFile(uri)
	}

	public acceptAll(): void {
		this.clearFiles()
	}

	public rejectAll(): void {
		this.clearFiles()
	}

	public setBaseline(checkpoint: string): void {
		this.baseCheckpoint = checkpoint
	}

	public reset(checkpoint: string): void {
		this.baseCheckpoint = checkpoint
		this.clearFiles()
	}

	public clearFiles(): void {
		this.files.clear()
	}

	public dispose(): void {
		this.clearFiles()
	}

	/**
	 * Utility helper for callers that need to compute diff stats themselves.
	 */
	public static calculateLineDifferences(
		originalContent: string,
		newContent: string,
	): { linesAdded: number; linesRemoved: number } {
		const originalLines = originalContent === "" ? [] : originalContent.split("\n")
		const newLines = newContent === "" ? [] : newContent.split("\n")

		const maxLines = Math.max(originalLines.length, newLines.length)
		let linesAdded = 0
		let linesRemoved = 0

		for (let i = 0; i < maxLines; i++) {
			const originalLine = i < originalLines.length ? originalLines[i] : undefined
			const newLine = i < newLines.length ? newLines[i] : undefined

			if (originalLine === undefined && newLine !== undefined) {
				linesAdded++
			} else if (originalLine !== undefined && newLine === undefined) {
				linesRemoved++
			} else if (originalLine !== newLine) {
				linesAdded++
				linesRemoved++
			}
		}

		return { linesAdded, linesRemoved }
	}
}

// Export the error types for backward compatibility
export enum FileChangeErrorType {
	PERSISTENCE_FAILED = "PERSISTENCE_FAILED",
	FILE_NOT_FOUND = "FILE_NOT_FOUND",
	PERMISSION_DENIED = "PERMISSION_DENIED",
	DISK_FULL = "DISK_FULL",
	GENERIC_ERROR = "GENERIC_ERROR",
}

export class FileChangeError extends Error {
	constructor(
		public type: FileChangeErrorType,
		public uri?: string,
		message?: string,
		public originalError?: Error,
	) {
		super(message)
		this.name = "FileChangeError"
	}
}
