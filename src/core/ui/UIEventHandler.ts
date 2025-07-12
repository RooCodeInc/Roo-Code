import { EventBus } from "../events/EventBus"
import { StreamEventType, DiffUpdateEvent, TaskProgressEvent, ErrorDisplayEvent } from "../events/types"
import { DiffViewProvider } from "../../integrations/editor/DiffViewProvider"

/**
 * Handles UI updates through event-based communication.
 * This class decouples business logic from UI concerns by subscribing to UI events
 * and delegating the actual UI operations to appropriate providers.
 */
export class UIEventHandler {
	private eventBus: EventBus
	private diffViewProvider: DiffViewProvider
	private taskId: string

	constructor(taskId: string, eventBus: EventBus, diffViewProvider: DiffViewProvider) {
		this.taskId = taskId
		this.eventBus = eventBus
		this.diffViewProvider = diffViewProvider
		this.setupEventSubscriptions()
	}

	/**
	 * Set up event subscriptions for UI updates
	 */
	private setupEventSubscriptions(): void {
		// Subscribe to diff update events
		this.eventBus.on(StreamEventType.DIFF_UPDATE_NEEDED, (event: DiffUpdateEvent) => {
			this.handleDiffUpdate(event).catch(console.error)
		})

		// Subscribe to task progress events
		this.eventBus.on(StreamEventType.TASK_PROGRESS_UPDATE, (event: TaskProgressEvent) => {
			this.handleTaskProgress(event).catch(console.error)
		})

		// Subscribe to error display events
		this.eventBus.on(StreamEventType.ERROR_DISPLAY_NEEDED, (event: ErrorDisplayEvent) => {
			this.handleErrorDisplay(event).catch(console.error)
		})

		// Keep existing diff view events
		this.eventBus.on(StreamEventType.DIFF_VIEW_REVERT_NEEDED, () => {
			this.handleDiffRevert().catch(console.error)
		})
	}

	/**
	 * Handle diff update events
	 */
	private async handleDiffUpdate(event: DiffUpdateEvent): Promise<void> {
		try {
			switch (event.action) {
				case "reset":
					await this.diffViewProvider.reset()
					break
				case "revert":
					if (this.diffViewProvider.isEditing) {
						await this.diffViewProvider.revertChanges()
					}
					break
				case "apply":
					// Handle apply operations if needed
					// This would depend on the DiffViewProvider API
					break
				default:
					console.warn(`Unknown diff action: ${event.action}`)
			}
		} catch (error) {
			console.error(`Error handling diff update for task ${this.taskId}:`, error)
		}
	}

	/**
	 * Handle diff revert events (legacy support)
	 */
	private async handleDiffRevert(): Promise<void> {
		try {
			if (this.diffViewProvider.isEditing) {
				await this.diffViewProvider.revertChanges()
			}
		} catch (error) {
			console.error(`Error handling diff revert for task ${this.taskId}:`, error)
		}
	}

	/**
	 * Handle task progress updates
	 */
	private async handleTaskProgress(event: TaskProgressEvent): Promise<void> {
		try {
			// For now, log the progress update
			// In the future, this could update progress bars, status indicators, etc.
			const message = event.message || `Stage: ${event.stage}`
			console.log(`Task ${this.taskId} progress: ${event.stage} - ${message}`)

			if (event.progress !== undefined) {
				console.log(`Progress: ${event.progress}%`)
			}

			// Additional UI updates could be added here:
			// - Update progress bars
			// - Show status indicators
			// - Update task status in UI
		} catch (error) {
			console.error(`Error handling task progress for task ${this.taskId}:`, error)
		}
	}

	/**
	 * Handle error display events
	 */
	private async handleErrorDisplay(event: ErrorDisplayEvent): Promise<void> {
		try {
			// For now, log the error
			// In the future, this could show error dialogs, notifications, etc.
			const errorMessage = typeof event.error === "string" ? event.error : event.error.message
			console.error(`Task ${this.taskId} error [${event.severity}][${event.category}]: ${errorMessage}`)

			if (event.context) {
				console.error("Error context:", event.context)
			}

			if (event.metadata) {
				console.error("Error metadata:", event.metadata)
			}

			// Additional UI updates could be added here:
			// - Show error notifications
			// - Display error dialogs
			// - Update error indicators in UI
		} catch (error) {
			console.error(`Error handling error display for task ${this.taskId}:`, error)
		}
	}

	/**
	 * Check if diff view is currently editing
	 */
	public get isEditing(): boolean {
		return this.diffViewProvider.isEditing
	}

	/**
	 * Reset the diff view
	 */
	public async reset(): Promise<void> {
		await this.diffViewProvider.reset()
	}

	/**
	 * Revert changes in the diff view
	 */
	public async revertChanges(): Promise<void> {
		if (this.diffViewProvider.isEditing) {
			await this.diffViewProvider.revertChanges()
		}
	}

	/**
	 * Emit a diff update event
	 */
	public emitDiffUpdate(
		action: "reset" | "revert" | "apply" | "show" | "hide",
		filePath?: string,
		metadata?: Record<string, any>,
	): void {
		this.eventBus.emit(StreamEventType.DIFF_UPDATE_NEEDED, {
			taskId: this.taskId,
			timestamp: Date.now(),
			action,
			filePath,
			metadata,
		})
	}

	/**
	 * Emit a task progress event
	 */
	public emitTaskProgress(
		stage: "starting" | "processing" | "completing" | "error" | "cancelled",
		message?: string,
		progress?: number,
	): void {
		this.eventBus.emit(StreamEventType.TASK_PROGRESS_UPDATE, {
			taskId: this.taskId,
			timestamp: Date.now(),
			stage,
			message,
			progress,
		})
	}

	/**
	 * Emit an error display event
	 */
	public emitError(
		error: Error | string,
		severity: "info" | "warning" | "error" | "critical" = "error",
		category: "api" | "tool" | "system" | "validation" | "retry" = "system",
	): void {
		this.eventBus.emit(StreamEventType.ERROR_DISPLAY_NEEDED, {
			taskId: this.taskId,
			timestamp: Date.now(),
			error,
			severity,
			category,
		})
	}

	/**
	 * Clean up event subscriptions
	 */
	public dispose(): void {
		// Remove event listeners to prevent memory leaks
		this.eventBus.off(StreamEventType.DIFF_UPDATE_NEEDED, this.handleDiffUpdate.bind(this))
		this.eventBus.off(StreamEventType.TASK_PROGRESS_UPDATE, this.handleTaskProgress.bind(this))
		this.eventBus.off(StreamEventType.ERROR_DISPLAY_NEEDED, this.handleErrorDisplay.bind(this))
		this.eventBus.off(StreamEventType.DIFF_VIEW_REVERT_NEEDED, this.handleDiffRevert.bind(this))
	}
}
