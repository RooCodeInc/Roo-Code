import { FileChange, FileChangeset, FileChangeType } from "@roo-code/types"
import type { FileContextTracker } from "../../core/context-tracking/FileContextTracker"

/**
 * Simplified FileChangeManager - Pure diff calculation service
 * No complex persistence, events, or tool integration
 */
export class FileChangeManager {
	private changeset: FileChangeset
	private acceptedBaselines: Map<string, string> // uri -> accepted baseline checkpoint

	constructor(baseCheckpoint: string) {
		this.changeset = {
			baseCheckpoint,
			files: [],
		}
		this.acceptedBaselines = new Map()
	}

	/**
	 * Get current changeset - visibility determined by actual diffs
	 */
	public getChanges(): FileChangeset {
		return this.changeset
	}

	/**
	 * Get changeset filtered to only show LLM-modified files
	 */
	public async getLLMOnlyChanges(taskId: string, fileContextTracker: FileContextTracker): Promise<FileChangeset> {
		// Get task metadata to determine which files were modified by LLM
		const taskMetadata = await fileContextTracker.getTaskMetadata(taskId)

		// Get files that were modified by LLM (record_source: "roo_edited")
		const llmModifiedFiles = new Set(
			taskMetadata.files_in_context
				.filter((entry) => entry.record_source === "roo_edited")
				.map((entry) => entry.path),
		)

		// Filter changeset to only include LLM-modified files that haven't been accepted
		const filteredFiles = this.changeset.files.filter((file) => {
			return llmModifiedFiles.has(file.uri) && !this.acceptedBaselines.has(file.uri) // Not accepted (no baseline set)
		})

		return {
			...this.changeset,
			files: filteredFiles,
		}
	}

	/**
	 * Get a specific file change
	 */
	public getFileChange(uri: string): FileChange | undefined {
		return this.changeset.files.find((file) => file.uri === uri)
	}

	/**
	 * Accept a specific file change
	 */
	public async acceptChange(uri: string): Promise<void> {
		const file = this.getFileChange(uri)
		if (file) {
			// Set baseline - file will disappear from FCO naturally (no diff from baseline)
			this.acceptedBaselines.set(uri, file.toCheckpoint)
		}
	}

	/**
	 * Reject a specific file change
	 */
	public async rejectChange(uri: string): Promise<void> {
		// Remove the file from current changeset - it will be reverted by FCOMessageHandler
		// If file is edited again after reversion, it will reappear via updateFCOAfterEdit
		this.changeset.files = this.changeset.files.filter((file) => file.uri !== uri)
	}

	/**
	 * Accept all file changes
	 */
	public async acceptAll(): Promise<void> {
		this.changeset.files.forEach((file) => {
			// Set baseline for each file
			this.acceptedBaselines.set(file.uri, file.toCheckpoint)
		})
	}

	/**
	 * Reject all file changes
	 */
	public async rejectAll(): Promise<void> {
		// Clear all files from current changeset - they will be reverted by FCOMessageHandler
		// If files are edited again after reversion, they will reappear via updateFCOAfterEdit
		this.changeset.files = []
	}

	/**
	 * Update the baseline checkpoint and recalculate changes
	 */
	public async updateBaseline(
		newBaselineCheckpoint: string,
		_getDiff?: (from: string, to: string) => Promise<{ filePath: string; content: string }[]>,
		_checkpointService?: {
			checkpoints: string[]
			baseHash?: string
		},
	): Promise<void> {
		this.changeset.baseCheckpoint = newBaselineCheckpoint

		// Simple approach: request fresh calculation from backend
		// The actual diff calculation should be handled by the checkpoint service
		this.changeset.files = []

		// Clear accepted baselines - baseline change means we're starting fresh
		// This happens during checkpoint restore (time travel) where we want a clean slate
		this.acceptedBaselines.clear()
	}

	/**
	 * Set the files for the changeset (called by backend when files change)
	 * Preserves existing accept/reject state for files with the same URI
	 */
	public setFiles(files: FileChange[]): void {
		this.changeset.files = files
	}

