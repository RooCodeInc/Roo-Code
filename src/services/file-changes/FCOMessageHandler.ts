import * as vscode from "vscode"
import { WebviewMessage } from "../../shared/WebviewMessage"
import type { FileChange, FileChangeType } from "@roo-code/types"
import { FileChangeError, FileChangeErrorType, FileChangeManager } from "./FileChangeManager"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { DIFF_VIEW_URI_SCHEME } from "../../integrations/editor/DiffViewProvider"
import { t } from "../../i18n"
import type { CheckpointEventMap } from "../checkpoints/types"
import { ShadowCheckpointService } from "../checkpoints/ShadowCheckpointService"
import type { FileContextTracker } from "../../core/context-tracking/FileContextTracker"
// No experiments migration handler needed anymore; FCO is managed via updateExperimental in webviewMessageHandler

/**
 * Handles FCO-specific webview messages that were previously scattered throughout ClineProvider
 */
export class FCOMessageHandler {
	private isEnabled: boolean = false
	private shouldWaitForNextCheckpoint: boolean = false
	private checkpointEventListener?: (event: CheckpointEventMap["checkpoint"]) => void
	private listenerCheckpointService?: ShadowCheckpointService
	private lastOp: Promise<any> = Promise.resolve()

	private tr(key: string, fallback: string, options?: Record<string, any>): string {
		const translated = t(key, options)
		// In tests, i18n is disabled and returns the key; detect and fall back
		if (!translated || translated === key || /[.:]/.test(translated)) {
			return fallback
		}
		return translated
	}

	constructor(private provider: ClineProvider) {}

	/**
	 * Universal FCO enable/disable handler - ALWAYS waits for next checkpoint when enabled
	 */
	public async handleExperimentToggle(
		enabled: boolean,
		task:
			| { checkpointService?: ShadowCheckpointService; taskId?: string; fileContextTracker?: FileContextTracker }
			| undefined,
	): Promise<void> {
		// Only proceed if state is actually changing
		if (enabled === this.isEnabled) {
			return // No state change - do nothing
		}

		this.isEnabled = enabled

		if (enabled) {
			// UNIVERSAL: Always wait for next checkpoint regardless of task type/state
			this.shouldWaitForNextCheckpoint = true
			this.provider.log("FCO: Enabled, waiting for next checkpoint to establish monitoring baseline")

			// Don't show FCO yet - wait for checkpoint event
			this.clearFCODisplay()

			// Set up checkpoint listener if we have a task
			if (task?.checkpointService) {
				this.setupCheckpointListener(task)
			}
		} else {
			// FCO disabled - cleanup
			this.shouldWaitForNextCheckpoint = false
			this.removeCheckpointListener()
			this.clearFCODisplay()
			this.provider.log("FCO: Disabled")
		}
	}

	/**
	 * Clear FCO display in webview
	 */
	private clearFCODisplay(): void {
		this.provider.postMessageToWebview({
			type: "filesChanged",
			filesChanged: undefined,
		})
	}

	/**
	 * Set up checkpoint event listener for universal baseline management
	 */
	private setupCheckpointListener(
		task:
			| { checkpointService?: ShadowCheckpointService; taskId?: string; fileContextTracker?: FileContextTracker }
			| undefined,
	): void {
		// Remove existing listener if any
		this.removeCheckpointListener()

		// Create new listener for universal checkpoint waiting
		this.checkpointEventListener = async (event: CheckpointEventMap["checkpoint"]) => {
			if (this.isEnabled && this.shouldWaitForNextCheckpoint) {
				// This checkpoint = "FCO monitoring baseline"
				const fileChangeManager = this.provider.getFileChangeManager()
				if (fileChangeManager) {
					await fileChangeManager.updateBaseline(event.fromHash)
					this.shouldWaitForNextCheckpoint = false

					this.provider.log(`FCO: Established monitoring baseline at ${event.fromHash}`)

					// Now start showing changes from this point forward
					if (task?.taskId && task?.fileContextTracker) {
						const filteredChangeset = await fileChangeManager.getLLMOnlyChanges(
							task.taskId,
							task.fileContextTracker,
						)
						this.provider.postMessageToWebview({
							type: "filesChanged",
							filesChanged: filteredChangeset.files.length > 0 ? filteredChangeset : undefined,
						})
					}
				}
			}
		}

		// Add listener to checkpoint service
		if (task?.checkpointService?.on && this.checkpointEventListener) {
			this.listenerCheckpointService = task.checkpointService
			this.listenerCheckpointService.on("checkpoint", this.checkpointEventListener)
		}
	}

