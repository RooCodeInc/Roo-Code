import { Task } from "../../core/task/Task"
import { getCheckpointService } from "../../core/checkpoints"
import { FileChangeType } from "@roo-code/types"
import { FileChangeManager } from "./FileChangeManager"

/**
 * Updates FCO immediately after a file edit without changing checkpoint timing.
 * This provides immediate visibility of changes while preserving rollback safety.
 */
export async function updateFCOAfterEdit(task: Task): Promise<void> {
	const provider = task.providerRef.deref()
	if (!provider) {
		return
	}

	try {
		const fileChangeManager = provider.getFileChangeManager()
		const checkpointService = await getCheckpointService(task)

		if (!fileChangeManager || !checkpointService || !task.taskId || !task.fileContextTracker) {
			return
		}

		// Get current baseline for FCO
		const baseline = fileChangeManager.getChanges().baseCheckpoint

		// Calculate diff from baseline to current working directory state
		// We use the checkpointService to get a diff from baseline to HEAD (current state)
		try {
			const changes = await checkpointService.getDiff({
				from: baseline,
				to: "HEAD", // Current working directory state
			})

			if (!changes || changes.length === 0) {
				// No changes detected, keep current FCO state
				return
			}

			// Convert checkpoint service changes to FileChange format
			const fileChanges = changes.map((change: any) => {
				const type = (
					change.paths.newFile ? "create" : change.paths.deletedFile ? "delete" : "edit"
				) as FileChangeType

				// Calculate line differences
				let linesAdded = 0
				let linesRemoved = 0

				if (type === "create") {
					linesAdded = change.content.after ? change.content.after.split("\n").length : 0
					linesRemoved = 0
				} else if (type === "delete") {
					linesAdded = 0
					linesRemoved = change.content.before ? change.content.before.split("\n").length : 0
				} else {
					const lineDifferences = FileChangeManager.calculateLineDifferences(
						change.content.before || "",
						change.content.after || "",
					)
					linesAdded = lineDifferences.linesAdded
					linesRemoved = lineDifferences.linesRemoved
				}

				return {
					uri: change.paths.relative,
					type,
					fromCheckpoint: baseline,
					toCheckpoint: "HEAD", // This represents current state, not an actual checkpoint
					linesAdded,
					linesRemoved,
				}
			})

			// Apply per-file baselines to show only incremental changes for accepted files
			const updatedChanges = await fileChangeManager.applyPerFileBaselines(
				fileChanges,
				checkpointService,
				"HEAD", // Current working directory state
			)

			// Get existing files and merge with new changes (maintaining existing files)
			const existingFiles = fileChangeManager.getChanges().files
			const updatedFiles = [...existingFiles]

			// Update or add new files with per-file baseline changes
			updatedChanges.forEach((newChange) => {
				const existingIndex = updatedFiles.findIndex((existing) => existing.uri === newChange.uri)
				if (existingIndex >= 0) {
					updatedFiles[existingIndex] = newChange // Update existing
				} else {
					updatedFiles.push(newChange) // Add new
				}
			})

			// Update FileChangeManager with merged files
			fileChangeManager.setFiles(updatedFiles)

			// Get LLM-only changes for the webview (filters out accepted/rejected files)
			const filteredChangeset = await fileChangeManager.getLLMOnlyChanges(task.taskId, task.fileContextTracker)

			// Send updated changes to webview only if there are changes to show
			if (filteredChangeset.files.length > 0) {
				provider.postMessageToWebview({
					type: "filesChanged",
					filesChanged: filteredChangeset,
				})

				provider.log(
					`[updateFCOAfterEdit] Updated FCO with ${filteredChangeset.files.length} LLM-only file changes`,
				)
			}
		} catch (diffError) {
			// If we can't calculate diff (e.g., baseline is invalid), don't update FCO
			provider.log(`[updateFCOAfterEdit] Failed to calculate diff from ${baseline} to HEAD: ${diffError}`)
		}
	} catch (error) {
		// Non-critical error, don't throw - just log and continue
		provider?.log(`[updateFCOAfterEdit] Error updating FCO after edit: ${error}`)
	}
}
