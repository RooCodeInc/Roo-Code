/**
 * ContinuousIndexer — Augment-style always-on background indexing engine.
 *
 * Unlike the standard CodeIndexManager which requires manual triggering,
 * ContinuousIndexer automatically:
 *   1. Starts indexing on extension activation
 *   2. Watches for file saves and re-indexes incrementally (not full re-scan)
 *   3. Prioritizes recently edited files for faster context relevance
 *   4. Emits events so the UI can show live indexing status
 */

import * as vscode from "vscode"
import * as path from "path"
import EventEmitter from "events"

export interface IndexingUpdate {
	status: "idle" | "indexing" | "ready" | "error"
	filesQueued: number
	filesProcessed: number
	currentFile?: string
	message?: string
}

export interface ContinuousIndexerEvents {
	update: [update: IndexingUpdate]
	fileIndexed: [filePath: string]
	ready: []
}

const DEBOUNCE_MS = 1500 // wait 1.5s after last save before re-indexing
const PRIORITY_EXTENSIONS = new Set([
	".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".cs", ".cpp", ".c", ".rb", ".php",
])
const IGNORED_PATTERNS = [
	"node_modules", ".git", "dist", "build", "out", ".next", "__pycache__",
	".roo", ".joe-memory.json", "*.min.js", "*.map",
]

export class ContinuousIndexer extends EventEmitter {
	private static instances = new Map<string, ContinuousIndexer>()

	private disposables: vscode.Disposable[] = []
	private pendingFiles = new Map<string, NodeJS.Timeout>() // file -> debounce timer
	private recentlyIndexedFiles: string[] = []
	private isActive = false
	private status: IndexingUpdate = { status: "idle", filesQueued: 0, filesProcessed: 0 }

	/** Callback that does the actual indexing — wired to CodeIndexManager */
	private indexFileCallback?: (filePath: string) => Promise<void>
	private startFullIndexCallback?: () => Promise<void>

	static getInstance(workspacePath: string): ContinuousIndexer {
		if (!this.instances.has(workspacePath)) {
			this.instances.set(workspacePath, new ContinuousIndexer(workspacePath))
		}
		return this.instances.get(workspacePath)!
	}

	static disposeAll(): void {
		for (const instance of this.instances.values()) {
			instance.dispose()
		}
		this.instances.clear()
	}

	private constructor(private readonly workspacePath: string) {
		super()
	}

	/**
	 * Wire up the actual indexing implementation from CodeIndexManager.
	 */
	setIndexCallbacks(
		indexFile: (filePath: string) => Promise<void>,
		startFullIndex: () => Promise<void>,
	): void {
		this.indexFileCallback = indexFile
		this.startFullIndexCallback = startFullIndex
	}