	/**
	 * Remove checkpoint event listener
	 */
	private removeCheckpointListener(): void {
		if (this.checkpointEventListener && this.listenerCheckpointService?.off) {
			this.listenerCheckpointService.off("checkpoint", this.checkpointEventListener)
		}
		this.checkpointEventListener = undefined
		this.listenerCheckpointService = undefined
	}

	public cleanup(): void {
		this.removeCheckpointListener()
	}

	/**
	 * Check if a message should be handled by FCO
	 */
	public shouldHandleMessage(message: WebviewMessage): boolean {
		const fcoMessageTypes = [
			"webviewReady",
			"viewDiff",
			"acceptFileChange",
			"rejectFileChange",
			"acceptAllFileChanges",
			"rejectAllFileChanges",
			"filesChangedRequest",
			"filesChangedBaselineUpdate",
		]

		return fcoMessageTypes.includes(message.type)
	}

	/**
	 * Handle FCO-specific messages
	 */
	public async handleMessage(message: WebviewMessage): Promise<void> {
		const task = this.provider.getCurrentTask()

		switch (message.type) {
			case "webviewReady": {
				// Only show FCO if we're not waiting for a checkpoint
				if (this.isEnabled && !this.shouldWaitForNextCheckpoint) {
					// Ensure FileChangeManager is initialized when webview is ready
					let fileChangeManager = this.provider.getFileChangeManager()
					if (!fileChangeManager) {
						fileChangeManager = await this.provider.ensureFileChangeManager()
					}
					if (fileChangeManager && task?.taskId && task?.fileContextTracker) {
						const filteredChangeset = await fileChangeManager.getLLMOnlyChanges(
							task.taskId,
							task.fileContextTracker,
						)
						// Send current view; if empty, explicitly clear stale UI
						this.provider.postMessageToWebview({
							type: "filesChanged",
							filesChanged: filteredChangeset.files.length > 0 ? filteredChangeset : undefined,
						})
					}
				} else if (this.shouldWaitForNextCheckpoint) {
					// FCO is waiting for next checkpoint - clear display
					this.clearFCODisplay()
				}
				// If FCO disabled or can't filter, don't send anything - keep FCO in current state
				break
			}

			case "viewDiff": {
				await this.handleViewDiff(message, task)
				break
			}

			case "acceptFileChange": {
				await this.serialize(() => this.handleAcceptFileChange(message))
				break
			}

			case "rejectFileChange": {
				await this.serialize(() => this.handleRejectFileChange(message))
				break
			}

			case "acceptAllFileChanges": {
				await this.serialize(() => this.handleAcceptAllFileChanges())
				break
			}

			case "rejectAllFileChanges": {
				await this.serialize(() => this.handleRejectAllFileChanges(message))
				break
			}

			case "filesChangedRequest": {
				await this.handleFilesChangedRequest(message, task)
				break
			}

			case "filesChangedBaselineUpdate": {
				await this.handleFilesChangedBaselineUpdate(message, task)
				break
			}
		}
	}

