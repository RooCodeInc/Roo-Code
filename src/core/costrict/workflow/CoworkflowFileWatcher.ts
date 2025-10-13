/**
 * CoworkflowFileWatcher - Central coordinator for file monitoring and provider management
 */

import * as vscode from "vscode"
import * as path from "path"
import {
	ICoworkflowFileWatcher,
	CoworkflowFileContext,
	CoworkflowDocumentType,
	CoworkflowDocumentInfo,
	CoworkflowWatcherConfig,
	CoworkflowFileChangeEvent,
} from "./types"
import { CoworkflowErrorHandler } from "./CoworkflowErrorHandler"

export class CoworkflowFileWatcher implements ICoworkflowFileWatcher {
	private disposables: vscode.Disposable[] = []
	private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map()
	private fileContexts: Map<string, CoworkflowFileContext> = new Map()
	private config: CoworkflowWatcherConfig
	private onFileChangedEmitter = new vscode.EventEmitter<CoworkflowFileChangeEvent>()
	private errorHandler: CoworkflowErrorHandler

	/** Event fired when a coworkflow file changes */
	public readonly onDidFileChange = this.onFileChangedEmitter.event

	constructor(config?: Partial<CoworkflowWatcherConfig>) {
		this.config = {
			enabled: true,
			debounceDelay: 300,
			watchPatterns: [
				"**/{requirements,design,tasks}.md", // Root level files
				"**/**/{requirements,design,tasks}.md", // Same three files in subdirectories
			],
			...config,
		}
		this.errorHandler = new CoworkflowErrorHandler()
	}

	public initialize(): void {
		if (!this.config.enabled) {
			return
		}

		// Watch for workspace folder changes
		this.disposables.push(
			vscode.workspace.onDidChangeWorkspaceFolders(() => {
				this.refreshWatchers()
			}),
		)

		// Initialize watchers for current workspace
		this.refreshWatchers()
	}

