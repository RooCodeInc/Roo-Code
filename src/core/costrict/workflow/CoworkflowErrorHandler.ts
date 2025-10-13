/**
 * CoworkflowErrorHandler - Centralized error handling for coworkflow operations
 */

import * as vscode from "vscode"
import {
	ICoworkflowErrorHandler,
	CoworkflowError,
	CoworkflowErrorType,
	CoworkflowErrorSeverity,
	CoworkflowErrorConfig,
} from "./types"
import { createLogger, ILogger } from "../../../utils/logger"

export class CoworkflowErrorHandler implements ICoworkflowErrorHandler {
	private config: CoworkflowErrorConfig
	private outputChannel: ILogger

	constructor(config?: Partial<CoworkflowErrorConfig>) {
		this.config = {
			logToConsole: true,
			showUserNotifications: true,
			notificationThreshold: "warning",
			includeTechnicalDetails: false,
			...config,
		}

		this.outputChannel = createLogger()
	}

	public handleError(error: CoworkflowError): void {
		// Always log the error
		this.logError(error)

		// Show user notification if severity meets threshold
		if (this.shouldShowNotification(error.severity)) {
			this.showErrorNotification(error)
		}
	}

	public createError(
		type: CoworkflowErrorType,
		severity: CoworkflowErrorSeverity,
		message: string,
		originalError?: Error,
		uri?: vscode.Uri,
	): CoworkflowError {
		return {
			type,
			severity,
			message,
			details: originalError?.message,
			uri,
			originalError,
			timestamp: new Date(),
		}
	}

	public logError(error: CoworkflowError): void {
		const timestamp = error.timestamp.toISOString()
		const location = error.uri ? ` [${error.uri.fsPath}]` : ""
		const details = error.details ? ` - ${error.details}` : ""

		const logMessage = `[${timestamp}] ${error.severity.toUpperCase()}: ${error.message}${location}${details}`

		// Log to output channel
		this.outputChannel.info(logMessage)

		// Log to console if enabled
		if (this.config.logToConsole) {
			switch (error.severity) {
				case "critical":
				case "error":
					console.error(`Coworkflow: ${logMessage}`, error.originalError)
					break
				case "warning":
					console.warn(`Coworkflow: ${logMessage}`)
					break
				case "info":
					console.log(`Coworkflow: ${logMessage}`)
					break
			}
		}
	}

	public showErrorNotification(error: CoworkflowError): void {
		if (!this.config.showUserNotifications) {
			return
		}

		const message = this.formatUserMessage(error)
		const actions = this.getNotificationActions(error)

		switch (error.severity) {
			case "critical":
			case "error":
				vscode.window.showErrorMessage(message, ...actions)
				break
			case "warning":
				vscode.window.showWarningMessage(message, ...actions)
				break
			case "info":
				vscode.window.showInformationMessage(message, ...actions)
				break
		}
	}

	private shouldShowNotification(severity: CoworkflowErrorSeverity): boolean {
		const severityLevels: CoworkflowErrorSeverity[] = ["info", "warning", "error", "critical"]
		const errorLevel = severityLevels.indexOf(severity)
		const thresholdLevel = severityLevels.indexOf(this.config.notificationThreshold)

		return errorLevel >= thresholdLevel
	}

	private formatUserMessage(error: CoworkflowError): string {
		let message = `Coworkflow: ${error.message}`

		if (this.config.includeTechnicalDetails && error.details) {
			message += ` (${error.details})`
		}

		return message
	}

	private getNotificationActions(error: CoworkflowError): string[] {
		const actions: string[] = []

		// Add "Show Details" action for errors with technical details
		if (error.details || error.originalError) {
			actions.push("Show Details")
		}

		// Add "Open File" action for file-related errors
		if (error.uri) {
			actions.push("Open File")
		}

		return actions
	}
}
