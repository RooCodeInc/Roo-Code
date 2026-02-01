import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as vscode from "vscode"
import { getTaskDirectoryPath } from "../../utils/storage"
import { GlobalFileNames } from "../../shared/globalFileNames"
import { fileExistsAtPath } from "../../utils/fs"
import fs from "fs/promises"
import { ContextProxy } from "../config/ContextProxy"
import type { FileMetadataEntry, RecordSource, TaskMetadata } from "./FileContextTrackerTypes"
import { ClineProvider } from "../webview/ClineProvider"

// ============================================================================
// Usage Tracking Interfaces
// ============================================================================

/**
 * Tracks usage statistics for files.
 * Used to identify "hot" files that are frequently accessed.
 */
export interface UsageStats {
	readCount: number
	lastAccessed: number
	editCount: number
}

/**
 * Cached summary data for avoiding recalculation.
 */
export interface ContextSummary {
	summary: string
	tokenCount: number
	timestamp: number
	messagesHash: string
}

// This class is responsible for tracking file operations that may result in stale context.
// If a user modifies a file outside of Roo, the context may become stale and need to be updated.
// We do not want Roo to reload the context every time a file is modified, so we use this class merely
// to inform Roo that the change has occurred, and tell Roo to reload the file before making
// any changes to it. This fixes an issue with diff editing, where Roo was unable to complete a diff edit.

// FileContextTracker
//
// This class is responsible for tracking file operations.
// If the full contents of a file are passed to Roo via a tool, mention, or edit, the file is marked as active.
// If a file is modified outside of Roo, we detect and track this change to prevent stale context.
export class FileContextTracker {
	readonly taskId: string
	private providerRef: WeakRef<ClineProvider>

	// File tracking and watching
	private fileWatchers = new Map<string, vscode.FileSystemWatcher>()
	private recentlyModifiedFiles = new Set<string>()
	private recentlyEditedByRoo = new Set<string>()
	private checkpointPossibleFiles = new Set<string>()

	// Phase 3: Usage Tracking for hot files detection
	private usageStats: Map<string, UsageStats> = new Map()

	// Phase 3: Context Memory for persistent summary caching
	private summaryCache: Map<string, ContextSummary> = new Map()

	// Threshold for determining stale watchers (24 hours)
	private readonly STALE_WATCHER_THRESHOLD_MS = 24 * 60 * 60 * 1000

	constructor(provider: ClineProvider, taskId: string) {
		this.providerRef = new WeakRef(provider)
		this.taskId = taskId
	}

	// Gets the current working directory or returns undefined if it cannot be determined
	private getCwd(): string | undefined {
		const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
		if (!cwd) {
			console.info("No workspace folder available - cannot determine current working directory")
		}
		return cwd
	}

	// ============================================================================
	// Phase 3: Usage Tracking Methods
	// ============================================================================

	/**
	 * Tracks a file access for usage statistics.
	 * @param filePath - Path of the file accessed
	 * @param isEdit - Whether this was an edit operation
	 */
	private trackUsage(filePath: string, isEdit: boolean): void {
		const now = Date.now()
		const existing = this.usageStats.get(filePath)

		if (existing) {
			if (isEdit) {
				existing.editCount++
			} else {
				existing.readCount++
			}
			existing.lastAccessed = now
		} else {
			this.usageStats.set(filePath, {
				readCount: isEdit ? 0 : 1,
				lastAccessed: now,
				editCount: isEdit ? 1 : 0,
			})
		}
	}

	/**
	 * Gets the most frequently accessed files (hot files).
	 * @param limit - Maximum number of files to return (default: 10)
	 * @returns Array of file paths sorted by read count (descending)
	 */
	getHotFiles(limit: number = 10): string[] {
		return Array.from(this.usageStats.entries())
			.sort((a, b) => b[1].readCount - a[1].readCount)
			.slice(0, limit)
			.map(([path]) => path)
	}

	/**
	 * Gets usage statistics for a specific file.
	 * @param filePath - Path of the file
	 * @returns UsageStats or undefined if not tracked
	 */
	getUsageStats(filePath: string): UsageStats | undefined {
		return this.usageStats.get(filePath)
	}

	/**
	 * Gets all usage statistics.
	 * @returns Map of file paths to UsageStats
	 */
	getAllUsageStats(): Map<string, UsageStats> {
		return new Map(this.usageStats)
	}

	// ============================================================================
	// Phase 3: Context Summary Caching Methods
	// ============================================================================

	/**
	 * Gets a cached summary if it exists and is still valid.
	 * @param messagesHash - Hash of the messages that generated this summary
	 * @returns ContextSummary or undefined if not cached or expired
	 */
	getCachedSummary(messagesHash: string): ContextSummary | undefined {
		const cached = this.summaryCache.get(messagesHash)
		if (!cached) {
			return undefined
		}

		// Cache expires after 1 hour to ensure summaries stay current
		const ONE_HOUR_MS = 60 * 60 * 1000
		if (Date.now() - cached.timestamp > ONE_HOUR_MS) {
			this.summaryCache.delete(messagesHash)
			return undefined
		}

		return cached
	}