	private async handleViewDiff(
		message: WebviewMessage,
		task: { checkpointService?: ShadowCheckpointService } | undefined,
	): Promise<void> {
		const diffFileChangeManager = this.provider.getFileChangeManager()
		if (message.uri && diffFileChangeManager && task?.checkpointService) {
			// Get the file change information
			const changeset = diffFileChangeManager.getChanges()
			const fileChange = changeset.files.find((f: FileChange) => f.uri === message.uri)

			if (fileChange) {
				try {
					// Get the specific file content from both checkpoints
					const changes = await task.checkpointService.getDiff({
						from: fileChange.fromCheckpoint,
						to: fileChange.toCheckpoint,
					})

					// Find the specific file in the changes
					const fileChangeData = changes.find((change) => change.paths.relative === message.uri)

					if (fileChangeData) {
						await this.showFileDiff(message.uri, fileChangeData)
					} else {
						console.warn(`FCOMessageHandler: No file change data found for URI: ${message.uri}`)
						vscode.window.showInformationMessage(
							this.tr("common:fileChanges.noChangesForFile", `No changes found for ${message.uri}`, {
								uri: message.uri,
							}),
						)
					}
				} catch (error) {
					console.error(`FCOMessageHandler: Failed to open diff for ${message.uri}:`, error)
					vscode.window.showErrorMessage(
						this.tr(
							"common:fileChanges.openDiffFailed",
							`Failed to open diff for ${message.uri}: ${error instanceof Error ? error.message : String(error)}`,
							{
								uri: message.uri,
								error: error instanceof Error ? error.message : String(error),
							},
						),
					)
				}
			} else {
				console.warn(`FCOMessageHandler: File change not found in changeset for URI: ${message.uri}`)
				vscode.window.showInformationMessage(
					this.tr("common:fileChanges.fileChangeNotFound", `File change not found for ${message.uri}`, {
						uri: message.uri,
					}),
				)
			}
		} else {
			console.warn(`FCOMessageHandler: Missing dependencies for viewDiff. URI: ${message.uri}`)
			vscode.window.showErrorMessage(
				this.tr(
					"common:fileChanges.missingDependencies",
					"Unable to view diff - missing required dependencies",
				),
			)
		}
	}

