import * as vscode from "vscode"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

export class CodeIndexStateManager {
	private _systemStatus: IndexingState = "Standby"
	private _statusMessage: string = ""
	private _totalFiles: number = 0
	private _currentProcessedFiles: number = 0
	private _currentProcessingFiles: number = 0
	private _totalPendingBlocksCount: number = 0
	private _processedPendingBlocks: number = 0
	private _progressEmitter = new vscode.EventEmitter<ReturnType<typeof this.getCurrentStatus>>()
	private _debounceTimer: ReturnType<typeof setTimeout> | undefined = undefined

	// --- Public API ---

	public readonly onProgressUpdate = this._progressEmitter.event

	public get state(): IndexingState {
		return this._systemStatus
	}

	public getCurrentStatus() {
		return {
			systemStatus: this._systemStatus,
			message: this._statusMessage,
			progress: this.calculateProgress(),
		}
	}

	// --- State Management ---

	public setSystemState(newState: IndexingState, message?: string): void {
		const stateChanged =
			newState !== this._systemStatus || (message !== undefined && message !== this._statusMessage)

		if (stateChanged) {
			this._systemStatus = newState
			if (message !== undefined) {
				this._statusMessage = message
			}

			// Reset progress counters if moving to a non-indexing state or starting fresh
			if (newState !== "Indexing") {
				this._totalFiles = 0
				this._currentProcessedFiles = 0
				this._currentProcessingFiles = 0
				this._totalPendingBlocksCount = 0
				this._processedPendingBlocks = 0
				// Optionally clear the message or set a default for non-indexing states
				if (newState === "Standby" && message === undefined) this._statusMessage = "Ready."
				if (newState === "Indexed" && message === undefined) this._statusMessage = "Index up-to-date."
				if (newState === "Error" && message === undefined) this._statusMessage = "An error occurred."
			}

			this._progressEmitter.fire(this.getCurrentStatus())
		}
	}

	/**
	 * Private helper method to ensure the system is in "Indexing" state and fire the progress emitter.
	 * Debounced to fire maximum 10 times per second (100ms interval).
	 * @returns Whether the system status was changed to "Indexing"
	 */
	private fireProgressUpdate() {
		if (this._debounceTimer !== undefined) {
			clearTimeout(this._debounceTimer)
		}

		this._debounceTimer = setTimeout(() => {
			if (this._totalFiles === 0 && this._totalPendingBlocksCount === 0) {
				return
			}

			this._systemStatus = "Indexing"
			this._statusMessage = `Indexed `

			if (this._totalFiles > 0) {
				this._statusMessage += `${this._currentProcessedFiles} / ${this._totalFiles} files found`
			}
			if (this._totalPendingBlocksCount > 0) {
				this._statusMessage += `, ${this._totalPendingBlocksCount - this._processedPendingBlocks} blocks pending`
			} else {
				this._statusMessage += `, waiting for pending blocks`
			}

			this._statusMessage += `.`
			this._progressEmitter.fire(this.getCurrentStatus())
		}, 100)
	}

	public reportFileParsed(fileBlockCount: number) {
		this._totalPendingBlocksCount += fileBlockCount
		this._currentProcessingFiles++
		this.fireProgressUpdate()
	}

	public reportFileDiscovered(): void {
		this._totalFiles++
		this.fireProgressUpdate()
	}

	public reportBlocksIndexed(blocks: number) {
		this._processedPendingBlocks += blocks
		this.fireProgressUpdate()
	}

	public reportFilesProgress(processed: number, total: number) {
		this._currentProcessingFiles = 0
		this._totalPendingBlocksCount = 0
		this._processedPendingBlocks = 0
		this._currentProcessedFiles = processed
		this._totalFiles = total
		this.fireProgressUpdate()
	}

	public reportFileFullyProcessedOrAlreadyProcessed(fileBlockCount?: number) {
		this._currentProcessedFiles++
		this._currentProcessingFiles--
		this._totalPendingBlocksCount -= fileBlockCount || 0
		// Some blocks are skipped during indexing, so that's perfectly normal
		this._processedPendingBlocks = Math.max(0, this._processedPendingBlocks - (fileBlockCount || 0))
		if (fileBlockCount !== undefined) {
			this.fireProgressUpdate()
		}
	}

	/**
	 * Calculates and returns the overall progress as a percentage.
	 * Formula: (_currentProcessedFiles / _totalFiles) + (_currentProcessingFiles / _totalFiles) * (_processedPendingBlocks / _totalPendingBlocksCount)
	 * This gives:
	 * - Full credit for fully processed files
	 * - Partial credit for files currently being processed, based on their block progress
	 * @returns Progress percentage (0-100)
	 */
	public calculateProgress(): number {
		if (this._totalFiles === 0) {
			return 0
		}

		// File-level progress contribution (fully processed files)
		const fileProgress = this._currentProcessedFiles / this._totalFiles

		// Block-level progress contribution for files currently being processed
		let blockProgress = 0
		if (this._totalPendingBlocksCount > 0 && this._currentProcessingFiles > 0) {
			const processingFilesProgress = this._currentProcessingFiles / this._totalFiles
			const blockFraction = this._processedPendingBlocks / this._totalPendingBlocksCount
			blockProgress = processingFilesProgress * blockFraction
		}

		return Math.min(100, Math.round((fileProgress + blockProgress) * 100))
	}

	public dispose(): void {
		// Clear any pending debounce timer and fire the final update immediately
		if (this._debounceTimer !== undefined) {
			clearTimeout(this._debounceTimer)
			this._debounceTimer = undefined
			// Fire the final update to ensure the last state is emitted
			this._progressEmitter.fire(this.getCurrentStatus())
		}
		this._progressEmitter.dispose()
	}
}