	public dispose(): void {
		try {
			this.onFileChangedEmitter.dispose()
			this.clearAllWatchers()
			this.disposables.forEach((d) => d.dispose())
			this.disposables = []
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"file_system_error",
				"warning",
				"Error during CoworkflowFileWatcher disposal",
				error as Error,
			)
			this.errorHandler.handleError(coworkflowError)
		}
	}

	public onFileChanged(uri: vscode.Uri): void {
		try {
			const documentInfo = this.getDocumentInfoFromUri(uri)
			if (!documentInfo) {
				return
			}

			// Update file context
			const key = uri.toString()
			const context = this.fileContexts.get(key)
			if (context) {
				context.lastModified = new Date()
				context.documentInfo = documentInfo
			}

			// Emit change event
			this.onFileChangedEmitter.fire({
				uri,
				changeType: vscode.FileChangeType.Changed,
				documentType: documentInfo.type,
			})
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"file_system_error",
				"warning",
				"Error handling file change event",
				error as Error,
				uri,
			)
			this.errorHandler.handleError(coworkflowError)
		}
	}

	public getCoworkflowPath(): string | undefined {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
			if (!workspaceFolder) {
				this.errorHandler.logError(
					this.errorHandler.createError(
						"file_system_error",
						"info",
						"No workspace folder available for coworkflow monitoring",
					),
				)
				return undefined
			}

			const coworkflowPath = path.join(workspaceFolder.uri.fsPath, ".cospec")
			return coworkflowPath
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"file_system_error",
				"error",
				"Error determining coworkflow path",
				error as Error,
			)
			this.errorHandler.handleError(coworkflowError)
			return undefined
		}
	}

	public isMonitoring(uri: vscode.Uri): boolean {
		return this.fileContexts.has(uri.toString())
	}

	private refreshWatchers(): void {
		try {
			this.clearAllWatchers()
			this.setupWatchers()
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"file_system_error",
				"error",
				"Error refreshing file watchers",
				error as Error,
			)
			this.errorHandler.handleError(coworkflowError)
		}
	}

	private clearAllWatchers(): void {
		try {
			this.fileWatchers.forEach((watcher) => {
				try {
					watcher.dispose()
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"file_system_error",
							"warning",
							"Error disposing file watcher",
							error as Error,
						),
					)
				}
			})
			this.fileWatchers.clear()
			this.fileContexts.clear()
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"file_system_error",
				"error",
				"Error clearing file watchers",
				error as Error,
			)
			this.errorHandler.handleError(coworkflowError)
		}
	}

	private setupWatchers(): void {
		const coworkflowPath = this.getCoworkflowPath()
		if (!coworkflowPath) {
			return
		}

		// Check if .cospec directory exists
		vscode.workspace.fs.stat(vscode.Uri.file(coworkflowPath)).then(
			(stat) => {
				// Verify it's actually a directory
				if (stat.type !== vscode.FileType.Directory) {
					const error = this.errorHandler.createError(
						"file_system_error",
						"warning",
						".cospec exists but is not a directory",
						undefined,
						vscode.Uri.file(coworkflowPath),
					)
					this.errorHandler.handleError(error)
					return
				}

				// Directory exists, set up file watchers
				this.setupFileWatchers(coworkflowPath)
			},
			(error) => {
				// Handle different types of file system errors
				if (error.code === "FileNotFound" || error.code === "ENOENT") {
					// Directory doesn't exist - this is normal, just log info
					this.errorHandler.logError(
						this.errorHandler.createError(
							"not_found_error",
							"info",
							".cospec directory not found - coworkflow monitoring disabled",
							error,
							vscode.Uri.file(coworkflowPath),
						),
					)
				} else if (error.code === "EACCES" || error.code === "EPERM") {
					// Permission error
					const coworkflowError = this.errorHandler.createError(
						"permission_error",
						"warning",
						"Permission denied accessing .cospec directory",
						error,
						vscode.Uri.file(coworkflowPath),
					)
					this.errorHandler.handleError(coworkflowError)
				} else {
					// Other file system error
					const coworkflowError = this.errorHandler.createError(
						"file_system_error",
						"warning",
						"Error accessing .cospec directory",
						error,
						vscode.Uri.file(coworkflowPath),
					)
					this.errorHandler.handleError(coworkflowError)
				}
			},
		)
	}

	private setupFileWatchers(coworkflowPath: string): void {
		try {
			this.config.watchPatterns.forEach((pattern) => {
				try {
					const filePath = path.join(coworkflowPath, pattern)
					const fileUri = vscode.Uri.file(filePath)
					const globPattern = new vscode.RelativePattern(coworkflowPath, pattern)

					const watcher = vscode.workspace.createFileSystemWatcher(globPattern)

					// Handle file changes with debouncing
					let debounceTimer: NodeJS.Timeout | undefined
					const handleChange = (uri: vscode.Uri) => {
						try {
							if (debounceTimer) {
								clearTimeout(debounceTimer)
							}
							debounceTimer = setTimeout(() => {
								this.onFileChanged(uri)
							}, this.config.debounceDelay)
						} catch (error) {
							const coworkflowError = this.errorHandler.createError(
								"file_system_error",
								"warning",
								"Error handling file change event",
								error as Error,
								uri,
							)
							this.errorHandler.handleError(coworkflowError)
						}
					}

					const handleDelete = (uri: vscode.Uri) => {
						try {
							const key = uri.toString()
							this.fileContexts.delete(key)
							const documentInfo = this.getDocumentInfoFromUri(uri)
							this.onFileChangedEmitter.fire({
								uri,
								changeType: vscode.FileChangeType.Deleted,
								documentType: documentInfo?.type,
							})
						} catch (error) {
							const coworkflowError = this.errorHandler.createError(
								"file_system_error",
								"warning",
								"Error handling file deletion event",
								error as Error,
								uri,
							)
							this.errorHandler.handleError(coworkflowError)
						}
					}

					watcher.onDidChange(handleChange)
					watcher.onDidCreate(handleChange)
					watcher.onDidDelete(handleDelete)

					this.fileWatchers.set(pattern, watcher)
					this.disposables.push(watcher)

					// Initialize file contexts for existing files that match the pattern
					this.initializeExistingFiles(coworkflowPath, pattern)
				} catch (error) {
					const coworkflowError = this.errorHandler.createError(
						"file_system_error",
						"error",
						`Error setting up file watcher for ${pattern}`,
						error as Error,
					)
					this.errorHandler.handleError(coworkflowError)
				}
			})
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"file_system_error",
				"error",
				"Error setting up file watchers",
				error as Error,
			)
			this.errorHandler.handleError(coworkflowError)
		}
	}

	public getDocumentInfoFromUri(uri: vscode.Uri): CoworkflowDocumentInfo | undefined {
		try {
			const coworkflowPath = this.getCoworkflowPath()
			if (!coworkflowPath) {
				return undefined
			}

			const coworkflowUri = vscode.Uri.file(coworkflowPath)
			const relativePath = path.relative(coworkflowUri.fsPath, uri.fsPath)

			// Check if file is within .cospec directory
			if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
				return undefined
			}

			const fileName = path.basename(uri.fsPath)
			const baseName = path.basename(fileName, ".md")
			const subdirectory = path.dirname(relativePath)

			// Only allow the three specific file names
			if (!["requirements.md", "design.md", "tasks.md"].includes(fileName)) {
				return undefined
			}

			// Determine document type based on filename
			let documentType: CoworkflowDocumentType
			switch (fileName) {
				case "requirements.md":
					documentType = "requirements"
					break
				case "design.md":
					documentType = "design"
					break
				case "tasks.md":
					documentType = "tasks"
					break
				default:
					return undefined // This should never happen due to the check above
			}

			return {
				type: documentType,
				relativePath,
				baseName,
				subdirectory: subdirectory === "." ? "" : subdirectory,
			}
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"file_system_error",
				"warning",
				"Error getting document info from URI",
				error as Error,
				uri,
			)
			this.errorHandler.handleError(coworkflowError)
			return undefined
		}
	}

	private getDocumentTypeFromUri(uri: vscode.Uri): CoworkflowDocumentType | undefined {
		const documentInfo = this.getDocumentInfoFromUri(uri)
		return documentInfo?.type
	}

	/**
	 * Initialize file contexts for existing files that match the pattern
	 */
	private async initializeExistingFiles(coworkflowPath: string, pattern: string): Promise<void> {
		try {
			// Use workspace.findFiles to find actual files matching the pattern
			const globPattern = new vscode.RelativePattern(coworkflowPath, pattern)
			const files = await vscode.workspace.findFiles(globPattern)

			for (const fileUri of files) {
				try {
					const stat = await vscode.workspace.fs.stat(fileUri)
					const documentInfo = this.getDocumentInfoFromUri(fileUri)

					if (documentInfo) {
						this.fileContexts.set(fileUri.toString(), {
							uri: fileUri,
							type: documentInfo.type,
							documentInfo: documentInfo,
							lastModified: new Date(stat.mtime),
							isActive: true,
						})

						this.errorHandler.logError(
							this.errorHandler.createError(
								"file_system_error",
								"info",
								`Initialized file context for ${documentInfo.relativePath}`,
								undefined,
								fileUri,
							),
						)
					}
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"file_system_error",
							"warning",
							`Error initializing file context for ${fileUri.fsPath}`,
							error as Error,
							fileUri,
						),
					)
				}
			}
		} catch (error) {
			this.errorHandler.logError(
				this.errorHandler.createError(
					"file_system_error",
					"warning",
					`Error finding files for pattern ${pattern}`,
					error as Error,
				),
			)
		}
	}
}
