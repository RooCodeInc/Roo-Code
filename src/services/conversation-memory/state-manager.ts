import * as vscode from "vscode"
import { MemoryStatus } from "./interfaces"

export interface ProgressData {
	processedEpisodes: number
	totalEpisodes: number
}

export interface ProgressUpdate {
	state: string
	message: string
	progress?: ProgressData
}

export class ConversationMemoryStateManager {
	private _systemState: string = "Standby"
	private _systemMessage: string = ""
	private _progressData: ProgressData = { processedEpisodes: 0, totalEpisodes: 0 }

	// Event emitter for progress updates - matches CodeIndex pattern
	private _onProgressUpdate = new vscode.EventEmitter<ProgressUpdate>()
	public readonly onProgressUpdate = this._onProgressUpdate.event

	public getCurrentStatus(): MemoryStatus {
		return {
			systemState: this._systemState,
			systemMessage: this._systemMessage,
			processedEpisodes: this._progressData.processedEpisodes,
			totalEpisodes: this._progressData.totalEpisodes,
		}
	}

	public setSystemState(state: string, message: string): void {
		this._systemState = state
		this._systemMessage = message

		this._onProgressUpdate.fire({
			state: this._systemState,
			message: this._systemMessage,
			progress: this._progressData,
		})
	}

	public setProcessingState(message: string, progress?: ProgressData): void {
		this._systemState = "Processing"
		this._systemMessage = message
		if (progress) {
			this._progressData = progress
		}

		this._onProgressUpdate.fire({
			state: this._systemState,
			message: this._systemMessage,
			progress: this._progressData,
		})
	}

	public setError(errorMessage: string): void {
		this._systemState = "Error"
		this._systemMessage = errorMessage

		this._onProgressUpdate.fire({
			state: this._systemState,
			message: this._systemMessage,
			progress: this._progressData,
		})
	}

	public updateProgress(processedEpisodes: number, totalEpisodes: number): void {
		this._progressData = { processedEpisodes, totalEpisodes }

		this._onProgressUpdate.fire({
			state: this._systemState,
			message: this._systemMessage,
			progress: this._progressData,
		})
	}

	public dispose(): void {
		this._onProgressUpdate.dispose()
	}
}