	/**
	 * Activate continuous indexing. Call once on extension start.
	 */
	async activate(): Promise<void> {
		if (this.isActive) return
		this.isActive = true

		// 1. Start full initial index (non-blocking)
		this.triggerFullIndex()

		// 2. Watch for file saves
		this.disposables.push(
			vscode.workspace.onDidSaveTextDocument((doc) => {
				if (this.shouldIndex(doc.uri.fsPath)) {
					this.scheduleFileIndex(doc.uri.fsPath, "save")
				}
			}),
		)

		// 3. Watch for file creation
		const watcher = vscode.workspace.createFileSystemWatcher("**/*", false, true, false)
		this.disposables.push(
			watcher,
			watcher.onDidCreate((uri) => {
				if (this.shouldIndex(uri.fsPath)) {
					this.scheduleFileIndex(uri.fsPath, "create")
				}
			}),
			watcher.onDidDelete((uri) => {
				// Remove deleted file from recent index list
				this.recentlyIndexedFiles = this.recentlyIndexedFiles.filter((f) => f !== uri.fsPath)
			}),
		)

		// 4. Prioritize active editor file on open
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor((editor) => {
				if (editor && this.shouldIndex(editor.document.uri.fsPath)) {
					// High priority: index immediately without debounce
					this.indexSingleFile(editor.document.uri.fsPath)
				}
			}),
		)
	}

	/**
	 * Get list of recently indexed files (most relevant context).
	 */
	getRecentlyIndexedFiles(limit = 20): string[] {
		return this.recentlyIndexedFiles.slice(-limit)
	}

	/**
	 * Get current status.
	 */
	getStatus(): IndexingUpdate {
		return { ...this.status }
	}

	/**
	 * Manually trigger indexing of a specific file (call from tools).
	 */
	async indexFile(filePath: string): Promise<void> {
		await this.indexSingleFile(filePath)
	}

	dispose(): void {
		this.isActive = false
		for (const timer of this.pendingFiles.values()) {
			clearTimeout(timer)
		}
		this.pendingFiles.clear()
		for (const d of this.disposables) {
			d.dispose()
		}
		this.disposables = []
	}

	// --- Private Methods ---

	private shouldIndex(filePath: string): boolean {
		// Check if file is in workspace
		if (!filePath.startsWith(this.workspacePath)) {
			return false
		}

		// Check ignored patterns
		const relativePath = path.relative(this.workspacePath, filePath)
		for (const pattern of IGNORED_PATTERNS) {
			if (relativePath.includes(pattern)) {
				return false
			}
		}

		// Only index priority extensions (code files)
		const ext = path.extname(filePath).toLowerCase()
		return PRIORITY_EXTENSIONS.has(ext)
	}

	private scheduleFileIndex(filePath: string, reason: string): void {
		// Cancel existing debounce for this file
		const existingTimer = this.pendingFiles.get(filePath)
		if (existingTimer) {
			clearTimeout(existingTimer)
		}

		// Schedule new indexing with debounce
		const timer = setTimeout(async () => {
			this.pendingFiles.delete(filePath)
			await this.indexSingleFile(filePath)
		}, DEBOUNCE_MS)

		this.pendingFiles.set(filePath, timer)

		this.emitUpdate({
			status: "indexing",
			filesQueued: this.pendingFiles.size,
			filesProcessed: this.status.filesProcessed,
			currentFile: path.basename(filePath),
			message: `Queued for indexing (${reason}): ${path.basename(filePath)}`,
		})
	}

	private async indexSingleFile(filePath: string): Promise<void> {
		if (!this.indexFileCallback) {
			return
		}

		try {
			this.emitUpdate({
				status: "indexing",
				filesQueued: this.pendingFiles.size,
				filesProcessed: this.status.filesProcessed,
				currentFile: path.basename(filePath),
				message: `Indexing: ${path.basename(filePath)}`,
			})

			await this.indexFileCallback(filePath)

			// Track recently indexed
			this.recentlyIndexedFiles = this.recentlyIndexedFiles.filter((f) => f !== filePath)
			this.recentlyIndexedFiles.push(filePath)
			if (this.recentlyIndexedFiles.length > 100) {
				this.recentlyIndexedFiles.shift()
			}

			this.emit("fileIndexed", filePath)

			this.emitUpdate({
				status: this.pendingFiles.size > 0 ? "indexing" : "ready",
				filesQueued: this.pendingFiles.size,
				filesProcessed: this.status.filesProcessed + 1,
				message: `Indexed: ${path.basename(filePath)}`,
			})
		} catch (err) {
			console.error(`[ContinuousIndexer] Failed to index ${filePath}:`, err)
		}
	}

	private async triggerFullIndex(): Promise<void> {
		if (!this.startFullIndexCallback) {
			return
		}

		this.emitUpdate({
			status: "indexing",
			filesQueued: 0,
			filesProcessed: 0,
			message: "Starting full workspace index...",
		})

		try {
			await this.startFullIndexCallback()
			this.emitUpdate({
				status: "ready",
				filesQueued: 0,
				filesProcessed: this.status.filesProcessed,
				message: "Workspace index complete. Joe AI context is ready.",
			})
			this.emit("ready")
		} catch (err) {
			console.error("[ContinuousIndexer] Full index failed:", err)
			this.emitUpdate({
				status: "error",
				filesQueued: 0,
				filesProcessed: 0,
				message: `Index error: ${err instanceof Error ? err.message : String(err)}`,
			})
		}
	}

	private emitUpdate(update: IndexingUpdate): void {
		this.status = update
		this.emit("update", update)
	}
}
