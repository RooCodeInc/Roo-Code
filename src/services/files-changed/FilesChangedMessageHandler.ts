import * as vscode from "vscode"
import * as path from "path"
import { WebviewMessage } from "../../shared/WebviewMessage"
import type { FileChange, FileChangeType } from "@roo-code/types"
import { FilesChangedManager } from "./FilesChangedManager"
import type { TaskFilesChangedState } from "./TaskFilesChangedState"
import { FcoTextDocumentContentProvider } from "./FcoTextDocumentContentProvider"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { getCheckpointService } from "../../core/checkpoints"
import type { Task } from "../../core/task/Task"
// No experiments migration handler needed anymore; FilesChanged is managed via updateExperimental in webviewMessageHandler

/**
 * Handles FilesChanged-specific webview messages that were previously scattered throughout ClineProvider
 */
export class FilesChangedMessageHandler {
	private isEnabled = false
	private checkpointEventListener?: (event: any) => void
	private trackerListener?: (filePath: string) => void
	private trackerDebounce?: ReturnType<typeof setTimeout>
	private activeTask?: Task
	private pendingFiles = new Set<string>()
	private burstCount = 0
	private lastEditTime = 0

	constructor(private provider: ClineProvider) {}

	private getState(task: Task | undefined): TaskFilesChangedState | undefined {
		return task?.getFilesChangedState()
	}

	private ensureState(task: Task | undefined): TaskFilesChangedState | undefined {
		return task?.ensureFilesChangedState()
	}

	private isWaitingForTask(task: Task | undefined): boolean {
		const state = this.getState(task)
		if (!state) {
			return false
		}
		return state.shouldWaitForNextCheckpoint()
	}

	private markWaitingForTask(task: Task | undefined, waiting: boolean): void {
		const state = waiting ? this.ensureState(task) : this.getState(task)
		state?.setWaiting(waiting)
	}

	private clearQueuedChildFiles(task: Task | undefined): void {
		const state = this.getState(task)
		state?.clearQueuedChildUris()
	}

	public transferStateBetweenTasks(sourceTask: Task | undefined, targetTask: Task | undefined): void {
		if (!sourceTask || !targetTask) {
			return
		}
		if (sourceTask.taskId !== targetTask.taskId) {
			return
		}
		const sourceState = sourceTask.getFilesChangedState?.()
		if (!sourceState) {
			return
		}
		const targetState = targetTask.ensureFilesChangedState?.()
		if (!targetState) {
			return
		}

		targetState.cloneFrom(sourceState)
		sourceTask.disposeFilesChangedState?.()
	}

	private queuePendingUri(task: Task | undefined, uri: string): void {
		if (!task) {
			return
		}
		const state = this.ensureState(task)!
		state.queueChildUris([uri])
	}

	private async drainQueuedUris(task: Task | undefined, manager?: FilesChangedManager): Promise<void> {
		const state = this.getState(task)
		if (!state) {
			return
		}
		const pendingUris = state.takeQueuedChildUris()
		if (pendingUris.length === 0) {
			return
		}
		const effectiveManager = manager ?? this.ensureManager(task)
		if (!effectiveManager) {
			return
		}

		const baseline =
			effectiveManager.getChanges().baseCheckpoint ||
			task?.checkpointService?.baseHash ||
			task?.checkpointService?.getCurrentCheckpoint?.()

		if (!baseline) {
			// Put URIs back in queue if no baseline available yet
			state.queueChildUris(pendingUris)
			return
		}

		// Process each subtask file individually using the same logic as normal roo_edited events
		for (const uri of pendingUris) {
			try {
				await this.refreshEditedFile(task, uri)
			} catch (error) {
				// Ignore queued file processing errors
			}
		}
	}

	private async handleFileEdited(task: Task | undefined, filePath: string): Promise<void> {
		if (!task || !this.isEnabled) {
			return
		}

		if (filePath === "*") {
			await this.refreshAllFromBaseline(task)
			return
		}

		if (this.isWaitingForTask(task)) {
			this.queuePendingUri(task, filePath)
			return
		}

		await this.refreshEditedFile(task, filePath)
	}