	/**
	 * Clear accepted baselines (called when new checkpoint created)
	 */
	public clearFileStates(): void {
		this.acceptedBaselines.clear()
	}

	/**
	 * Apply per-file baselines to a changeset for incremental diff calculation
	 * For files that have been accepted, calculate diff from their acceptance point instead of global baseline
	 */
	public async applyPerFileBaselines(
		baseChanges: FileChange[],
		checkpointService: any,
		currentCheckpoint: string,
	): Promise<FileChange[]> {
		const updatedChanges: FileChange[] = []

		for (const change of baseChanges) {
			// Get accepted baseline for this file (null = use global baseline)
			const acceptedBaseline = this.acceptedBaselines.get(change.uri)

			if (acceptedBaseline) {
				// This file was accepted before - calculate incremental diff from acceptance point
				try {
					const incrementalChanges = await checkpointService.getDiff({
						from: acceptedBaseline,
						to: currentCheckpoint,
					})

					// Find this specific file in the incremental diff
					const incrementalChange = incrementalChanges?.find((c: any) => c.paths.relative === change.uri)

					if (incrementalChange) {
						// Convert to FileChange with per-file baseline
						const type = (
							incrementalChange.paths.newFile
								? "create"
								: incrementalChange.paths.deletedFile
									? "delete"
									: "edit"
						) as FileChangeType

						let linesAdded = 0
						let linesRemoved = 0

						if (type === "create") {
							linesAdded = incrementalChange.content.after
								? incrementalChange.content.after.split("\n").length
								: 0
							linesRemoved = 0
						} else if (type === "delete") {
							linesAdded = 0
							linesRemoved = incrementalChange.content.before
								? incrementalChange.content.before.split("\n").length
								: 0
						} else {
							const lineDifferences = FileChangeManager.calculateLineDifferences(
								incrementalChange.content.before || "",
								incrementalChange.content.after || "",
							)
							linesAdded = lineDifferences.linesAdded
							linesRemoved = lineDifferences.linesRemoved
						}

						updatedChanges.push({
							uri: change.uri,
							type,
							fromCheckpoint: acceptedBaseline, // Use per-file baseline
							toCheckpoint: currentCheckpoint,
							linesAdded,
							linesRemoved,
						})
					}
					// If no incremental change found, file hasn't changed since acceptance - don't include it
				} catch (error) {
					// If we can't calculate incremental diff, fall back to original change
					updatedChanges.push(change)
				}
			} else {
				// File was never accepted - use original change
				updatedChanges.push(change)
			}
		}

		return updatedChanges
	}

	/**
	 * Calculate line differences between two file contents
	 * Uses a simple line-by-line comparison to count actual changes
	 */
	public static calculateLineDifferences(
		originalContent: string,
		newContent: string,
	): { linesAdded: number; linesRemoved: number } {
		const originalLines = originalContent === "" ? [] : originalContent.split("\n")
		const newLines = newContent === "" ? [] : newContent.split("\n")

		// For proper diff calculation, we need to compare line by line
		// This is a simplified approach that works well for most cases

		const maxLines = Math.max(originalLines.length, newLines.length)
		let linesAdded = 0
		let linesRemoved = 0

		// Compare each line position
		for (let i = 0; i < maxLines; i++) {
			const originalLine = i < originalLines.length ? originalLines[i] : undefined
			const newLine = i < newLines.length ? newLines[i] : undefined

			if (originalLine === undefined && newLine !== undefined) {
				// Line was added
				linesAdded++
			} else if (originalLine !== undefined && newLine === undefined) {
				// Line was removed
				linesRemoved++
			} else if (originalLine !== newLine) {
				// Line was modified (count as both removed and added)
				linesRemoved++
				linesAdded++
			}
			// If lines are identical, no change
		}

		return { linesAdded, linesRemoved }
	}

	/**
	 * Dispose of the manager (for compatibility)
	 */
	public dispose(): void {
		this.changeset.files = []
		this.acceptedBaselines.clear()
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
		super(message || originalError?.message || "File change operation failed")
		this.name = "FileChangeError"
	}
}
