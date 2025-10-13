/**
 * Coworkflow integration entry point
 * Manages the lifecycle of all coworkflow components
 */

import * as vscode from "vscode"
import { CoworkflowFileWatcher } from "./CoworkflowFileWatcher"
import { CoworkflowCodeLensProvider } from "./CoworkflowCodeLensProvider"
import { CoworkflowDecorationProvider } from "./CoworkflowDecorationProvider"
import {
	registerCoworkflowCommands,
	setCommandHandlerDependencies,
	clearCommandHandlerDependencies,
	isCoworkflowDocument,
} from "./commands"
import { CoworkflowErrorHandler } from "./CoworkflowErrorHandler"

// Re-export classes and constants for external use
export { CoworkflowFileWatcher } from "./CoworkflowFileWatcher"
export { CoworkflowCodeLensProvider } from "./CoworkflowCodeLensProvider"
export { CoworkflowDecorationProvider } from "./CoworkflowDecorationProvider"
export { COWORKFLOW_COMMANDS } from "./commands"
export * from "./types"

/**
 * Coworkflow integration manager
 */
export class CoworkflowIntegration {
	private fileWatcher: CoworkflowFileWatcher | undefined
	private codeLensProvider: CoworkflowCodeLensProvider | undefined
	private decorationProvider: CoworkflowDecorationProvider | undefined
	private disposables: vscode.Disposable[] = []
	private errorHandler: CoworkflowErrorHandler

	constructor() {
		this.errorHandler = new CoworkflowErrorHandler()
	}