	/**
	 * Process batch of files that were edited during debounce period
	 * More efficient than individual file processing during edit bursts
	 */
	private async handleFileEditBatch(task: Task | undefined): Promise<void> {
		if (!task || !this.isEnabled) {
			return
		}

		// Take all pending files and clear the set
		const filesToProcess = Array.from(this.pendingFiles)
		this.pendingFiles.clear()

		if (filesToProcess.length === 0) {
			return
		}

		// Handle wildcard - if any file is "*", do full refresh
		if (filesToProcess.includes("*")) {
			await this.refreshAllFromBaseline(task)
			return
		}

		// If waiting for task, queue all pending files
		if (this.isWaitingForTask(task)) {
			for (const filePath of filesToProcess) {
				this.queuePendingUri(task, filePath)
			}
			return
		}

		// Batch process all files together
		await this.refreshEditedFilesBatch(task, filesToProcess)
	}

	private getManager(task: Task | undefined): FilesChangedManager | undefined {
		return this.getState(task)?.getManager()
	}

	private ensureManager(task: Task | undefined): FilesChangedManager | undefined {
		return this.ensureState(task)?.ensureManager()
	}

	private resolveTask(task?: Task): Task | undefined {
		if (task) {
			return task
		}
		if (this.activeTask) {
			return this.activeTask
		}
		return this.provider.getCurrentTask() as Task | undefined
	}

	/**
	 * Universal FilesChanged enable/disable handler - ALWAYS waits for next checkpoint when enabled
	 */
	public async handleExperimentToggle(enabled: boolean, task: Task | undefined): Promise<void> {
		if (enabled === this.isEnabled) {
			return
		}

		if (enabled) {
			if (task && !(await this.initializeCheckpointService(task))) {
				this.isEnabled = false
				return
			}

			this.isEnabled = true
			this.markWaitingForTask(task, true)
			this.clearFilesChangedDisplay()
			await this.attachToTask(task)
			this.replayTaskChanges(task)
		} else {
			this.isEnabled = false
			const targetTask = task ?? this.activeTask ?? (this.provider.getCurrentTask() as Task | undefined)
			if (targetTask) {
				this.markWaitingForTask(targetTask, false)
				this.clearQueuedChildFiles(targetTask)
				targetTask.disposeFilesChangedState()
			}
			await this.attachToTask(undefined)
			this.clearFilesChangedDisplay()
		}
	}

	/**
	 * Dispose listeners when provider is torn down
	 */
	public dispose(task?: Task): void {
		const target = task ?? this.activeTask ?? (this.provider.getCurrentTask() as Task | undefined)
		if (target) {
			this.removeCheckpointListener(target)
			this.removeTrackerListener(target)
			const state = this.getState(target)
			state?.setWaiting(false)
			state?.clearQueuedChildUris()
			target.disposeFilesChangedState()
		}
		this.activeTask = undefined
		this.clearTrackerDebounce()
		// Clear any pending files to prevent memory leaks
		this.pendingFiles.clear()
	}

	private async attachToTask(task: Task | undefined): Promise<void> {
		const state = this.getState(task)
		if (this.activeTask === task && !(state && state.hasQueuedChildUris())) {
			// If we're already attached and no queued changes, still post current state if enabled
			const manager = this.getManager(task)
			if (this.isEnabled && manager && !this.isWaitingForTask(task)) {
				this.postChanges(manager)
			}
			return
		}

		if (this.activeTask) {
			this.removeCheckpointListener(this.activeTask)
			this.removeTrackerListener(this.activeTask)
		}

		this.activeTask = task
		if (!task || !this.isEnabled) {
			return
		}

		if (task?.checkpointService) {
			this.setupCheckpointListener(task)
		}
		if (task?.fileContextTracker) {
			this.setupTrackerListener(task)
		}

		let manager = this.getManager(task)
		if (!manager) {
			manager = this.ensureManager(task)
			const baseline = manager?.getChanges().baseCheckpoint
			if (!baseline || baseline === "HEAD") {
				this.markWaitingForTask(task, true)
			}
		}

		if (this.isWaitingForTask(task)) {
			this.clearFilesChangedDisplay()
			return
		}

		manager = manager ?? this.ensureManager(task)
		if (!manager) {
			return
		}

		const stateWithManager = state ?? this.getState(task)
		if (stateWithManager?.hasQueuedChildUris() && !this.isWaitingForTask(task)) {
			await this.drainQueuedUris(task, manager)
		}

		this.postChanges(manager)
		if (manager.getChanges().baseCheckpoint && manager.getChanges().baseCheckpoint !== "HEAD") {
			this.markWaitingForTask(task, false)
		}
	}