	private async showFileDiff(uri: string, fileChangeData: any): Promise<void> {
		const beforeContent = fileChangeData.content.before || ""
		const afterContent = fileChangeData.content.after || ""

		try {
			const beforeUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${uri}`).with({
				query: Buffer.from(beforeContent).toString("base64"),
			})
			const afterUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${uri}`).with({
				query: Buffer.from(afterContent).toString("base64"),
			})

			await vscode.commands.executeCommand("vscode.diff", beforeUri, afterUri, `${uri}: Before ↔ After`, {
				preview: false,
			})
		} catch (fileError) {
			console.error(
				`Failed to open diff view: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
			)
			vscode.window.showErrorMessage(
				`Failed to open diff view: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
			)
		}
	}

	private async handleAcceptFileChange(message: WebviewMessage): Promise<void> {
		const task = this.provider.getCurrentTask()
		let acceptFileChangeManager = this.provider.getFileChangeManager()
		if (!acceptFileChangeManager) {
			acceptFileChangeManager = await this.provider.ensureFileChangeManager()
		}
		if (message.uri && acceptFileChangeManager && task?.taskId && task?.fileContextTracker) {
			await acceptFileChangeManager.acceptChange(message.uri)

			// Send updated state (clear if now empty)
			const updatedChangeset = await acceptFileChangeManager.getLLMOnlyChanges(
				task.taskId,
				task.fileContextTracker,
			)
			this.provider.postMessageToWebview({
				type: "filesChanged",
				filesChanged: updatedChangeset.files.length > 0 ? updatedChangeset : undefined,
			})

			// If user individually accepted files until list is empty, advance baseline to current
			if (updatedChangeset.files.length === 0 && task?.checkpointService?.getCurrentCheckpoint) {
				const current = task.checkpointService.getCurrentCheckpoint()
				if (current) {
					await acceptFileChangeManager.updateBaseline(current)
				}
			}
		}
	}

	private async handleRejectFileChange(message: WebviewMessage): Promise<void> {
		console.log(`[FCO] handleRejectFileChange called for URI: ${message.uri}`)
		let rejectFileChangeManager = this.provider.getFileChangeManager()
		if (!rejectFileChangeManager) {
			rejectFileChangeManager = await this.provider.ensureFileChangeManager()
		}
		if (!message.uri || !rejectFileChangeManager) {
			return
		}

		try {
			// Get the file change details to know which checkpoint to restore from
			const fileChange = rejectFileChangeManager.getFileChange(message.uri)
			if (!fileChange) {
				console.error(`[FCO] File change not found for URI: ${message.uri}`)
				return
			}

			// Get the current task and checkpoint service
			const currentTask = this.provider.getCurrentTask()
			if (!currentTask) {
				console.error(`[FCO] No current task found for file reversion`)
				return
			}

			const checkpointService = currentTask.checkpointService
			if (!checkpointService) {
				console.error(`[FCO] No checkpoint service available for file reversion`)
				return
			}

			// Revert the file to its previous state
			await this.revertFileToCheckpoint(message.uri, fileChange.fromCheckpoint, checkpointService)
			console.log(`[FCO] File ${message.uri} successfully reverted`)

			// Remove from tracking since the file has been reverted
			await rejectFileChangeManager.rejectChange(message.uri)

			// Send updated state with LLM-only filtering only if there are remaining changes
			if (currentTask?.taskId && currentTask?.fileContextTracker) {
				const updatedChangeset = await rejectFileChangeManager.getLLMOnlyChanges(
					currentTask.taskId,
					currentTask.fileContextTracker,
				)
				console.log(`[FCO] After rejection, found ${updatedChangeset.files.length} remaining LLM-only files`)
				this.provider.postMessageToWebview({
					type: "filesChanged",
					filesChanged: updatedChangeset.files.length > 0 ? updatedChangeset : undefined,
				})

				// If user individually rejected files until list is empty, advance baseline to current
				if (updatedChangeset.files.length === 0 && currentTask?.checkpointService?.getCurrentCheckpoint) {
					const current = currentTask.checkpointService.getCurrentCheckpoint()
					if (current) {
						await rejectFileChangeManager.updateBaseline(current)
					}
				}
			}
		} catch (error) {
			console.error(`[FCO] Error reverting file ${message.uri}:`, error)
			vscode.window.showErrorMessage(
				this.tr(
					"common:fileChanges.revertFailed",
					`Failed to revert ${message.uri}: ${error instanceof Error ? error.message : String(error)}`,
					{ uri: message.uri, error: error instanceof Error ? error.message : String(error) },
				),
			)
			// Keep item in the list on failure to avoid inconsistent state
		}
	}

	private async handleAcceptAllFileChanges(): Promise<void> {
		let acceptAllFileChangeManager = this.provider.getFileChangeManager()
		if (!acceptAllFileChangeManager) {
			acceptAllFileChangeManager = await this.provider.ensureFileChangeManager()
		}
		await acceptAllFileChangeManager?.acceptAll()

		// Clear FCO state - this is the one case where we DO want to clear the UI
		this.provider.postMessageToWebview({
			type: "filesChanged",
			filesChanged: undefined,
		})
	}

	private async handleRejectAllFileChanges(message: WebviewMessage): Promise<void> {
		let rejectAllFileChangeManager = this.provider.getFileChangeManager()
		if (!rejectAllFileChangeManager) {
			rejectAllFileChangeManager = await this.provider.ensureFileChangeManager()
		}
		if (!rejectAllFileChangeManager) {
			return
		}

		try {
			// Get all current file changes
			const changeset = rejectAllFileChangeManager.getChanges()

			// Filter files if specific URIs provided, otherwise use all files
			const filesToReject: FileChange[] = message.uris
				? changeset.files.filter((file: FileChange) => message.uris!.includes(file.uri))
				: changeset.files

			// Get the current task and checkpoint service
			const currentTask = this.provider.getCurrentTask()
			if (!currentTask) {
				console.error(`[FCO] No current task found for file reversion`)
				return
			}

			const checkpointService = currentTask.checkpointService
			if (!checkpointService) {
				console.error(`[FCO] No checkpoint service available for file reversion`)
				return
			}

			const succeeded: string[] = []
			const failed: string[] = []
			// Revert filtered files to their previous states
			for (const fileChange of filesToReject) {
				try {
					await this.revertFileToCheckpoint(fileChange.uri, fileChange.fromCheckpoint, checkpointService)
					succeeded.push(fileChange.uri)
				} catch (error) {
					console.error(`[FCO] Failed to revert file ${fileChange.uri}:`, error)
					failed.push(fileChange.uri)
				}
			}

			// Clear all tracking after processing reverts to match expected behavior
			await rejectAllFileChangeManager.rejectAll()

			// Clear UI state
			this.provider.postMessageToWebview({
				type: "filesChanged",
				filesChanged: undefined,
			})

			if (failed.length > 0) {
				vscode.window.showErrorMessage(
					this.tr(
						"common:fileChanges.rejectAllPartialFailure",
						"Some files failed to revert. Remaining items were not removed.",
					),
				)
			}
		} catch (error) {
			console.error(`[FCO] Error reverting all files:`, error)
			vscode.window.showErrorMessage(
				this.tr(
					"common:fileChanges.revertFailed",
					`Failed to revert *: ${error instanceof Error ? error.message : String(error)}`,
					{ uri: "*", error: error instanceof Error ? error.message : String(error) },
				),
			)
		}
	}

	private async handleFilesChangedRequest(
		message: WebviewMessage,
		task:
			| { checkpointService?: ShadowCheckpointService; taskId?: string; fileContextTracker?: FileContextTracker }
			| undefined,
	): Promise<void> {
		try {
			let fileChangeManager = this.provider.getFileChangeManager()
			if (!fileChangeManager) {
				fileChangeManager = await this.provider.ensureFileChangeManager()
			}

			if (fileChangeManager) {
				// Handle message file changes if provided
				if (message.fileChanges) {
					const fileChanges = message.fileChanges.map((fc: any) => ({
						uri: fc.uri,
						type: fc.type,
						fromCheckpoint: task?.checkpointService?.baseHash || "base",
						toCheckpoint: "current",
					}))

					fileChangeManager.setFiles(fileChanges)
				}

				// Get LLM-only filtered changeset and send to webview (clear if empty)
				if (task?.taskId && task?.fileContextTracker) {
					const filteredChangeset = await fileChangeManager.getLLMOnlyChanges(
						task.taskId,
						task.fileContextTracker,
					)
					this.provider.postMessageToWebview({
						type: "filesChanged",
						filesChanged: filteredChangeset.files.length > 0 ? filteredChangeset : undefined,
					})
				}
				// If can't filter, don't send anything - keep FCO in current state
			}
			// If no fileChangeManager, don't send anything - keep FCO in current state
		} catch (error) {
			console.error("FCOMessageHandler: Error handling filesChangedRequest:", error)
			// Don't send anything on error - keep FCO in current state
		}
	}

	private async handleFilesChangedBaselineUpdate(
		message: WebviewMessage,
		task: { taskId?: string; fileContextTracker?: FileContextTracker } | undefined,
	): Promise<void> {
		try {
			let fileChangeManager = this.provider.getFileChangeManager()
			if (!fileChangeManager) {
				fileChangeManager = await this.provider.ensureFileChangeManager()
			}

			if (fileChangeManager && task && message.baseline) {
				// Update baseline to the specified checkpoint
				await fileChangeManager.updateBaseline(message.baseline)

				// Send updated state with LLM-only filtering (clear if empty)
				if (task.taskId && task.fileContextTracker) {
					const updatedChangeset = await fileChangeManager.getLLMOnlyChanges(
						task.taskId,
						task.fileContextTracker,
					)
					this.provider.postMessageToWebview({
						type: "filesChanged",
						filesChanged: updatedChangeset.files.length > 0 ? updatedChangeset : undefined,
					})
				}
				// If can't filter, don't send anything - keep FCO in current state
			}
			// If conditions not met, don't send anything - keep FCO in current state
		} catch (error) {
			console.error("FCOMessageHandler: Failed to update baseline:", error)
			// Don't send anything on error - keep FCO in current state
		}
	}

	// Legacy filesChangedEnabled pathway removed; FCO is toggled via updateExperimental in webviewMessageHandler

	/**
	 * Revert a specific file to its content at a specific checkpoint
	 */
	private async revertFileToCheckpoint(
		relativeFilePath: string,
		fromCheckpoint: string,
		checkpointService: ShadowCheckpointService,
	): Promise<void> {
		if (!checkpointService?.restoreFileFromCheckpoint) {
			throw new Error("Checkpoint service does not support per-file restore")
		}

		try {
			await checkpointService.restoreFileFromCheckpoint(fromCheckpoint, relativeFilePath)
		} catch (error) {
			console.error(`[FCO] Failed to revert file ${relativeFilePath}:`, error)
			const message = error instanceof Error ? error.message : String(error)
			// Treat missing-file errors as success (newly created file to be deleted)
			if (/did not match any file|unknown path|no such file|does not exist/i.test(message)) {
				return
			}
			throw new FileChangeError(FileChangeErrorType.GENERIC_ERROR, relativeFilePath, message, error as Error)
		}
	}

	private async serialize<T>(fn: () => Promise<T>): Promise<T> {
		const prev = this.lastOp
		let result!: T
		const run = async () => {
			result = await fn()
		}
		this.lastOp = prev.then(run, run)
		await this.lastOp.catch(() => {})
		return result
	}
}