	/**
	 * Caches a summary for later reuse.
	 * @param messagesHash - Hash of the messages that generated this summary
	 * @param summary - The summary content
	 * @param tokenCount - Token count of the summary
	 */
	cacheSummary(messagesHash: string, summary: string, tokenCount: number): void {
		this.summaryCache.set(messagesHash, {
			summary,
			tokenCount,
			timestamp: Date.now(),
			messagesHash,
		})
	}

	/**
	 * Clears the summary cache.
	 */
	clearSummaryCache(): void {
		this.summaryCache.clear()
	}

	/**
	 * Gets the size of the summary cache.
	 * @returns Number of cached summaries
	 */
	getSummaryCacheSize(): number {
		return this.summaryCache.size
	}

	// ============================================================================
	// Phase 3: Memory Leak Prevention Methods
	// ============================================================================

	/**
	 * Checks if a file watcher is stale (not accessed recently).
	 * @param filePath - Path of the file being watched
	 * @returns true if the watcher is stale
	 */
	private isStale(filePath: string): boolean {
		const stats = this.usageStats.get(filePath)
		if (!stats) {
			// If no usage stats, check if watcher was created long ago
			// Default to stale if we have no information
			return true
		}
		return Date.now() - stats.lastAccessed > this.STALE_WATCHER_THRESHOLD_MS
	}

	/**
	 * Cleans up stale file watchers to prevent memory leaks.
	 * Removes watchers for files that haven't been accessed in 24 hours.
	 */
	cleanupWatchers(): void {
		for (const [filePath, watcher] of this.fileWatchers) {
			if (this.isStale(filePath)) {
				watcher.dispose()
				this.fileWatchers.delete(filePath)
				this.usageStats.delete(filePath)
			}
		}
	}

	/**
	 * Force cleanup of all watchers and stats.
	 * Use when disposing the tracker.
	 */
	forceCleanup(): void {
		for (const watcher of this.fileWatchers.values()) {
			watcher.dispose()
		}
		this.fileWatchers.clear()
		this.usageStats.clear()
		this.summaryCache.clear()
	}

	// File watchers are set up for each file that is tracked in the task metadata.
	async setupFileWatcher(filePath: string) {
		// Only setup watcher if it doesn't already exist for this file
		if (this.fileWatchers.has(filePath)) {
			return
		}

		const cwd = this.getCwd()
		if (!cwd) {
			return
		}

		// Create a file system watcher for this specific file
		const fileUri = vscode.Uri.file(path.resolve(cwd, filePath))
		const watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(path.dirname(fileUri.fsPath), path.basename(fileUri.fsPath)),
		)

		// Track file changes
		watcher.onDidChange(() => {
			if (this.recentlyEditedByRoo.has(filePath)) {
				this.recentlyEditedByRoo.delete(filePath) // This was an edit by Roo, no need to inform Roo
			} else {
				this.recentlyModifiedFiles.add(filePath) // This was a user edit, we will inform Roo
				this.trackFileContext(filePath, "user_edited") // Update the task metadata with file tracking
			}
		})

