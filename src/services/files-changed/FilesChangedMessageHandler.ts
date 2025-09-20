import * as vscode from "vscode"
import { WebviewMessage } from "../../shared/WebviewMessage"
import type { FileChange, FileChangeType } from "@roo-code/types"
import { FilesChangedManager } from "./FilesChangedManager"
import type { TaskFilesChangedState } from "./TaskFilesChangedState"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { getCheckpointService } from "../../core/checkpoints"
import type { Task } from "../../core/task/Task"
const DIFF_VIEW_URI_SCHEME = "cline-diff"
// No experiments migration handler needed anymore; FilesChanged is managed via updateExperimental in webviewMessageHandler

/**
 * Handles FilesChanged-specific webview messages that were previously scattered throughout ClineProvider
 */
export class FilesChangedMessageHandler {
	private isEnabled = false
	private checkpointEventListener?: (event: any) => void
	private trackerListener?: (filePath: string) => void
	private trackerDebounce?: NodeJS.Timeout
	private activeTask?: Task

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

		for (const uri of pendingUris) {
			await this.refreshEditedFile(task, uri)
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

		this.isEnabled = enabled

		if (enabled && task) {
			try {
				await getCheckpointService(task)
			} catch (error) {
				this.provider.log(`FilesChanged: Failed to initialize checkpoint service: ${error}`)
				return
			}
		}

		if (enabled) {
			this.markWaitingForTask(task, true)
			this.provider.log("FilesChanged: Enabled, waiting for next checkpoint to establish monitoring baseline")
			this.clearFilesChangedDisplay()
			await this.attachToTask(task)
		} else {
			const targetTask = task ?? this.activeTask ?? (this.provider.getCurrentTask() as Task | undefined)
			if (targetTask) {
				this.markWaitingForTask(targetTask, false)
				this.clearQueuedChildFiles(targetTask)
				targetTask.disposeFilesChangedState()
			}
			await this.attachToTask(undefined)
			this.clearFilesChangedDisplay()
			this.provider.log("FilesChanged: Disabled")
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
		if (this.trackerDebounce) {
			clearTimeout(this.trackerDebounce)
			this.trackerDebounce = undefined
		}
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

		if (this.isWaitingForTask(task)) {
			this.clearFilesChangedDisplay()
			return
		}

		const manager = this.getManager(task) ?? this.ensureManager(task)
		if (!manager) {
			return
		}

		if (state?.hasQueuedChildUris() && !this.isWaitingForTask(task)) {
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
			filesChanged: undefined,
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
				if (baseline) {
					manager.reset(baseline)
				}
				this.markWaitingForTask(task, false)

				const hadQueued = state?.hasQueuedChildUris() ?? false
				if (hadQueued) {
					await this.drainQueuedUris(task, manager)
					this.provider.log(
						`FilesChanged: Processed queued Files Changed state after establishing baseline ${baseline ?? manager.getChanges().baseCheckpoint}`,
					)
				} else {
					this.provider.log(
						`FilesChanged: Established monitoring baseline at ${baseline ?? manager.getChanges().baseCheckpoint}`,
					)
				}
				this.postChanges(manager)
			} catch (error) {
				this.provider.log(`FilesChanged: Failed to process checkpoint event: ${error}`)
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
			if (this.trackerDebounce) {
				clearTimeout(this.trackerDebounce)
			}
			const targetPath = filePath
			this.trackerDebounce = setTimeout(async () => {
				try {
					await this.handleFileEdited(listeningTask, targetPath)
				} catch (error) {
					this.provider.log(`FilesChanged: tracker refresh failed: ${error}`)
				}
			}, 150)
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
						console.warn(`FilesChangedMessageHandler: No file change data found for URI: ${message.uri}`)
						vscode.window.showInformationMessage(`No changes found for ${message.uri}`)
					}
				} catch (error) {
					console.error(`FilesChangedMessageHandler: Failed to open diff for ${message.uri}:`, error)
					vscode.window.showErrorMessage(`Failed to open diff for ${message.uri}: ${error.message}`)
				}
			} else {
				console.warn(`FilesChangedMessageHandler: File change not found in changeset for URI: ${message.uri}`)
				vscode.window.showInformationMessage(`File change not found for ${message.uri}`)
			}
		} else {
			console.warn(`FilesChangedMessageHandler: Missing dependencies for viewDiff. URI: ${message.uri}`)
			vscode.window.showErrorMessage("Unable to view diff - missing required dependencies")
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
		const task = this.resolveTask()
		const manager = this.getManager(task) ?? this.ensureManager(task)
		if (!manager || !message.uri) {
			return
		}

		manager.acceptChange(message.uri)
		this.provider.log(`FilesChanged: Accepted change for ${message.uri} in task ${task?.taskId ?? "unknown"}`)
		this.postChanges(manager)
	}

	private async handleRejectFileChange(message: WebviewMessage): Promise<void> {
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
			this.provider.log(`FilesChanged: Rejected change for ${message.uri} in task ${task?.taskId ?? "unknown"}`)
			this.postChanges(manager)
			currentTask.fileContextTracker?.emit?.("user_edited", message.uri)
		} catch (error) {
			this.provider.log(`FilesChanged: Error reverting file ${message.uri}: ${error}`)
			manager.rejectChange(message.uri)
			this.provider.log(`FilesChanged: Rejected change for ${message.uri} in task ${task?.taskId ?? "unknown"}`)
			this.postChanges(manager)
		}
	}

	private async handleAcceptAllFileChanges(): Promise<void> {
		const task = this.resolveTask()
		const manager = this.getManager(task) ?? this.ensureManager(task)
		const checkpointService = task?.checkpointService
		const nextBaseline = checkpointService?.getCurrentCheckpoint?.()

		manager?.acceptAll()
		this.provider.log(`FilesChanged: Accepted all changes for task ${task?.taskId ?? "unknown"}`)
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
			const filesToReject = message.uris
				? changeset.files.filter((file: any) => message.uris!.includes(file.uri))
				: changeset.files

			for (const fileChange of filesToReject) {
				try {
					await this.revertFileToCheckpoint(fileChange.uri, fileChange.fromCheckpoint, checkpointService)
				} catch (error) {
					this.provider.log(`FilesChanged: Failed to revert ${fileChange.uri}: ${error}`)
				}
			}

			manager.rejectAll()
			this.provider.log(
				`FilesChanged: Rejected ${filesToReject.length} change(s) for task ${task?.taskId ?? "unknown"}`,
			)
			this.prepareForNextCheckpoint(currentTask, undefined, manager)
		} catch (error) {
			this.provider.log(`FilesChanged: Failed to reject all changes: ${error}`)
			manager.rejectAll()
			this.provider.log(`FilesChanged: Rejected all remaining changes for task ${task?.taskId ?? "unknown"}`)
			this.prepareForNextCheckpoint(currentTask, undefined, manager)
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
			this.provider.log(`FilesChangedMessageHandler: Error handling filesChangedRequest: ${error}`)
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
			this.provider.log(`FilesChangedMessageHandler: Failed to update baseline: ${error}`)
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
		if (this.isEnabled) {
			try {
				await getCheckpointService(task)
			} catch (error) {
				this.provider.log(`FilesChanged: Failed to initialize checkpoint service: ${error}`)
			}

			// Only reattach if we're not already attached to this task, or if there are pending child files
			const taskState = this.getState(task)
			const needsReattach = this.activeTask !== task || (taskState && taskState.hasQueuedChildUris())

			if (needsReattach) {
				await this.attachToTask(task)
			} else {
				// Just ensure current state is posted if we're already properly attached
				const manager = this.getManager(task)
				if (manager && !this.isWaitingForTask(task)) {
					this.postChanges(manager)
				}
			}
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
			this.provider.log(`FilesChanged: Failed to refresh ${filePath}: ${error}`)

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
			this.provider.log(`FilesChanged: Failed to refresh changes from baseline: ${error}`)
		}
	}

	private mapDiffToFileChange(
		change: any,
		baseline: string,
		stat?: { insertions?: number; deletions?: number; added?: number; removed?: number },
	): FileChange {
		const type = (change.paths.newFile ? "create" : change.paths.deletedFile ? "delete" : "edit") as FileChangeType
		const statInsertions = stat?.insertions ?? stat?.added ?? 0
		const statDeletions = stat?.deletions ?? stat?.removed ?? 0

		let linesAdded = statInsertions
		let linesRemoved = statDeletions

		if (type === "create") {
			const after = change.content?.after || ""
			linesAdded = after === "" ? 0 : after.split("\n").length
			linesRemoved = 0
		} else if (type === "delete") {
			const before = change.content?.before || ""
			linesAdded = 0
			linesRemoved = before === "" ? 0 : before.split("\n").length
		} else if (linesAdded === 0 && linesRemoved === 0) {
			const before = change.content?.before || ""
			const after = change.content?.after || ""
			const diffCounts = FilesChangedManager.calculateLineDifferences(before, after)
			linesAdded = diffCounts.linesAdded
			linesRemoved = diffCounts.linesRemoved
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
		this.provider.postMessageToWebview({
			type: "filesChanged",
			filesChanged: changeset.files.length > 0 ? changeset : undefined,
		})
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
		this.provider.log(`FilesChanged: Cleared state; waiting for next checkpoint${suffix} to re-establish baseline`)
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

				if (!fallbackBaseline) {
					this.provider.log(
						`FilesChanged: No baseline available for fallback diff on subtask ${childTask.taskId}`,
					)
				} else {
					const checkpointDiff = await childTask.checkpointService.getDiff({ from: fallbackBaseline })
					if (checkpointDiff && checkpointDiff.length > 0) {
						pendingUris = checkpointDiff.map((diff: any) => diff.paths.relative)
						this.provider.log(
							`FilesChanged: Fallback detected ${pendingUris.length} file(s) from subtask ${childTask.taskId} via diff from ${fallbackBaseline}`,
						)
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
			this.provider.log(
				`FilesChanged: Ignored queued files from subtask ${childTaskId} because FilesChanged is disabled`,
			)
			return
		}

		const state = this.ensureState(parentTask)!
		state.queueChildUris(childFileUris)

		if (!this.isWaitingForTask(parentTask)) {
			void this.drainQueuedUris(parentTask)
		}

		this.provider.log(
			`FilesChanged: Queued ${childFileUris.length} file(s) from subtask ${childTaskId} for parent ${parentTask.taskId}`,
		)
	}
}
