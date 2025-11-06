import * as vscode from "vscode"
import * as fs from "fs"
import { ZgsmCodebaseIndexManager } from "./index"
import { WorkspaceEventData, WorkspaceEventRequest } from "./types"
import { TelemetryService } from "@roo-code/telemetry"
import { CodeBaseError } from "../telemetry/constants"
import { ILogger } from "../../../utils/logger"
import { computeHash } from "../base/common"
import { CoIgnoreController } from "./CoIgnoreController"
import { getWorkspacePath } from "../../../utils/path"
import * as path from "path"
import type { ClineProvider } from "../../webview/ClineProvider"
import { LRUCache } from "lru-cache"
import { isPathInIgnoredDirectory } from "../../../services/glob/ignore-utils"
import { scannerExtensions } from "../../../services/code-index/shared/supported-extensions"
import { BINARY_EXTENSIONS } from "../../../utils/encoding"

type FileEventHandler = (uri: vscode.Uri) => void
type RenameEventHandler = (oldPath: vscode.Uri, newPath: vscode.Uri) => void

/**
 * Workspace event monitoring configuration
 */
export interface WorkspaceEventMonitorConfig {
	enabled: boolean
	debounceMs: number
	batchSize: number
	maxRetries: number
	retryDelayMs: number
}

/**
 * Default configuration for codebase-indexer event handling
 */
const DEFAULT_CONFIG: WorkspaceEventMonitorConfig = {
	enabled: true,
	debounceMs: 1000, // Reduced from 1000ms to 500ms for faster response
	batchSize: 100, // Reduced from 100 to 50 for more frequent smaller batches
	maxRetries: 3, // Increased from 2 to 3 for better reliability
	retryDelayMs: 1000,
}

/**
 * Workspace event monitor (singleton pattern)
 * Responsible for monitoring workspace events and pushing them to the server
 */
export class WorkspaceEventMonitor {
	private static instance: WorkspaceEventMonitor
	private isInitialized = false
	private workspaceCache = ""
	private config: WorkspaceEventMonitorConfig = { ...DEFAULT_CONFIG }
	private disposables: vscode.Disposable[] = []
	private eventBuffer: Map<string, WorkspaceEventData> = new Map()
	private flushTimer: NodeJS.Timeout | null = null
	private lastFlushTime = 0
	private logger?: ILogger
	private clineProvider?: ClineProvider
	private ignoreController: CoIgnoreController
	private skipNextDelete = new Set<string>()
	private skipNextCreate = new Set<string>()
	private addHandlers: FileEventHandler[] = []
	private modifyHandlers: FileEventHandler[] = []
	private deleteHandlers: FileEventHandler[] = []
	private renameHandlers: RenameEventHandler[] = []
	private documentContentCache: LRUCache<string, { contentHash: string }> = new LRUCache<
		string,
		{ contentHash: string }
	>({
		max: 500, // Cache 500 entries
		ttl: 10 * 60 * 1000, // 10 minutes TTL
	})

	// Performance monitoring
	private performanceMetrics = {
		eventProcessingTime: 0,
		lastEventCount: 0,
		averageProcessingTime: 0,
		systemLoad: 0,
	}

	/**
	 * Private constructor to ensure singleton pattern
	 */
	private constructor() {
		this.ignoreController = new CoIgnoreController(getWorkspacePath())
		this.ignoreController.initialize().catch((error) => {
			this.log.error("[WorkspaceEventMonitor] Failed to initialize ignore controller:", error.message)
		})
	}

	private get log(): ILogger | Console {
		return this.logger || console
	}
	/**
	 * Get singleton instance
	 */
	public static getInstance(): WorkspaceEventMonitor {
		if (!WorkspaceEventMonitor.instance) {
			WorkspaceEventMonitor.instance = new WorkspaceEventMonitor()
		}
		return WorkspaceEventMonitor.instance
	}

