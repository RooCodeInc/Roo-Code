/**
 * CoworkflowCodeLensProvider - Provides contextual actions via CodeLens for different document types
 */

import * as vscode from "vscode"
import * as path from "path"
import {
	ICoworkflowCodeLensProvider,
	CoworkflowCodeLens,
	CoworkflowDocumentType,
	CoworkflowActionType,
	CoworkflowCommandContext,
} from "./types"
import { CoworkflowErrorHandler } from "./CoworkflowErrorHandler"
import { getCommand } from "../../../utils/commands"
import { t } from "../../../i18n"

export class CoworkflowCodeLensProvider implements ICoworkflowCodeLensProvider {
	private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>()
	public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event
	private errorHandler: CoworkflowErrorHandler
	private fileWatcher?: import("./CoworkflowFileWatcher").CoworkflowFileWatcher

	constructor(fileWatcher?: import("./CoworkflowFileWatcher").CoworkflowFileWatcher) {
		this.errorHandler = new CoworkflowErrorHandler()
		this.fileWatcher = fileWatcher
	}

	public setFileWatcher(fileWatcher: import("./CoworkflowFileWatcher").CoworkflowFileWatcher): void {
		this.fileWatcher = fileWatcher
	}

	public dispose(): void {
		this.onDidChangeCodeLensesEmitter.dispose()
	}

	public provideCodeLenses(
		document: vscode.TextDocument,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.CodeLens[]> {
		const documentType = this.getDocumentType(document.uri)
		if (!documentType) {
			return []
		}

		try {
			// Validate document content before parsing
			if (!this.isValidDocument(document)) {
				this.errorHandler.logError(
					this.errorHandler.createError(
						"parsing_error",
						"warning",
						"Document appears to be empty or corrupted - providing fallback CodeLenses",
						undefined,
						document.uri,
					),
				)
				return this.provideFallbackCodeLenses(document, documentType)
			}

			switch (documentType) {
				case "requirements":
					return this.provideRequirementsCodeLenses(document)
				case "design":
					return this.provideDesignCodeLenses(document)
				case "tasks":
					return this.provideTasksCodeLenses(document)
				default:
					return []
			}
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"parsing_error",
				"error",
				"Error parsing document for CodeLenses",
				error as Error,
				document.uri,
			)
			this.errorHandler.handleError(coworkflowError)

			// Return fallback CodeLenses instead of empty array
			return this.provideFallbackCodeLenses(document, documentType)
		}
	}