	/**
	 * Activate coworkflow integration
	 */
	public activate(context: vscode.ExtensionContext): void {
		try {
			// Initialize file watcher
			this.fileWatcher = new CoworkflowFileWatcher()
			this.fileWatcher.initialize()
			this.disposables.push(this.fileWatcher)

			// Initialize CodeLens provider
			this.codeLensProvider = new CoworkflowCodeLensProvider(this.fileWatcher)
			const codeLensDisposable = vscode.languages.registerCodeLensProvider(
				{ scheme: "file", pattern: "**/.cospec/**/*.md" }, // Updated pattern to support subdirectories
				this.codeLensProvider,
			)
			this.disposables.push(codeLensDisposable)
			this.disposables.push(this.codeLensProvider)

			// Initialize decoration provider
			this.decorationProvider = new CoworkflowDecorationProvider()
			this.disposables.push(this.decorationProvider)

			// Connect file watcher to providers
			this.setupProviderConnections()

			// Register commands
			const commandDisposables = registerCoworkflowCommands(context)
			this.disposables.push(...commandDisposables)

			// Connect command handlers with providers
			setCommandHandlerDependencies({
				codeLensProvider: this.codeLensProvider,
				decorationProvider: this.decorationProvider,
				fileWatcher: this.fileWatcher,
			})

			// Add all disposables to context
			context.subscriptions.push(...this.disposables)

			// Initialize decorations for already open documents with a delay
			// to ensure all components are fully initialized
			setTimeout(() => {
				this.initializeExistingDocuments()
			}, 500)

			this.errorHandler.logError(
				this.errorHandler.createError("command_error", "info", "Coworkflow integration successfully activated"),
			)
			console.log("CoworkflowIntegration: Successfully activated")
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"command_error",
				"critical",
				"Failed to activate coworkflow integration",
				error as Error,
			)
			this.errorHandler.handleError(coworkflowError)

			// Attempt cleanup of partially initialized components
			this.deactivate()
			throw error
		}
	}

	/**
	 * Deactivate coworkflow integration
	 */
	public deactivate(): void {
		try {
			// Dispose of all disposables in reverse order for proper cleanup
			const disposablesToCleanup = [...this.disposables].reverse()
			disposablesToCleanup.forEach((disposable, index) => {
				try {
					disposable.dispose()
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"provider_error",
							"warning",
							`Error disposing component ${index}`,
							error as Error,
						),
					)
				}
			})
			this.disposables = []

			// Clear provider references
			this.fileWatcher = undefined
			this.codeLensProvider = undefined
			this.decorationProvider = undefined

			// Clear command handler dependencies
			clearCommandHandlerDependencies()

			this.errorHandler.logError(
				this.errorHandler.createError(
					"command_error",
					"info",
					"Coworkflow integration successfully deactivated",
				),
			)

			console.log("CoworkflowIntegration: Successfully deactivated")
		} catch (error) {
			console.error("CoworkflowIntegration: Error during deactivation", error)
		}
	}

	/**
	 * Setup connections between file watcher and providers
	 */
	private setupProviderConnections(): void {
		if (!this.fileWatcher || !this.codeLensProvider || !this.decorationProvider) {
			return
		}

		// Connect file change events to providers
		this.disposables.push(
			this.fileWatcher.onDidFileChange((event) => {
				try {
					// Refresh CodeLens when files change
					this.codeLensProvider?.refresh()

					// Update decorations for tasks.md files
					if (event.documentType === "tasks") {
						// Find the document and update decorations
						const document = vscode.workspace.textDocuments.find(
							(doc) => doc.uri.toString() === event.uri.toString(),
						)
						if (document) {
							this.decorationProvider?.updateDecorations(document)
						}
					}
				} catch (error) {
					this.errorHandler.handleError(
						this.errorHandler.createError(
							"provider_error",
							"warning",
							"Error handling file change event",
							error as Error,
							event.uri,
						),
					)
				}
			}),
		)

		// Update decorations when documents are opened
		this.disposables.push(
			vscode.workspace.onDidOpenTextDocument((document) => {
				try {
					if (isCoworkflowDocument(document.uri.fsPath)) {
						this.decorationProvider?.updateDecorations(document)
					}
				} catch (error) {
					this.errorHandler.handleError(
						this.errorHandler.createError(
							"provider_error",
							"warning",
							"Error handling document open event",
							error as Error,
							document.uri,
						),
					)
				}
			}),
		)

		// Update decorations when visible editors change
		this.disposables.push(
			vscode.window.onDidChangeVisibleTextEditors(() => {
				try {
					this.decorationProvider?.refreshAll()
				} catch (error) {
					this.errorHandler.handleError(
						this.errorHandler.createError(
							"provider_error",
							"warning",
							"Error handling visible editors change",
							error as Error,
						),
					)
				}
			}),
		)

		// Handle workspace folder changes
		this.disposables.push(
			vscode.workspace.onDidChangeWorkspaceFolders((event) => {
				try {
					// If workspace folders are removed, clean up related resources
					if (event.removed.length > 0) {
						console.log("CoworkflowIntegration: Workspace folders removed, refreshing watchers")
						// File watcher will handle this automatically through its own event handler
					}

					// If workspace folders are added, the file watcher will detect them
					if (event.added.length > 0) {
						console.log("CoworkflowIntegration: Workspace folders added, refreshing watchers")
					}
				} catch (error) {
					this.errorHandler.handleError(
						this.errorHandler.createError(
							"file_system_error",
							"warning",
							"Error handling workspace folder changes",
							error as Error,
						),
					)
				}
			}),
		)

		// Handle configuration changes
		this.disposables.push(
			vscode.workspace.onDidChangeConfiguration((event) => {
				try {
					// Check if coworkflow-related configuration changed
					if (event.affectsConfiguration("coworkflow")) {
						console.log("CoworkflowIntegration: Configuration changed, refreshing providers")
						this.codeLensProvider?.refresh()
						this.decorationProvider?.refreshAll()
					}
				} catch (error) {
					this.errorHandler.handleError(
						this.errorHandler.createError(
							"provider_error",
							"warning",
							"Error handling configuration change",
							error as Error,
						),
					)
				}
			}),
		)
	}

	/**
	 * Get the current file watcher instance
	 */
	public getFileWatcher(): CoworkflowFileWatcher | undefined {
		return this.fileWatcher
	}

	/**
	 * Get the current CodeLens provider instance
	 */
	public getCodeLensProvider(): CoworkflowCodeLensProvider | undefined {
		return this.codeLensProvider
	}

	/**
	 * Get the current decoration provider instance
	 */
	public getDecorationProvider(): CoworkflowDecorationProvider | undefined {
		return this.decorationProvider
	}

	/**
	 * Initialize decorations for already open documents
	 */
	private initializeExistingDocuments(): void {
		try {
			// Apply decorations to already open coworkflow documents
			vscode.workspace.textDocuments.forEach((document) => {
				if (isCoworkflowDocument(document.uri.fsPath)) {
					console.log(`CoworkflowIntegration: Initializing decorations for ${document.uri.path}`)
					this.decorationProvider?.updateDecorations(document)
				}
			})
		} catch (error) {
			this.errorHandler.handleError(
				this.errorHandler.createError(
					"provider_error",
					"warning",
					"Error initializing decorations for existing documents",
					error as Error,
				),
			)
		}
	}

	/**
	 * Handle graceful shutdown scenarios
	 */
	public gracefulShutdown(): void {
		try {
			console.log("CoworkflowIntegration: Starting graceful shutdown")

			// Clear decorations from all open documents
			if (this.decorationProvider) {
				vscode.workspace.textDocuments.forEach((document) => {
					if (isCoworkflowDocument(document.uri.fsPath)) {
						this.decorationProvider?.clearDecorations(document)
					}
				})
			}

			// Perform normal deactivation
			this.deactivate()

			console.log("CoworkflowIntegration: Graceful shutdown completed")
		} catch (error) {
			console.error("CoworkflowIntegration: Error during graceful shutdown", error)
			// Still attempt normal deactivation
			this.deactivate()
		}
	}
}

// Global instance
let coworkflowIntegration: CoworkflowIntegration | undefined

/**
 * Activate coworkflow integration
 */
export function activateCoworkflowIntegration(context: vscode.ExtensionContext): void {
	if (coworkflowIntegration) {
		console.warn("CoworkflowIntegration: Already activated")
		return
	}

	coworkflowIntegration = new CoworkflowIntegration()
	coworkflowIntegration.activate(context)
}

/**
 * Deactivate coworkflow integration
 */
export function deactivateCoworkflowIntegration(): void {
	if (coworkflowIntegration) {
		coworkflowIntegration.gracefulShutdown()
		coworkflowIntegration = undefined
	}
}

/**
 * Get the current coworkflow integration instance
 */
export function getCoworkflowIntegration(): CoworkflowIntegration | undefined {
	return coworkflowIntegration
}