	/**
	 * Initialize event monitor
	 */
	public async initialize(): Promise<void> {
		if (this.isInitialized) {
			this.handleInitialWorkspaceOpen()
			this.log.info("[WorkspaceEventMonitor] Event monitor already initialized, skipping")
			return
		}

		try {
			this.log.info("[WorkspaceEventMonitor] Starting to initialize event monitor")

			// Register VSCode event listeners
			if (typeof vscode !== "undefined" && vscode.workspace) {
				// Register file system monitor to solve command line file deletion issues
				this.registerFileSystemWatcher()
			} else {
				this.log.warn("[WorkspaceEventMonitor] VSCode API not available, skipping event listener registration")
			}

			// Handle currently opened workspaces
			this.handleInitialWorkspaceOpen()

			this.isInitialized = true
			this.log.info("[WorkspaceEventMonitor] Event monitor initialized successfully")
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred while initializing event monitor"
			this.log.error("[WorkspaceEventMonitor] Initialization failed:", errorMessage)
			// Skip telemetry service in test environment
			try {
				if (TelemetryService.instance) {
					TelemetryService.instance.captureError(CodeBaseError.SyncFailed)
				}
			} catch {
				// Ignore telemetry service related errors
			}
			throw new Error(errorMessage)
		}
	}

	/**
	 * Handle VSCode close event
	 */
	public handleVSCodeClose() {
		this.log.debug("[WorkspaceEventMonitor] VSCode close event detected")

		// Send workspace close events
		ZgsmCodebaseIndexManager.getInstance().client?.publishSyncWorkspaceEvents({
			workspace: this.workspaceCache,
			data: [
				{
					eventType: "close_workspace",
					eventTime: `${Date.now()}`,
					sourcePath: "",
					targetPath: "",
				},
			],
		})

		// Continue to destroy event monitor
		this.dispose()
	}

	/**
	 * Destroy event monitor
	 */
	public async dispose() {
		this.log.debug("[WorkspaceEventMonitor] Starting to destroy event monitor")
		// Cancel timers
		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}

		// Clean up event listeners
		this.disposables.forEach((disposable) => disposable.dispose())
		this.disposables = []

		// Clean up document content cache
		this.documentContentCache.clear()
		this.log.debug("[WorkspaceEventMonitor] Document content cache cleared")

		// Send remaining events
		if (this.eventBuffer.size > 0) {
			await this.flushEventsSync()
		}