	/**
	 * Clear FilesChanged display in webview
	 */
	private clearFilesChangedDisplay(): void {
		this.provider.postMessageToWebview({
			type: "filesChanged",
			filesChanged: null,
		})
	}

	/**
	 * Set up checkpoint event listener for universal baseline management
	 */
	private setupCheckpointListener(task: Task): void {
		this.removeCheckpointListener(task)
		this.checkpointEventListener = async (event: any) => {
			if (!this.isEnabled) {
				return
			}
			const state = this.getState(task)
			const waiting = this.isWaitingForTask(task) || state?.hasQueuedChildUris()
			if (!waiting) {
				return
			}

			try {
				const manager = this.getManager(task) ?? this.ensureManager(task)
				if (!manager) {
					return
				}

				const baseline = event?.fromHash ?? event?.toHash
				const hadQueued = state?.hasQueuedChildUris() ?? false
				const hasExistingFiles = manager.getChanges().files.length > 0

				if (baseline) {
					if (hasExistingFiles && hadQueued) {
						// Adding child files to existing parent files - preserve existing files
						manager.setBaseline(baseline)
					} else {
						// Starting fresh or no existing files - clear is appropriate
						manager.reset(baseline)
					}
				}
				this.markWaitingForTask(task, false)

				if (hadQueued) {
					await this.drainQueuedUris(task, manager)
				}
				this.postChanges(manager)
			} catch (error) {
				this.provider.log(`FilesChanged: Failed to process checkpoint: ${error}`)
			}
		}
		if (task?.checkpointService?.on) {
			task.checkpointService.on("checkpoint", this.checkpointEventListener)
		}
	}

	/**
	 * Remove checkpoint event listener
	 */
	private removeCheckpointListener(task: Task | undefined): void {
		if (this.checkpointEventListener && task?.checkpointService?.off) {
			task.checkpointService.off("checkpoint", this.checkpointEventListener)
		}
		this.checkpointEventListener = undefined
	}

	private setupTrackerListener(task: Task): void {
		this.removeTrackerListener(task)
		const listeningTask = task
		this.trackerListener = (filePath?: string) => {
			if (!this.isEnabled) {
				return
			}
			if (typeof filePath !== "string" || filePath.length === 0) {
				return
			}

			// Add file to pending batch
			this.pendingFiles.add(filePath)

			if (this.trackerDebounce) {
				clearTimeout(this.trackerDebounce)
			}

			// Burst detection for adaptive debouncing
			const now = Date.now()
			if (now - this.lastEditTime < 1000) {
				this.burstCount++
			} else {
				this.burstCount = 0
			}
			this.lastEditTime = now

			// Adaptive timing: longer delay during bursts to batch more files
			const debounceMs = this.burstCount > 3 ? 1000 : 500

			this.trackerDebounce = setTimeout(async () => {
				try {
					await this.handleFileEditBatch(listeningTask)
				} catch (error) {
					// Batch refresh fallback is handled
				}
			}, debounceMs)
		}
		if (task?.fileContextTracker?.on) {
			task.fileContextTracker.on("roo_edited", this.trackerListener)
		}
	}

	private removeTrackerListener(task: Task | undefined): void {
		if (this.trackerListener && task?.fileContextTracker?.off) {
			task.fileContextTracker.off("roo_edited", this.trackerListener)
		}
		this.trackerListener = undefined
		this.clearTrackerDebounce()
	}

	private clearTrackerDebounce(): void {
		if (this.trackerDebounce) {
			clearTimeout(this.trackerDebounce)
			this.trackerDebounce = undefined
		}
		// Clear pending files when clearing debounce to prevent stale batches
		this.pendingFiles.clear()
	}

	private replayTaskChanges(task: Task | undefined): void {
		if (!this.isEnabled || !task) {
			return
		}
		const manager = this.getManager(task)
		if (!manager) {
			return
		}
		const changes = manager.getChanges()
		if (changes.files.length > 0) {
			this.markWaitingForTask(task, false)
			this.postChanges(manager)
		}
	}