		// Store the watcher so we can dispose it later
		this.fileWatchers.set(filePath, watcher)
	}

	// Tracks a file operation in metadata and sets up a watcher for the file
	// This is the main entry point for FileContextTracker and is called when a file is passed to Roo via a tool, mention, or edit.
	async trackFileContext(filePath: string, operation: RecordSource) {
		try {
			const cwd = this.getCwd()
			if (!cwd) {
				return
			}

			// Phase 3: Track usage statistics
			const isEdit = operation === "roo_edited" || operation === "user_edited"
			this.trackUsage(filePath, isEdit)

			await this.addFileToFileContextTracker(this.taskId, filePath, operation)

			// Set up file watcher for this file
			await this.setupFileWatcher(filePath)
		} catch (error) {
			console.error("Failed to track file operation:", error)
		}
	}

	public getContextProxy(): ContextProxy | undefined {
		const provider = this.providerRef.deref()
		if (!provider) {
			console.error("ClineProvider reference is no longer valid")
			return undefined
		}
		const context = provider.contextProxy

		if (!context) {
			console.error("Context is not available")
			return undefined
		}

		return context
	}

	// Gets task metadata from storage
	async getTaskMetadata(taskId: string): Promise<TaskMetadata> {
		const globalStoragePath = this.getContextProxy()?.globalStorageUri.fsPath ?? ""
		const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
		const filePath = path.join(taskDir, GlobalFileNames.taskMetadata)
		try {
			if (await fileExistsAtPath(filePath)) {
				return JSON.parse(await fs.readFile(filePath, "utf8"))
			}
		} catch (error) {
			console.error("Failed to read task metadata:", error)
		}
		return { files_in_context: [] }
	}

	// Saves task metadata to storage
	async saveTaskMetadata(taskId: string, metadata: TaskMetadata) {
		try {
			const globalStoragePath = this.getContextProxy()!.globalStorageUri.fsPath
			const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
			const filePath = path.join(taskDir, GlobalFileNames.taskMetadata)
			await safeWriteJson(filePath, metadata)
		} catch (error) {
			console.error("Failed to save task metadata:", error)
		}
	}

	// Adds a file to the metadata tracker
	// This handles the business logic of determining if the file is new, stale, or active.
	// It also updates the metadata with the latest read/edit dates.
	async addFileToFileContextTracker(taskId: string, filePath: string, source: RecordSource) {
		try {
			const metadata = await this.getTaskMetadata(taskId)
			const now = Date.now()

			// Mark existing entries for this file as stale
			metadata.files_in_context.forEach((entry) => {
				if (entry.path === filePath && entry.record_state === "active") {
					entry.record_state = "stale"
				}
			})

			// Helper to get the latest date for a specific field and file
			const getLatestDateForField = (path: string, field: keyof FileMetadataEntry): number | null => {
				const relevantEntries = metadata.files_in_context
					.filter((entry) => entry.path === path && entry[field])
					.sort((a, b) => (b[field] as number) - (a[field] as number))

				return relevantEntries.length > 0 ? (relevantEntries[0][field] as number) : null
			}

			let newEntry: FileMetadataEntry = {
				path: filePath,
				record_state: "active",
				record_source: source,
				roo_read_date: getLatestDateForField(filePath, "roo_read_date"),
				roo_edit_date: getLatestDateForField(filePath, "roo_edit_date"),
				user_edit_date: getLatestDateForField(filePath, "user_edit_date"),
			}

			switch (source) {
				// user_edited: The user has edited the file
				case "user_edited":
					newEntry.user_edit_date = now
					this.recentlyModifiedFiles.add(filePath)
					break

				// roo_edited: Roo has edited the file
				case "roo_edited":
					newEntry.roo_read_date = now
					newEntry.roo_edit_date = now
					this.checkpointPossibleFiles.add(filePath)
					this.markFileAsEditedByRoo(filePath)
					break

				// read_tool/file_mentioned: Roo has read the file via a tool or file mention
				case "read_tool":
				case "file_mentioned":
					newEntry.roo_read_date = now
					break
			}

			metadata.files_in_context.push(newEntry)
			await this.saveTaskMetadata(taskId, metadata)
		} catch (error) {
			console.error("Failed to add file to metadata:", error)
		}
	}

	// Returns (and then clears) the set of recently modified files
	getAndClearRecentlyModifiedFiles(): string[] {
		const files = Array.from(this.recentlyModifiedFiles)
		this.recentlyModifiedFiles.clear()
		return files
	}

	/**
	 * Gets a list of unique file paths that Roo has read during this task.
	 * Files are sorted by most recently read first, so if there's a character
	 * budget during folded context generation, the most relevant (recent) files
	 * are prioritized.
	 *
	 * @param sinceTimestamp - Optional timestamp to filter files read after this time
	 * @returns Array of unique file paths that have been read, most recent first
	 */
	async getFilesReadByRoo(sinceTimestamp?: number): Promise<string[]> {
		try {
			const metadata = await this.getTaskMetadata(this.taskId)

			const readEntries = metadata.files_in_context.filter((entry) => {
				// Only include files that were read by Roo (not user edits)
				const isReadByRoo = entry.record_source === "read_tool" || entry.record_source === "file_mentioned"
				if (!isReadByRoo) {
					return false
				}

				// If sinceTimestamp is provided, only include files read after that time
				if (sinceTimestamp && entry.roo_read_date) {
					return entry.roo_read_date >= sinceTimestamp
				}

				return true
			})

			// Sort by roo_read_date descending (most recent first)
			// Entries without a date go to the end
			readEntries.sort((a, b) => {
				const dateA = a.roo_read_date ?? 0
				const dateB = b.roo_read_date ?? 0
				return dateB - dateA
			})

			// Deduplicate while preserving order (first occurrence = most recent read)
			const seen = new Set<string>()
			const uniquePaths: string[] = []
			for (const entry of readEntries) {
				if (!seen.has(entry.path)) {
					seen.add(entry.path)
					uniquePaths.push(entry.path)
				}
			}

			return uniquePaths
		} catch (error) {
			console.error("Failed to get files read by Roo:", error)
			return []
		}
	}

	getAndClearCheckpointPossibleFile(): string[] {
		const files = Array.from(this.checkpointPossibleFiles)
		this.checkpointPossibleFiles.clear()
		return files
	}

	// Marks a file as edited by Roo to prevent false positives in file watchers
	markFileAsEditedByRoo(filePath: string): void {
		this.recentlyEditedByRoo.add(filePath)
	}

	// Disposes all file watchers
	dispose(): void {
		for (const watcher of this.fileWatchers.values()) {
			watcher.dispose()
		}
		this.fileWatchers.clear()
		this.usageStats.clear()
		this.summaryCache.clear()
	}
}