		this.isInitialized = false
		this.log.debug("[WorkspaceEventMonitor] Event monitor disposed")
	}

	/**
	 * Update configuration
	 */
	public updateConfig(newConfig: Partial<WorkspaceEventMonitorConfig>): void {
		this.config = { ...this.config, ...newConfig }
		this.log.info("[WorkspaceEventMonitor] Configuration updated:", this.config)
	}

	/**
	 * Register file system monitor
	 */
	private registerFileSystemWatcher(): void {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			this.log.warn("[WorkspaceEventMonitor] No workspace folders, skipping file system monitor registration")
			throw new Error("No workspace folders")
		}

		// Workspace folder change events
		if (vscode.workspace.onDidChangeWorkspaceFolders) {
			this.disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(this.handleWorkspaceChange.bind(this)))
		}

		if (vscode.workspace.onDidRenameFiles) {
			this.disposables.push(
				vscode.workspace.onDidRenameFiles((event) => {
					for (const f of event.files) {
						// Prevent duplicate triggering of add/delete
						this.skipNextDelete.add(f.oldUri.fsPath)
						this.skipNextCreate.add(f.newUri.fsPath)
						this.emitRename(f.oldUri, f.newUri)
					}
				}),
			)
		}

		// Monitor all workspace folders
		const watchPaths = workspaceFolders.map((folder) => folder.uri.fsPath)

		try {
			watchPaths.forEach((watchPath) => {
				const relPattern = new vscode.RelativePattern(
					vscode.Uri.file(watchPath),
					`**/*{${scannerExtensions.map((e) => e.substring(1)).join(",")}}`,
				)
				const watcher = vscode.workspace.createFileSystemWatcher(relPattern)

				watcher.onDidCreate((uri) => {
					if (!this.skipNextCreate.has(uri.fsPath)) {
						this.emitAdd(uri)
					}
					this.skipNextCreate.delete(uri.fsPath)
				})

				watcher.onDidChange((uri) => {
					this.emitModify(uri)
				})

				watcher.onDidDelete((uri) => {
					if (!this.skipNextDelete.has(uri.fsPath)) {
						this.emitDelete(uri)
					}
					this.skipNextDelete.delete(uri.fsPath)
				})

				this.onAdd((path) => this.handleDidCreateFiles(path))
				this.onModify((path) => this.handleDocumentSave(path))
				this.onDelete((path) => this.handleDidFileDelete(path))
				this.onRename((oldPath, newPath) => this.handleFileRename(oldPath, newPath))

				this.disposables.push(watcher)
			})
			this.log.info(
				`[WorkspaceEventMonitor] File system monitor registered, monitoring paths: ${watchPaths.join(", ")}`,
			)
		} catch (error) {
			this.log.error("[WorkspaceEventMonitor] Failed to register file system monitor:", error)
		}
	}

	// --- Event Registration ---
	onAdd(handler: FileEventHandler) {
		this.addHandlers.push(handler)
	}
	onModify(handler: FileEventHandler) {
		this.modifyHandlers.push(handler)
	}
	onDelete(handler: FileEventHandler) {
		this.deleteHandlers.push(handler)
	}
	onRename(handler: RenameEventHandler) {
		this.renameHandlers.push(handler)
	}

	// --- Internal Triggering ---
	private emitAdd(uri: vscode.Uri) {
		this.addHandlers.forEach((h) => h(uri))
	}
	private emitModify(uri: vscode.Uri) {
		this.modifyHandlers.forEach((h) => h(uri))
	}
	private emitDelete(uri: vscode.Uri) {
		this.deleteHandlers.forEach((h) => h(uri))
	}
	private emitRename(oldPath: vscode.Uri, newPath: vscode.Uri) {
		this.renameHandlers.forEach((h) => h(oldPath, newPath))
	}

	/**
	 * Determine if a file should be ignored using CoIgnoreController and pattern matching
	 * This function is used by chokidar's ignored option
	 */
	private shouldIgnoreFile(filePath: string, stats: fs.Stats): boolean {
		if (getWorkspacePath() === filePath) return false
		// First, use CoIgnoreController if it's initialized
		if (this.ignoreController && this.ignoreController.coignoreContentInitialized) {
			if (!this.ignoreController.validateAccess(filePath)) {
				return true
			}
		}

		// Then, check against our built-in patterns
		if (isPathInIgnoredDirectory(filePath)) {
			return true
		}

		// Additional checks based on file stats if available
		// Ignore directories that match certain patterns
		if (stats.isDirectory()) {
			const dirName = path.basename(filePath)
			if (["tests", "mocks", "build"].includes(dirName)) {
				return true
			}
		}

		// Ignore large files (optional, based on size)
		if (stats.isFile() && stats.size > 2 * 1024 * 1024) {
			// Files larger than 10MB
			const ext = path.extname(filePath).toLowerCase()
			const largeFileExtensions = [
				".jpg",
				".jpeg",
				".png",
				".gif",
				".bmp",
				".ico",
				".svg",
				".webp",
				".mp3",
				".mp4",
				".avi",
				".mov",
				".wmv",
				".flv",
				".mkv",
				".pdf",
				".zip",
				".rar",
				".tar",
				".gz",
				".7z",
				".exe",
				".dll",
				".so",
				".dylib",
				".bin",
				".map",
			]
			if (largeFileExtensions.includes(ext) || BINARY_EXTENSIONS.has(ext)) {
				return true
			}
		}

		return false
	}

	/**
	 * Handle file delete event detected by file system
	 */
	private async handleDidFileDelete(url: vscode.Uri) {
		const filePath = url.fsPath
		if (url.scheme !== "file") return
		if (!(await this.ensureServiceEnabled())) return
		if (this.shouldIgnoreFile(filePath, fs.statSync(filePath))) return

		const eventKey = `delete:${filePath}`
		const eventData: WorkspaceEventData = {
			eventType: "delete_file",
			eventTime: `${Date.now()}`,
			sourcePath: filePath,
			targetPath: "",
		}

		this.addEvent(eventKey, eventData)
	}

	/**
	 * Handle document save event
	 */
	private async handleDocumentSave(url: vscode.Uri) {
		if (url.scheme !== "file") return
		if (!(await this.ensureServiceEnabled())) return
		const filePath = url.fsPath
		if (this.shouldIgnoreFile(filePath, fs.statSync(filePath))) return

		// 1. Re-read disk content
		let buf: Buffer
		try {
			buf = fs.readFileSync(filePath)
		} catch {
			// File was deleted instantly, ignore
			this.documentContentCache.delete(filePath)
			return
		}

		// 2. Calculate current hash
		const nowHash = computeHash(buf.toString())
		const oldHash = this.documentContentCache.get(filePath)?.contentHash

		// 3. Compare
		if (oldHash === undefined) {
			// First time discovering this file
			this.documentContentCache.set(filePath, { contentHash: nowHash })
		} else if (oldHash !== nowHash) {
			this.documentContentCache.set(filePath, { contentHash: nowHash })
		} else {
			this.log.debug(`[WorkspaceEventMonitor] Document content unchanged, skipping event trigger`)
			return
		}

		const eventKey = `modify:${filePath}`
		const eventData: WorkspaceEventData = {
			eventType: "modify_file",
			eventTime: `${Date.now()}`,
			sourcePath: filePath,
			targetPath: filePath,
		}

		this.addEvent(eventKey, eventData)
	}

	/**
	 * Handle file rename/move event
	 */
	private async handleFileRename(oldUri: vscode.Uri, newUri: vscode.Uri) {
		if (oldUri.scheme !== "file" || newUri.scheme !== "file") return
		if (!(await this.ensureServiceEnabled())) return
		const filePath = newUri.fsPath
		if (this.shouldIgnoreFile(filePath, fs.statSync(filePath))) return

		const eventKey = `rename:${oldUri.fsPath}:${filePath}`
		const eventData: WorkspaceEventData = {
			eventType: "rename_file",
			eventTime: `${Date.now()}`,
			sourcePath: oldUri.fsPath,
			targetPath: newUri.fsPath,
		}

		this.addEvent(eventKey, eventData)
	}

	/**
	 * Handle workspace change event
	 */
	private async handleWorkspaceChange(event: vscode.WorkspaceFoldersChangeEvent) {
		if (!(await this.ensureServiceEnabled())) return

		// Handle added workspaces
		event.added.forEach((folder) => {
			const filePath = folder.uri.fsPath
			if (this.shouldIgnoreFile(filePath, fs.statSync(filePath))) return
			const eventKey = `workspace:open:${filePath}`
			const eventData: WorkspaceEventData = {
				eventType: "open_workspace",
				eventTime: `${Date.now()}`,
				sourcePath: "",
			}
			this.addEvent(eventKey, eventData)
		})

		// Handle removed workspaces
		event.removed.forEach((folder) => {
			const filePath = folder.uri.fsPath
			if (this.shouldIgnoreFile(filePath, fs.statSync(filePath))) return
			const eventKey = `workspace:close:${filePath}`
			const eventData: WorkspaceEventData = {
				eventType: "close_workspace",
				eventTime: `${Date.now()}`,
				sourcePath: "",
			}
			this.addEvent(eventKey, eventData)
		})
	}

	/**
	 * Handle file creation event
	 */
	private async handleDidCreateFiles(url: vscode.Uri) {
		if (url.scheme !== "file") return
		if (!(await this.ensureServiceEnabled())) return
		const filePath = url.fsPath
		if (this.shouldIgnoreFile(filePath, fs.statSync(filePath))) return

		const eventKey = `create:${filePath}`
		const eventData: WorkspaceEventData = {
			eventType: "add_file",
			eventTime: `${Date.now()}`,
			sourcePath: "",
			targetPath: url.fsPath,
		}

		this.addEvent(eventKey, eventData)
	}

	/**
	 * Handle workspace initial open event
	 */
	async handleInitialWorkspaceOpen() {
		if (!(await this.ensureServiceEnabled())) return

		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return
		}

		workspaceFolders.forEach((folder) => {
			const filePath = folder.uri.fsPath
			if (this.shouldIgnoreFile(filePath, fs.statSync(filePath))) return
			const eventKey = `workspace:initial:${filePath}`
			const eventData: WorkspaceEventData = {
				eventType: "open_workspace",
				eventTime: `${Date.now()}`,
				sourcePath: "",
			}
			this.addEvent(eventKey, eventData)
		})
	}

	/**
	 * Add event to buffer
	 */
	private addEvent(key: string, event: WorkspaceEventData): void {
		// Deduplication: use event key as unique identifier
		this.eventBuffer.set(key, event)

		// Check if immediate flush is needed
		const now = Date.now()
		if (now - this.lastFlushTime >= this.config.debounceMs) {
			this.scheduleFlush()
		} else if (this.eventBuffer.size >= this.config.batchSize) {
			// If buffer is full, flush immediately
			this.flushEvents()
		}
	}

	/**
	 * Schedule event flush
	 */
	private scheduleFlush(): void {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
		}

		this.flushTimer = setTimeout(async () => {
			try {
				await this.flushEvents()
			} catch (error) {
				this.log.error("[WorkspaceEventMonitor] Error occurred while flushing events:", error)
				// Ensure timer is reset even in error case
			} finally {
				this.flushTimer = null
			}
		}, this.config.debounceMs)
	}

	/**
	 * Flush events to server
	 */
	private async flushEvents(): Promise<void> {
		if (this.eventBuffer.size === 0) return

		// Get current workspace
		const workspace = this.getCurrentWorkspace()
		if (!workspace) {
			this.log.warn("[WorkspaceEventMonitor] Unable to determine current workspace")
			return
		}

		// Prepare event data
		const events = Array.from(this.eventBuffer.values())
		this.eventBuffer.clear()
		this.lastFlushTime = Date.now()

		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}

		// Send to server
		await this.sendEventsToServer(workspace, events)
	}

	/**
	 * Synchronously flush events to server (for emergency sending when VSCode closes)
	 */
	private async flushEventsSync(): Promise<void> {
		if (this.eventBuffer.size === 0) return

		// Get current workspace
		const workspace = this.getCurrentWorkspace()
		if (!workspace) {
			this.log.warn("[WorkspaceEventMonitor] Unable to determine current workspace")
			return
		}

		// Prepare event data
		const events = Array.from(this.eventBuffer.values())
		this.eventBuffer.clear()
		this.lastFlushTime = Date.now()

		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}

		// Send to server
		await this.sendEventsToServer(workspace, events)
	}

	/**
	 * Send events to server
	 */
	private async sendEventsToServer(workspace: string, events: WorkspaceEventData[]): Promise<void> {
		if (events.length === 0) return
		const request: WorkspaceEventRequest = {
			workspace,
			data: events,
		}
		const evts = [...new Set(events.map((v) => v.eventType))].join()
		let retryCount = 0
		const startTime = Date.now()
		const maxTotalRetryTime = 60000 // 60 seconds total retry time limit
		const maxRetries = events.find((v) => v.eventType === "open_workspace") ? 5 : this.config.maxRetries // 1 retry for open_workspace, 3 retries for other events

		while (retryCount <= maxRetries) {
			try {
				const response = await ZgsmCodebaseIndexManager.getInstance().publishWorkspaceEvents(request)

				if (response.success) {
					this.log.info(`[WorkspaceEventMonitor] ${evts} events sent successfully`)
					return
				} else {
					this.log.warn(`[WorkspaceEventMonitor] ${evts} events send failed: ${response.message}`)
				}
			} catch (error) {
				// Check if total retry time limit is reached (prevent infinite loop)
				const elapsedTime = Date.now() - startTime
				if (elapsedTime >= maxTotalRetryTime) {
					this.log.error(
						`[WorkspaceEventMonitor] ${evts} reached total retry time limit(${maxTotalRetryTime}ms), giving up`,
					)
					break
				}

				if (retryCount < maxRetries) {
					// Use exponential backoff strategy
					const delayMs = Math.min(
						this.config.retryDelayMs * Math.pow(2, retryCount),
						10000, // Maximum delay 10 seconds
					)
					// this.log.error(`[WorkspaceEventMonitor] ${evts} Failed to send event (retry after ${delayMs}ms):`, errorMessage)
					this.log.info(`[WorkspaceEventMonitor] ${evts} ${retryCount + 1}/${maxRetries} retry failed`)
					await this.delay(delayMs)
					retryCount++
				} else {
					this.log.error(
						`[WorkspaceEventMonitor] ${evts} reached maximum retry count(${maxRetries}), event send failed`,
					)
					try {
						TelemetryService.instance?.captureError?.(CodeBaseError.SyncFailed)
					} catch {
						// Ignore telemetry service related errors
					}
					break // Explicitly exit loop
				}
			}
		}
	}

	/**
	 * Get current workspace path
	 */
	private getCurrentWorkspace(): string | null {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return null
		}
		this.workspaceCache = workspaceFolders[0].uri.fsPath
		// If there are multiple workspaces, use the first one
		return this.workspaceCache
	}

	/**
	 * Delay function
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	public setLogger(logger: ILogger): void {
		this.logger = logger
	}
	public setProvider(clineProvider: ClineProvider): void {
		this.clineProvider = clineProvider
	}

	private async ensureServiceEnabled() {
		const workspaceFolders = vscode.workspace.workspaceFolders

		if (!workspaceFolders || workspaceFolders.length === 0) {
			return false
		}

		if (!this.clineProvider) {
			return false
		}
		const { apiConfiguration } = await this.clineProvider.getState()

		if (apiConfiguration.apiProvider !== "zgsm" || !apiConfiguration.zgsmCodebaseIndexEnabled) {
			return false
		}

		return this.config.enabled
	}
}

/**
 * Global workspace event monitor instance
 */
export const workspaceEventMonitor = WorkspaceEventMonitor.getInstance()