	/**
	 * Check if a message should be handled by FilesChanged
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
	 * Handle FilesChanged-specific messages
	 */
	public async handleMessage(message: WebviewMessage): Promise<void> {
		const task = this.provider.getCurrentTask() as Task | undefined

		switch (message.type) {
			case "webviewReady": {
				// Initialize FilesChanged state from settings if not already done
				await this.initializeFilesChangedFromSettings()

				const waiting = this.isWaitingForTask(task)
				if (this.isEnabled && !waiting) {
					const manager = this.getManager(task) ?? this.ensureManager(task)
					if (manager) {
						this.postChanges(manager)
					}
				} else if (waiting) {
					this.clearFilesChangedDisplay()
				}
				break
			}

			case "viewDiff": {
				await this.handleViewDiff(message, task)
				break
			}

			case "acceptFileChange": {
				await this.handleAcceptFileChange(message)
				break
			}

			case "rejectFileChange": {
				await this.handleRejectFileChange(message)
				break
			}

			case "acceptAllFileChanges": {
				await this.handleAcceptAllFileChanges()
				break
			}

			case "rejectAllFileChanges": {
				await this.handleRejectAllFileChanges(message)
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

	private async handleViewDiff(message: WebviewMessage, task: Task | undefined): Promise<void> {
		const diffFilesChangedManager = this.getManager(task)
		if (message.uri && diffFilesChangedManager && task?.checkpointService) {
			// Get the file change information
			const changeset = diffFilesChangedManager.getChanges()
			const fileChange = changeset.files.find((f: any) => f.uri === message.uri)

			if (fileChange) {
				try {
					// Handle HEAD_WORKING as a special case - it's a UI identifier, not a git reference
					let actualFromCheckpoint = fileChange.fromCheckpoint
					if (fileChange.fromCheckpoint === "HEAD_WORKING") {
						// When fromCheckpoint is HEAD_WORKING, use HEAD as the git baseline
						actualFromCheckpoint = "HEAD"
					}

					let actualToCheckpoint: string | undefined = fileChange.toCheckpoint
					if (fileChange.toCheckpoint === "HEAD_WORKING") {
						// When toCheckpoint is HEAD_WORKING, omit the 'to' parameter for working tree diff
						actualToCheckpoint = undefined
					}
					// Get the specific file content from both checkpoints
					const diffArgs = actualToCheckpoint
						? { from: actualFromCheckpoint, to: actualToCheckpoint }
						: { from: actualFromCheckpoint }
					const changes = await task.checkpointService.getDiff(diffArgs)

					// Find the specific file in the changes
					const fileChangeData = changes.find((change: any) => change.paths.relative === message.uri)

					if (fileChangeData) {
						await this.showFileDiff(message.uri, fileChangeData)
					} else {
						vscode.window.showInformationMessage(`No changes found for ${message.uri}`)
					}
				} catch (error) {
					this.provider.log(`FilesChanged: Failed to open diff: ${error}`)
					vscode.window.showErrorMessage(`Failed to open diff for ${message.uri}: ${error.message}`)
				}
			} else {
				vscode.window.showInformationMessage(`File change not found for ${message.uri}`)
			}
		} else {
			vscode.window.showErrorMessage("Unable to view diff - missing required dependencies")
		}
	}

	private async showFileDiff(uri: string, fileChangeData: any): Promise<void> {
		const beforeContent = fileChangeData.content.before || ""
		const afterContent = fileChangeData.content.after || ""

		try {
			// Use dedicated FCO content provider - eliminates base64 encoding in query strings!
			const fcoProvider = FcoTextDocumentContentProvider.getInstance()
			const { beforeUri, afterUri } = fcoProvider.storeDiffContent(beforeContent, afterContent, uri)

			await vscode.commands.executeCommand(
				"vscode.diff",
				vscode.Uri.parse(beforeUri),
				vscode.Uri.parse(afterUri),
				`${uri}: Before ↔ After`,
				{ preview: false },
			)
		} catch (fileError) {
			vscode.window.showErrorMessage(
				`Failed to open diff view: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
			)
		}
	}

	/**
	 * Closes diff tabs for a specific file and cleans up stored content
	 */
	private async closeDiffTabsForFile(filePath: string): Promise<boolean> {
		const fcoProvider = FcoTextDocumentContentProvider.getInstance()
		const uris = fcoProvider.getUrisForFile(filePath)

		if (!uris) return false

		try {
			// Find and close diff tabs
			const allTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs)
			const diffTabsToClose: vscode.Tab[] = []

			for (const tab of allTabs) {
				if (tab.input instanceof vscode.TabInputTextDiff) {
					const originalScheme = tab.input.original?.scheme
					const modifiedScheme = tab.input.modified?.scheme

					// Check if this is an FCO diff tab
					if (originalScheme === "fco-diff" || modifiedScheme === "fco-diff") {
						const originalPath = tab.input.original?.path
						const modifiedPath = tab.input.modified?.path

						// Extract hash from URI path to match against our stored URIs
						const beforeHash = uris.beforeUri.split(":")[1]
						const afterHash = uris.afterUri.split(":")[1]

						if (originalPath?.includes(beforeHash) || modifiedPath?.includes(afterHash)) {
							diffTabsToClose.push(tab)
						}
					}
				}
			}

			// Close matching diff tabs
			for (const tab of diffTabsToClose) {
				try {
					await vscode.window.tabGroups.close(tab)
				} catch (error) {
					// Ignore tab closing errors
				}
			}

			// Clean up stored content
			fcoProvider.cleanupFile(filePath)

			return diffTabsToClose.length > 0
		} catch (error) {
			// Ignore cleanup errors
		}

		return false
	}

	private async handleAcceptFileChange(message: WebviewMessage): Promise<void> {
		const diffWasOpen = message.uri ? await this.closeDiffTabsForFile(message.uri) : false
		const task = this.resolveTask()
		const manager = this.getManager(task) ?? this.ensureManager(task)
		if (!manager || !message.uri) {
			return
		}

		// Diff cleanup handled above; only open the file if the diff was shown

		// Accept the change
		manager.acceptChange(message.uri)
		this.postChanges(manager)

		// Open the modified file for user to see the accepted changes
		try {
			if (!task?.cwd) {
				return
			}
			// Resolve relative path to absolute path within workspace
			const absolutePath = path.resolve(task.cwd, message.uri)
			const fileUri = vscode.Uri.file(absolutePath)
			if (diffWasOpen) {
				await vscode.window.showTextDocument(fileUri, { preview: false })
			}
		} catch (error) {
			// Ignore file open failures
		}
	}

	private async handleRejectFileChange(message: WebviewMessage): Promise<void> {
		const diffWasOpen = message.uri ? await this.closeDiffTabsForFile(message.uri) : false
		const task = this.resolveTask()
		const manager = this.getManager(task) ?? this.ensureManager(task)
		if (!message.uri || !manager) {
			return
		}

		const currentTask = task
		const checkpointService = currentTask?.checkpointService
		if (!currentTask || !checkpointService) {
			return
		}

		try {
			const fileChange = manager.getFileChange(message.uri)
			if (fileChange) {
				await this.revertFileToCheckpoint(message.uri, fileChange.fromCheckpoint, checkpointService)
			}

			manager.rejectChange(message.uri)
			this.postChanges(manager)

			// Open the reverted file (if it still exists after reject)
			try {
				// Resolve relative path to absolute path within workspace
				const absolutePath = path.resolve(currentTask.cwd, message.uri)
				const fileUri = vscode.Uri.file(absolutePath)
				if (diffWasOpen) {
					await vscode.window.showTextDocument(fileUri, { preview: false })
				}
			} catch (error) {
				// File may have been deleted after reject
			}

			currentTask.fileContextTracker?.emit?.("user_edited", message.uri)
		} catch (error) {
			this.provider.log(`FilesChanged: Error during reject: ${error}`)
			// Still clean up diff tabs and UI even if revert failed
			manager.rejectChange(message.uri)
			this.postChanges(manager)
		}
	}

	private async handleAcceptAllFileChanges(): Promise<void> {
		const task = this.resolveTask()
		const manager = this.getManager(task) ?? this.ensureManager(task)
		const checkpointService = task?.checkpointService
		const nextBaseline = checkpointService?.getCurrentCheckpoint?.()

		manager?.acceptAll()
		this.prepareForNextCheckpoint(task, nextBaseline, manager)
	}

	private async handleRejectAllFileChanges(message: WebviewMessage): Promise<void> {
		const task = this.resolveTask()
		const manager = this.getManager(task) ?? this.ensureManager(task)
		if (!manager) {
			return
		}

		const currentTask = task
		const checkpointService = currentTask?.checkpointService
		if (!currentTask || !checkpointService) {
			return
		}

		try {
			const changeset = manager.getChanges()
			const specifiedUris = Array.isArray(message.uris) ? new Set<string>(message.uris as string[]) : undefined
			const filesToReject = specifiedUris
				? changeset.files.filter((file: any) => specifiedUris.has(file.uri))
				: changeset.files
			if (specifiedUris && filesToReject.length === 0) {
				return
			}

			const isPartialReject = specifiedUris !== undefined && filesToReject.length < changeset.files.length

			for (const fileChange of filesToReject) {
				try {
					await this.revertFileToCheckpoint(fileChange.uri, fileChange.fromCheckpoint, checkpointService)
				} catch (error) {
					// Ignore individual file revert failures
				}
			}

			if (isPartialReject) {
				for (const fileChange of filesToReject) {
					manager.rejectChange(fileChange.uri)
				}
				this.postChanges(manager)
			} else {
				manager.rejectAll()
				this.prepareForNextCheckpoint(currentTask, undefined, manager)
			}
		} catch (error) {
			this.provider.log(`FilesChanged: Failed to reject all changes: ${error}`)

			const changeset = manager.getChanges()
			const specifiedUris = Array.isArray(message.uris) ? new Set<string>(message.uris as string[]) : undefined
			const filesToReject = specifiedUris
				? changeset.files.filter((file: any) => specifiedUris.has(file.uri))
				: changeset.files
			if (specifiedUris && filesToReject.length === 0) {
				return
			}
			const isPartialReject = specifiedUris !== undefined && filesToReject.length < changeset.files.length

			if (isPartialReject) {
				for (const fileChange of filesToReject) {
					manager.rejectChange(fileChange.uri)
				}
				this.postChanges(manager)
			} else {
				manager.rejectAll()
				this.prepareForNextCheckpoint(currentTask, undefined, manager)
			}
		}
	}

	private async handleFilesChangedRequest(_message: WebviewMessage, inputTask: Task | undefined): Promise<void> {
		try {
			const task = this.resolveTask(inputTask)
			const manager = this.getManager(task) ?? this.ensureManager(task)
			if (!manager) {
				return
			}
			this.postChanges(manager)
		} catch (error) {
			// Error handling files changed request
		}
	}

	private async handleFilesChangedBaselineUpdate(
		message: WebviewMessage,
		inputTask: Task | undefined,
	): Promise<void> {
		try {
			if (!message.baseline) {
				return
			}
			const task = this.resolveTask(inputTask)
			const manager = this.getManager(task) ?? this.ensureManager(task)
			if (manager) {
				this.prepareForNextCheckpoint(task, message.baseline, manager)
			}
		} catch (error) {
			// Failed to update baseline
		}
	}

	// Legacy filesChangedEnabled pathway removed; FilesChanged is toggled via updateExperimental in webviewMessageHandler

	/**
	 * Initialize FilesChanged state from global experiments settings
	 * This ensures the handler state matches saved settings on startup
	 */
	public async initializeFilesChangedFromSettings(): Promise<void> {
		await this.applyExperimentsToTask(this.provider.getCurrentTask() as Task | undefined)
	}

	/**
	 * Safely initialize checkpoint service with error logging
	 */
	private async initializeCheckpointService(task: Task | undefined): Promise<boolean> {
		if (!task) {
			return false
		}

		try {
			await getCheckpointService(task)
			return true
		} catch (error) {
			this.provider.log(`FilesChanged: Failed to initialize checkpoint service: ${error}`)
			return false
		}
	}

	public async applyExperimentsToTask(task: Task | undefined): Promise<void> {
		const state = await this.provider.getState()
		const shouldBeEnabled = experiments.isEnabled(state?.experiments ?? {}, EXPERIMENT_IDS.FILES_CHANGED_OVERVIEW)
		if (!task) {
			if (this.isEnabled) {
				await this.attachToTask(undefined)
			}
			return
		}
		if (shouldBeEnabled !== this.isEnabled) {
			await this.handleExperimentToggle(shouldBeEnabled, task)
			return
		}
		if (!shouldBeEnabled) {
			return
		}

		if (!(await this.initializeCheckpointService(task))) {
			return
		}

		// Only reattach if we're not already attached to this task, or if there are pending child files
		const taskState = this.getState(task)
		const needsReattach = this.activeTask !== task || (taskState && taskState.hasQueuedChildUris())

		if (needsReattach) {
			await this.attachToTask(task)
			this.replayTaskChanges(task)
		} else {
			this.replayTaskChanges(task)
		}
	}

	/**
	 * Revert a specific file to its content at a specific checkpoint
	 */
	private async revertFileToCheckpoint(
		relativeFilePath: string,
		fromCheckpoint: string,
		checkpointService: any,
	): Promise<void> {
		if (!checkpointService?.restoreFileFromCheckpoint) {
			throw new Error("Checkpoint service does not support per-file restore")
		}
		await checkpointService.restoreFileFromCheckpoint(fromCheckpoint, relativeFilePath)
	}

	private async refreshEditedFile(task: Task | undefined, filePath: string): Promise<void> {
		if (!this.isEnabled) {
			return
		}

		if (this.isWaitingForTask(task)) {
			if (task && filePath !== "*") {
				this.queuePendingUri(task, filePath)
			}
			return
		}

		if (filePath === "*") {
			await this.refreshAllFromBaseline(task)
			return
		}

		const checkpointService = task?.checkpointService
		if (!checkpointService) {
			return
		}

		const manager = this.getManager(task) ?? this.ensureManager(task)
		if (!manager) {
			return
		}

		const baseline = manager.getChanges().baseCheckpoint || checkpointService.baseHash
		if (!baseline) {
			return
		}

		try {
			const diffs = (await checkpointService.getDiff({ from: baseline })) || []
			const stats = await checkpointService.getDiffStats({ from: baseline }).catch(() => undefined)
			const change = diffs.find((entry: any) => entry.paths.relative === filePath)

			if (!change) {
				manager.removeFile(filePath)
			} else {
				const stat = stats?.[filePath]
				const mapped = this.mapDiffToFileChange(change, baseline, stat)
				manager.upsertFile(mapped)
			}

			this.postChanges(manager)
		} catch (error) {
			// If we get "bad object" errors, reset FCO state to wait for next checkpoint
			if (
				error &&
				typeof error === "object" &&
				"message" in error &&
				typeof (error as any).message === "string" &&
				(error as any).message.includes("fatal: bad object")
			) {
				this.provider.log(`FilesChanged: Detected invalid baseline, resetting to wait for next checkpoint`)
				this.markWaitingForTask(task, true)
				this.clearFilesChangedDisplay()
			}
		}
	}

	/**
	 * Efficiently process multiple files in a single batch operation
	 * Avoids multiple getDiff/getDiffStats calls during edit bursts
	 */
	private async refreshEditedFilesBatch(task: Task | undefined, filePaths: string[]): Promise<void> {
		if (!this.isEnabled || filePaths.length === 0) {
			return
		}

		const checkpointService = task?.checkpointService
		if (!checkpointService) {
			return
		}

		const manager = this.getManager(task) ?? this.ensureManager(task)
		if (!manager) {
			return
		}

		const baseline = manager.getChanges().baseCheckpoint || checkpointService.baseHash
		if (!baseline) {
			return
		}

		try {
			// Single getDiff call for all files - much more efficient than individual calls
			const diffs = (await checkpointService.getDiff({ from: baseline })) || []
			const stats = await checkpointService.getDiffStats({ from: baseline }).catch(() => undefined)

			// Process each file in our batch
			for (const filePath of filePaths) {
				const change = diffs.find((entry: any) => entry.paths.relative === filePath)

				if (!change) {
					manager.removeFile(filePath)
				} else {
					const stat = stats?.[filePath]
					const mapped = this.mapDiffToFileChange(change, baseline, stat)
					manager.upsertFile(mapped)
				}
			}
			// Single UI update for entire batch
			this.postChanges(manager)
		} catch (error) {
			this.provider.log(`FilesChanged: Failed to batch refresh files: ${error}`)

			// Fallback to individual processing if batch fails
			for (const filePath of filePaths) {
				try {
					await this.refreshEditedFile(task, filePath)
				} catch (individualError) {
					// Individual refresh errors handled in refreshEditedFile
				}
			}
		}
	}

	private async refreshAllFromBaseline(task: Task | undefined, existingManager?: FilesChangedManager): Promise<void> {
		if (!this.isEnabled || this.isWaitingForTask(task)) {
			return
		}

		const checkpointService = task?.checkpointService
		if (!checkpointService) {
			return
		}

		const manager = existingManager ?? this.getManager(task) ?? this.ensureManager(task)
		if (!manager) {
			return
		}

		const baseline = manager.getChanges().baseCheckpoint || checkpointService.baseHash
		if (!baseline) {
			return
		}

		try {
			const diffs = (await checkpointService.getDiff({ from: baseline })) || []
			const stats = await checkpointService.getDiffStats({ from: baseline }).catch(() => undefined)

			manager.clearFiles()
			for (const change of diffs) {
				const stat = stats?.[change.paths.relative]
				manager.upsertFile(this.mapDiffToFileChange(change, baseline, stat))
			}

			this.postChanges(manager)
		} catch (error) {
			// Failed to refresh changes from baseline
		}
	}

	private mapDiffToFileChange(
		change: any,
		baseline: string,
		stat?: { insertions?: number; deletions?: number; added?: number; removed?: number },
	): FileChange {
		const type = (change.paths.newFile ? "create" : change.paths.deletedFile ? "delete" : "edit") as FileChangeType

		// ALWAYS prioritize git diff stats when available - they are the most reliable source
		let linesAdded = stat?.insertions ?? stat?.added ?? 0
		let linesRemoved = stat?.deletions ?? stat?.removed ?? 0

		// Only use lightweight content parsing for edge cases where git stats are completely missing
		// This eliminates expensive diffLines fallback for normal operations
		if (
			stat === undefined ||
			(stat.insertions === undefined &&
				stat.deletions === undefined &&
				stat.added === undefined &&
				stat.removed === undefined)
		) {
			if (type === "create") {
				const after = change.content?.after || ""
				linesAdded = after === "" ? 0 : after.split("\n").length
				linesRemoved = 0
			} else if (type === "delete") {
				const before = change.content?.before || ""
				linesAdded = 0
				linesRemoved = before === "" ? 0 : before.split("\n").length
			}
			// For edits with completely missing stats, accept 0/0 rather than expensive parsing
			// Git stats being 0/0 is often correct (whitespace-only changes, etc.)
		}

		return {
			uri: change.paths.relative,
			type,
			fromCheckpoint: baseline,
			toCheckpoint: "HEAD_WORKING",
			linesAdded,
			linesRemoved,
		}
	}

	private postChanges(manager: FilesChangedManager): void {
		const changeset = manager.getChanges()
		const payload = changeset.files.length > 0 ? changeset : null
		this.provider.postMessageToWebview({ type: "filesChanged", filesChanged: payload })
	}

	private prepareForNextCheckpoint(
		task: Task | undefined,
		baselineHint?: string,
		resolvedManager?: FilesChangedManager,
	): void {
		const manager =
			resolvedManager ?? this.getManager(task) ?? (baselineHint ? this.ensureManager(task) : undefined)
		if (manager) {
			if (baselineHint) {
				manager.reset(baselineHint)
			} else {
				manager.clearFiles()
			}
		}
		this.markWaitingForTask(task, true)
		this.clearFilesChangedDisplay()
		const suffix = baselineHint ? ` (${baselineHint})` : ""
	}

	public async handleChildTaskCompletion(childTask: Task | undefined, parentTask: Task | undefined): Promise<void> {
		if (!childTask) {
			return
		}
		const childState = childTask.getFilesChangedState?.()
		const parentState = parentTask?.getFilesChangedState?.()
		let pendingUris = childState?.collectCurrentFileUris() ?? []

		// Fallback: If no files tracked but child has checkpoint service, query it directly
		// This handles cases where roo_edited events were missed but actual file changes occurred
		if (pendingUris.length === 0 && childTask.checkpointService) {
			try {
				const fallbackBaseline =
					childState?.getManager()?.getChanges().baseCheckpoint ||
					childTask.checkpointService.baseHash ||
					childTask.checkpointService.getCurrentCheckpoint?.()

				if (fallbackBaseline) {
					const checkpointDiff = await childTask.checkpointService.getDiff({ from: fallbackBaseline })
					if (checkpointDiff && checkpointDiff.length > 0) {
						pendingUris = checkpointDiff.map((diff: any) => diff.paths.relative)
					}
				}
			} catch (error) {
				this.provider.log(`FilesChanged: Fallback failed for subtask ${childTask.taskId}: ${error}`)
			}
		}

		// Only dispose child state if it's different from parent state (avoid test edge case)
		if (childState && childState !== parentState) {
			childTask.disposeFilesChangedState?.()
		}

		if (pendingUris.length > 0) {
			this.queueChildFiles(parentTask, childTask.taskId, pendingUris)
		}
	}

	/**
	 * Queue child FCO files to be processed when parent establishes baseline
	 */
	public queueChildFiles(parentTask: Task | undefined, childTaskId: string, childFileUris: string[]): void {
		if (!parentTask || !childTaskId || childFileUris.length === 0) {
			return
		}

		if (!this.isEnabled) {
			return
		}

		const state = this.ensureState(parentTask)!
		state.queueChildUris(childFileUris)

		if (!this.isWaitingForTask(parentTask)) {
			void this.drainQueuedUris(parentTask)
		}
	}
}
