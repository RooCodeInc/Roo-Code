import { Task } from "../task/Task"
import { ClineProvider } from "./ClineProvider"
import { saveTaskMessages } from "../task-persistence"
import * as vscode from "vscode"
import pWaitFor from "p-wait-for"
import { t } from "../../i18n"

export interface CheckpointRestoreConfig {
	provider: ClineProvider
	currentCline: Task
	messageTs: number
	messageIndex: number
	checkpoint: { hash: string }
	operation: "delete" | "edit"
	editData?: {
		editedContent: string
		images?: string[]
		apiConversationHistoryIndex: number
	}
}

/**
 * Handles checkpoint restoration for both delete and edit operations.
 * This consolidates the common logic while handling operation-specific behavior.
 *
 * The soft reload mechanism prevents UI flickering by maintaining state during
 * checkpoint restoration operations. This ensures the chat window doesn't flash
 * or lose scroll position when restoring to a previous checkpoint.
 */
export async function handleCheckpointRestoreOperation(config: CheckpointRestoreConfig): Promise<void> {
	const { provider, currentCline, messageTs, checkpoint, operation, editData } = config

	try {
		// Set soft reload flag to prevent UI flickering during checkpoint restoration
		provider.isSoftReloading = true

		// For delete operations, ensure the task is properly aborted to handle any pending ask operations
		// This prevents "Current ask promise was ignored" errors
		// For edit operations, we don't abort because the checkpoint restore will handle it
		if (operation === "delete" && currentCline && !currentCline.abort) {
			currentCline.abortTask()
			// Wait a bit for the abort to complete
			await pWaitFor(() => currentCline.abort === true, {
				timeout: 1000,
				interval: 50,
			}).catch(() => {
				// Continue even if timeout - the abort flag should be set
			})
		}

		// For edit operations, set up pending edit data before restoration
		if (operation === "edit" && editData) {
			const operationId = `task-${currentCline.taskId}`
			provider.setPendingEditOperation(operationId, {
				messageTs,
				editedContent: editData.editedContent,
				images: editData.images,
				messageIndex: config.messageIndex,
				apiConversationHistoryIndex: editData.apiConversationHistoryIndex,
			})
		}

		// Perform the checkpoint restoration
		await currentCline.checkpointRestore({
			ts: messageTs,
			commitHash: checkpoint.hash,
			mode: "restore",
			operation,
		})

		// For delete operations, we need to save messages and reinitialize
		// For edit operations, the reinitialization happens automatically
		// and processes the pending edit
		if (operation === "delete") {
			// Save the updated messages to disk after checkpoint restoration
			await saveTaskMessages({
				messages: currentCline.clineMessages,
				taskId: currentCline.taskId,
				globalStoragePath: provider.contextProxy.globalStorageUri.fsPath,
			})

			// Get the updated history item and reinitialize
			const { historyItem } = await provider.getTaskWithId(currentCline.taskId)
			await provider.createTaskWithHistoryItem(historyItem)
		}
		// For edit operations, the task cancellation in checkpointRestore
		// will trigger reinitialization, which will process pendingEditAfterRestore

		// Reset soft reload flag after operation completes
		provider.isSoftReloading = false

		// Send a refresh without flickering
		await provider.postStateToWebview()
	} catch (error) {
		// Reset soft reload flag on error
		provider.isSoftReloading = false

		console.error(`Error in checkpoint restore (${operation}):`, error)
		vscode.window.showErrorMessage(
			`Error during checkpoint restore: ${error instanceof Error ? error.message : String(error)}`,
		)
		throw error
	}
}

/**
 * Common checkpoint restore validation and initialization utility.
 * This can be used by any checkpoint restore flow that needs to wait for initialization.
 */
export async function waitForClineInitialization(provider: ClineProvider, timeoutMs: number = 3000): Promise<boolean> {
	try {
		await pWaitFor(() => provider.getCurrentTask()?.isInitialized === true, {
			timeout: timeoutMs,
		})
		return true
	} catch (error) {
		vscode.window.showErrorMessage(t("common:errors.checkpoint_timeout"))
		return false
	}
}
