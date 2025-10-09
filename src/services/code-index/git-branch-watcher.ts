import * as vscode from "vscode"
import { getCurrentBranch } from "../../utils/git"

/**
 * Callback function type for branch change events
 */
export type BranchChangeCallback = (oldBranch: string | undefined, newBranch: string | undefined) => Promise<void>

/**
 * Configuration options for GitBranchWatcher
 */
export interface GitBranchWatcherConfig {
	/** Debounce delay in milliseconds (default: 500ms) */
	debounceMs?: number
	/** Whether the watcher is enabled */
	enabled: boolean
}

/**
 * Watches for Git branch changes in a workspace and notifies listeners.
 *
 * Responsibilities:
 * - Monitor .git/HEAD file for changes
 * - Detect branch switches
 * - Debounce rapid changes
 * - Cache current branch to avoid redundant I/O
 * - Notify listeners of branch changes
 */
export class GitBranchWatcher implements vscode.Disposable {
	private _watcher?: vscode.FileSystemWatcher
	private _currentBranch?: string
	private _debounceTimer?: ReturnType<typeof setTimeout>
	private _callback: BranchChangeCallback
	private _config: GitBranchWatcherConfig
	private readonly _workspacePath: string

	/**
	 * Creates a new GitBranchWatcher
	 * @param workspacePath Path to the workspace to watch
	 * @param callback Function to call when branch changes
	 * @param config Configuration options
	 */
	constructor(workspacePath: string, callback: BranchChangeCallback, config: GitBranchWatcherConfig) {
		this._workspacePath = workspacePath
		this._callback = callback
		this._config = config
	}

	/**
	 * Initializes the watcher and starts monitoring for branch changes
	 */
	async initialize(): Promise<void> {
		if (!this._config.enabled) {
			this.dispose()
			return
		}

		// Cache initial branch to avoid redundant I/O
		this._currentBranch = await getCurrentBranch(this._workspacePath)

		// Only create watcher if it doesn't exist
		if (!this._watcher) {
			const pattern = new vscode.RelativePattern(this._workspacePath, ".git/HEAD")
			this._watcher = vscode.workspace.createFileSystemWatcher(pattern)

			const handler = () => this._onGitHeadChange()
			this._watcher.onDidChange(handler)
			this._watcher.onDidCreate(handler)
			this._watcher.onDidDelete(handler)
		}
	}

	/**
	 * Updates the watcher configuration
	 * @param config New configuration
	 */
	async updateConfig(config: GitBranchWatcherConfig): Promise<void> {
		this._config = config
		await this.initialize()
	}

	/**
	 * Gets the currently cached branch name
	 * @returns Current branch name or undefined if not in a git repo
	 */
	getCurrentBranch(): string | undefined {
		return this._currentBranch
	}

	/**
	 * Handles .git/HEAD file changes with debouncing
	 */
	private _onGitHeadChange(): void {
		// Clear existing debounce timer
		if (this._debounceTimer) {
			clearTimeout(this._debounceTimer)
		}

		// Debounce to handle rapid branch switches
		const debounceMs = this._config.debounceMs ?? 500
		this._debounceTimer = setTimeout(async () => {
			try {
				if (!this._config.enabled) return

				// Detect branch change
				const oldBranch = this._currentBranch
				const newBranch = await getCurrentBranch(this._workspacePath)

				// Only notify if branch actually changed
				if (newBranch !== oldBranch) {
					// Update cached branch BEFORE calling callback
					// This ensures getCurrentBranch() returns the new branch immediately
					this._currentBranch = newBranch

					// Notify listener
					await this._callback(oldBranch, newBranch)
				}
			} catch (error) {
				console.error("[GitBranchWatcher] Failed to handle branch change:", error)
			}
		}, debounceMs)
	}

	/**
	 * Disposes the watcher and cleans up resources
	 */
	dispose(): void {
		if (this._debounceTimer) {
			clearTimeout(this._debounceTimer)
			this._debounceTimer = undefined
		}

		if (this._watcher) {
			this._watcher.dispose()
			this._watcher = undefined
		}

		this._currentBranch = undefined
	}
}