	public resolveCodeLens(
		codeLens: vscode.CodeLens,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.CodeLens> {
		try {
			const coworkflowCodeLens = codeLens as CoworkflowCodeLens

			if (!coworkflowCodeLens.documentType || !coworkflowCodeLens.actionType) {
				this.errorHandler.logError(
					this.errorHandler.createError(
						"parsing_error",
						"warning",
						"CodeLens missing required properties - returning unresolved",
					),
				)
				return codeLens
			}

			// Get the document URI, with fallbacks for different scenarios
			let documentUri: vscode.Uri
			try {
				const activeEditor = vscode.window.activeTextEditor
				if (activeEditor && this.getDocumentType(activeEditor.document.uri)) {
					documentUri = activeEditor.document.uri
				} else {
					// Fallback: try to find the document from visible editors
					const visibleEditor = vscode.window.visibleTextEditors?.find(
						(editor) => this.getDocumentType(editor.document.uri) === coworkflowCodeLens.documentType,
					)
					documentUri = visibleEditor?.document.uri || vscode.Uri.file("")
				}
			} catch {
				// Final fallback for test environments or edge cases
				documentUri = vscode.Uri.file("")
			}

			// Set the command based on action type
			const commandId = this.getCommandId(coworkflowCodeLens.actionType)

			// Set commands only for actions that need to respond to clicks
			if (commandId) {
				// Create a minimal command context to avoid circular references
				const commandContext: CoworkflowCommandContext = {
					uri: documentUri,
					documentType: coworkflowCodeLens.documentType,
					actionType: coworkflowCodeLens.actionType,
					context: coworkflowCodeLens.context,
				}

				codeLens.command = {
					title: this.getActionTitle(coworkflowCodeLens.actionType, coworkflowCodeLens.documentType),
					command: commandId,
					arguments: [commandContext],
				}
			} else {
				// States like loading don't need commands, only set title
				codeLens.command = {
					title: this.getActionTitle(coworkflowCodeLens.actionType, coworkflowCodeLens.documentType),
					command: "",
				}
			}

			return codeLens
		} catch (error) {
			const coworkflowError = this.errorHandler.createError(
				"parsing_error",
				"warning",
				"Error resolving CodeLens - returning unresolved",
				error as Error,
			)
			this.errorHandler.handleError(coworkflowError)
			return codeLens
		}
	}

	public refresh(): void {
		this.onDidChangeCodeLensesEmitter.fire()
	}

	public getDocumentType(uri: vscode.Uri): CoworkflowDocumentType | undefined {
		// Use FileWatcher's enhanced document detection if available
		if (this.fileWatcher) {
			const documentInfo = this.fileWatcher.getDocumentInfoFromUri(uri)
			return documentInfo?.type
		}

		// Fallback to legacy logic for backward compatibility
		const fileName = path.basename(uri.fsPath)
		const parentDir = path.basename(path.dirname(uri.fsPath))

		// Check if this is in a .cospec directory
		if (parentDir !== ".cospec") {
			return undefined
		}

		switch (fileName) {
			case "requirements.md":
				return "requirements"
			case "design.md":
				return "design"
			case "tasks.md":
				return "tasks"
			default:
				return undefined
		}
	}

	private isValidDocument(document: vscode.TextDocument): boolean {
		try {
			const text = document.getText()

			// Check if document is empty
			if (!text || text.trim().length === 0) {
				return false
			}

			// Check if document is too large (potential memory issue)
			if (text.length > 1000000) {
				// 1MB limit
				this.errorHandler.logError(
					this.errorHandler.createError(
						"parsing_error",
						"warning",
						"Document is very large - may impact performance",
						undefined,
						document.uri,
					),
				)
			}

			// Get document type to apply appropriate validation
			const documentType = this.getDocumentType(document.uri)
			const lines = text.split("\n")

			// Apply different validation based on document type
			if (documentType === "tasks") {
				// For tasks.md, check for task items (- [ ], - [x], - [-])
				const hasTaskItems = lines.some((line) => /^\s*-\s+\[([ x-])\]\s+/.test(line.trim()))

				if (!hasTaskItems) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"parsing_error",
							"info",
							"Tasks document does not appear to contain task items",
							undefined,
							document.uri,
						),
					)
				}
			} else {
				// For other documents, check for markdown headers
				const hasHeaders = lines.some((line) => line.trim().startsWith("#"))

				if (!hasHeaders) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"parsing_error",
							"info",
							"Document does not appear to contain markdown headers",
							undefined,
							document.uri,
						),
					)
				}
			}

			return true
		} catch (error) {
			this.errorHandler.logError(
				this.errorHandler.createError(
					"parsing_error",
					"error",
					"Error validating document",
					error as Error,
					document.uri,
				),
			)
			return false
		}
	}

	private provideFallbackCodeLenses(
		document: vscode.TextDocument,
		documentType: CoworkflowDocumentType,
	): CoworkflowCodeLens[] {
		try {
			// Provide a basic CodeLens at the beginning of the document
			const range = new vscode.Range(0, 0, 0, 0)
			const codeLens = new vscode.CodeLens(range) as CoworkflowCodeLens
			codeLens.documentType = documentType
			codeLens.actionType = "update"
			codeLens.context = {
				sectionTitle: "Document (Fallback)",
				lineNumber: 0,
			}

			return [codeLens]
		} catch (error) {
			this.errorHandler.logError(
				this.errorHandler.createError(
					"parsing_error",
					"error",
					"Error creating fallback CodeLenses",
					error as Error,
					document.uri,
				),
			)
			return []
		}
	}

	private provideRequirementsCodeLenses(document: vscode.TextDocument): CoworkflowCodeLens[] {
		const codeLenses: CoworkflowCodeLens[] = []

		try {
			const text = document.getText()
			const lines = text.split("\n")

			// Look for all markdown headers (# ## ### #### etc.)
			const headerRegex = /^#{1,6}\s+.+/

			lines.forEach((line, index) => {
				try {
					if (headerRegex.test(line)) {
						const range = new vscode.Range(index, 0, index, line.length)
						const codeLens = new vscode.CodeLens(range) as CoworkflowCodeLens
						codeLens.documentType = "requirements"
						codeLens.actionType = "update"
						codeLens.context = {
							sectionTitle: line.trim(),
							lineNumber: index,
						}
						codeLenses.push(codeLens)
					}
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"parsing_error",
							"warning",
							`Error processing requirement header at line ${index + 1}`,
							error as Error,
							document.uri,
						),
					)
				}
			})
		} catch (error) {
			this.errorHandler.logError(
				this.errorHandler.createError(
					"parsing_error",
					"error",
					"Error parsing requirements document",
					error as Error,
					document.uri,
				),
			)
		}

		return codeLenses
	}

	private provideDesignCodeLenses(document: vscode.TextDocument): CoworkflowCodeLens[] {
		const codeLenses: CoworkflowCodeLens[] = []

		try {
			const text = document.getText()
			const lines = text.split("\n")

			// Look for all markdown headers (# ## ### #### etc.)
			const headerRegex = /^#{1,6}\s+.+/

			lines.forEach((line, index) => {
				try {
					if (headerRegex.test(line)) {
						const range = new vscode.Range(index, 0, index, line.length)
						const codeLens = new vscode.CodeLens(range) as CoworkflowCodeLens
						codeLens.documentType = "design"
						codeLens.actionType = "update"
						codeLens.context = {
							sectionTitle: line.trim(),
							lineNumber: index,
						}
						codeLenses.push(codeLens)
					}
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"parsing_error",
							"warning",
							`Error processing design header at line ${index + 1}`,
							error as Error,
							document.uri,
						),
					)
				}
			})
		} catch (error) {
			this.errorHandler.logError(
				this.errorHandler.createError(
					"parsing_error",
					"error",
					"Error parsing design document",
					error as Error,
					document.uri,
				),
			)
		}

		return codeLenses
	}

	private provideTasksCodeLenses(document: vscode.TextDocument): CoworkflowCodeLens[] {
		const codeLenses: CoworkflowCodeLens[] = []

		try {
			const text = document.getText()
			const lines = text.split("\n")

			// Look for task items with checkboxes
			const taskItemRegex = /^-\s+\[([ x-])\]\s+(.+)/
			let firstTaskFound = false

			lines.forEach((line, index) => {
				try {
					const match = taskItemRegex.exec(line)
					if (match) {
						const [, status, taskText] = match

						// Validate extracted data
						if (!taskText || taskText.trim().length === 0) {
							this.errorHandler.logError(
								this.errorHandler.createError(
									"parsing_error",
									"warning",
									`Empty task text at line ${index + 1}`,
									undefined,
									document.uri,
								),
							)
							return
						}

						const range = new vscode.Range(index, 0, index, line.length)

						// Extract task ID if present (e.g., "1.1", "2.3")
						let taskId: string | undefined
						try {
							const taskIdMatch = taskText.match(/^(\d+(?:\.\d+)?)\s+/)
							taskId = taskIdMatch ? taskIdMatch[1] : undefined
						} catch (error) {
							this.errorHandler.logError(
								this.errorHandler.createError(
									"parsing_error",
									"info",
									`Error extracting task ID at line ${index + 1}`,
									error as Error,
									document.uri,
								),
							)
						}

						// Determine available actions based on task status
						const actions: CoworkflowActionType[] = []
						try {
							if (status === " ") {
								// Not started task - only show "run"
								actions.push("run")

								// If it's the first task, add "run all task" option
								if (!firstTaskFound) {
									actions.push("run_all")
									// Add "run test" option
									actions.push("run_test")
									firstTaskFound = true
								}
							} else if (status === "-") {
								// In progress task - show loading status and retry option
								actions.push("loading")
								actions.push("retry")

								// If it's the first task, add "run all task" option
								if (!firstTaskFound) {
									actions.push("run_all")
									// Add "run test" option
									actions.push("run_test")
									firstTaskFound = true
								}
							} else if (status === "x") {
								// Completed task - only show "retry"
								actions.push("retry")

								// If it's the first task, add "run all task" option
								if (!firstTaskFound) {
									actions.push("run_all")
									// Add "run test" option
									actions.push("run_test")
									firstTaskFound = true
								}
							} else {
								// Unknown status, default to run
								this.errorHandler.logError(
									this.errorHandler.createError(
										"parsing_error",
										"warning",
										`Unknown task status '${status}' at line ${index + 1} - defaulting to 'run'`,
										undefined,
										document.uri,
									),
								)
								actions.push("run")

								// If it's the first task, add "run all task" option
								if (!firstTaskFound) {
									actions.push("run_all")
									// Add "run test" option
									actions.push("run_test")
									firstTaskFound = true
								}
							}
						} catch (error) {
							this.errorHandler.logError(
								this.errorHandler.createError(
									"parsing_error",
									"warning",
									`Error determining task actions at line ${index + 1}`,
									error as Error,
									document.uri,
								),
							)
							actions.push("run") // Fallback action

							// If it's the first task, add "run all task" option
							if (!firstTaskFound) {
								actions.push("run_all")
								firstTaskFound = true
							}
						}

						// Create CodeLens for each available action
						actions.forEach((actionType) => {
							try {
								const codeLens = new vscode.CodeLens(range) as CoworkflowCodeLens
								codeLens.documentType = "tasks"
								codeLens.actionType = actionType
								codeLens.context = {
									taskId,
									sectionTitle: taskText.trim(),
									lineNumber: index,
								}
								codeLenses.push(codeLens)
							} catch (error) {
								this.errorHandler.logError(
									this.errorHandler.createError(
										"parsing_error",
										"warning",
										`Error creating CodeLens for task at line ${index + 1}`,
										error as Error,
										document.uri,
									),
								)
							}
						})
					}
				} catch (error) {
					this.errorHandler.logError(
						this.errorHandler.createError(
							"parsing_error",
							"warning",
							`Error processing task at line ${index + 1}`,
							error as Error,
							document.uri,
						),
					)
				}
			})
		} catch (error) {
			this.errorHandler.logError(
				this.errorHandler.createError(
					"parsing_error",
					"error",
					"Error parsing tasks document",
					error as Error,
					document.uri,
				),
			)
		}

		return codeLenses
	}

	private getCommandId(actionType: CoworkflowActionType): string {
		switch (actionType) {
			case "update":
				return getCommand("coworkflow.updateSection")
			case "run":
				return getCommand("coworkflow.runTask")
			case "run_all":
				return getCommand("coworkflow.runAllTasks")
			case "run_test":
				return getCommand("coworkflow.runTest")
			case "retry":
				return getCommand("coworkflow.retryTask")
			case "loading":
				// Loading state doesn't need to respond to clicks, return empty string
				return ""
			default:
				// Unknown status also doesn't need commands
				return ""
		}
	}

	private getActionTitle(actionType: CoworkflowActionType, documentType: string): string {
		let update = t("workflow:actions.update")
		switch (actionType) {
			case "update":
				return "$(edit) " + ["requirements", "design"].includes(documentType)
					? t(`workflow:actions.${documentType}`)
					: update
			case "run":
				return "$(play) " + t("workflow:actions.run")
			case "run_all":
				return "$(play-circle) " + t("workflow:actions.runAll")
			case "run_test":
				return "$(beaker) " + t("workflow:actions.generateTest")
			case "retry":
				return "$(refresh) " + t("workflow:actions.retry")
			case "loading":
				return "$(loading~spin) " + t("workflow:actions.running")
			default:
				return "Unknown"
		}
	}
}
