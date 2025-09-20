import * as vscode from "vscode"
import { Package } from "../shared/package"

let outputChannel: vscode.OutputChannel | undefined

/**
 * Gets or creates the output channel for enhanced logging
 */
function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel(Package.outputChannel)
	}
	return outputChannel
}

/**
 * Logs detailed error information to the VS Code Output channel when enhanced logging is enabled
 *
 * @param context - The vscode.ExtensionContext to access global state
 * @param error - The error object or error information to log
 * @param additionalContext - Optional additional context information
 */
export function logEnhancedError(
	context: vscode.ExtensionContext,
	error: unknown,
	additionalContext?: {
		operation?: string
		provider?: string
		model?: string
		request?: any
		response?: any
		[key: string]: any
	},
): void {
	// Check if enhanced logging is enabled
	const enhancedLoggingEnabled = context.globalState.get<boolean>("enhancedLoggingEnabled", false)

	if (!enhancedLoggingEnabled) {
		return
	}

	const channel = getOutputChannel()
	const timestamp = new Date().toISOString()

	// Start logging the error
	channel.appendLine("")
	channel.appendLine("=".repeat(80))
	channel.appendLine(`[ENHANCED LOGGING] Error occurred at ${timestamp}`)
	channel.appendLine("=".repeat(80))

	// Log the operation context if provided
	if (additionalContext?.operation) {
		channel.appendLine(`Operation: ${additionalContext.operation}`)
	}

	if (additionalContext?.provider) {
		channel.appendLine(`Provider: ${additionalContext.provider}`)
	}

	if (additionalContext?.model) {
		channel.appendLine(`Model: ${additionalContext.model}`)
	}

	// Log the error details
	channel.appendLine("")
	channel.appendLine("Error Details:")
	channel.appendLine("-".repeat(40))

	if (error instanceof Error) {
		channel.appendLine(`Error Type: ${error.constructor.name}`)
		channel.appendLine(`Message: ${error.message}`)

		if (error.stack) {
			channel.appendLine("")
			channel.appendLine("Stack Trace:")
			channel.appendLine(error.stack)
		}

		// Log any additional error properties
		const errorObj = error as any
		const standardProps = ["name", "message", "stack"]
		const additionalProps = Object.keys(errorObj).filter((key) => !standardProps.includes(key))

		if (additionalProps.length > 0) {
			channel.appendLine("")
			channel.appendLine("Additional Error Properties:")
			for (const prop of additionalProps) {
				try {
					const value = errorObj[prop]
					if (value !== undefined && value !== null) {
						const displayValue = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)
						channel.appendLine(`  ${prop}: ${displayValue}`)
					}
				} catch (e) {
					channel.appendLine(`  ${prop}: [Unable to serialize]`)
				}
			}
		}
	} else if (typeof error === "string") {
		channel.appendLine(`Error Message: ${error}`)
	} else if (error !== null && error !== undefined) {
		try {
			channel.appendLine(`Error Object: ${JSON.stringify(error, null, 2)}`)
		} catch (e) {
			channel.appendLine(`Error: ${String(error)}`)
		}
	} else {
		channel.appendLine("Unknown error occurred (null or undefined)")
	}

	// Log request details if provided
	if (additionalContext?.request) {
		channel.appendLine("")
		channel.appendLine("Request Details:")
		channel.appendLine("-".repeat(40))
		try {
			// Sanitize sensitive information from request
			const sanitizedRequest = sanitizeForLogging(additionalContext.request)
			channel.appendLine(JSON.stringify(sanitizedRequest, null, 2))
		} catch (e) {
			channel.appendLine("[Unable to serialize request]")
		}
	}

	// Log response details if provided
	if (additionalContext?.response) {
		channel.appendLine("")
		channel.appendLine("Response Details:")
		channel.appendLine("-".repeat(40))
		try {
			// Sanitize sensitive information from response
			const sanitizedResponse = sanitizeForLogging(additionalContext.response)
			channel.appendLine(JSON.stringify(sanitizedResponse, null, 2))
		} catch (e) {
			channel.appendLine("[Unable to serialize response]")
		}
	}

	// Log any other additional context
	const excludedKeys = ["operation", "provider", "model", "request", "response"]
	const otherContext = Object.keys(additionalContext || {})
		.filter((key) => !excludedKeys.includes(key))
		.reduce((acc, key) => {
			acc[key] = additionalContext![key]
			return acc
		}, {} as any)

	if (Object.keys(otherContext).length > 0) {
		channel.appendLine("")
		channel.appendLine("Additional Context:")
		channel.appendLine("-".repeat(40))
		try {
			channel.appendLine(JSON.stringify(otherContext, null, 2))
		} catch (e) {
			channel.appendLine("[Unable to serialize additional context]")
		}
	}

	channel.appendLine("")
	channel.appendLine("=".repeat(80))
	channel.appendLine("")

	// Show the output channel to the user
	channel.show(true)
}

/**
 * Sanitizes an object for logging by removing or masking sensitive information
 */
function sanitizeForLogging(obj: any): any {
	if (obj === null || obj === undefined) {
		return obj
	}

	if (typeof obj !== "object") {
		return obj
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => sanitizeForLogging(item))
	}

	const sanitized: any = {}
	const sensitiveKeys = [
		"apikey",
		"api_key",
		"apiKey",
		"password",
		"passwd",
		"pwd",
		"secret",
		"token",
		"auth",
		"authorization",
		"bearer",
		"credential",
		"credentials",
	]

	for (const [key, value] of Object.entries(obj)) {
		const lowerKey = key.toLowerCase()

		// Check if this key contains sensitive information
		if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
			// Mask the value but show its type and partial info
			if (typeof value === "string" && value.length > 0) {
				sanitized[key] = `[REDACTED: ${value.slice(0, 4)}...${value.slice(-4)}]`
			} else {
				sanitized[key] = "[REDACTED]"
			}
		} else if (typeof value === "object" && value !== null) {
			// Recursively sanitize nested objects
			sanitized[key] = sanitizeForLogging(value)
		} else {
			sanitized[key] = value
		}
	}

	return sanitized
}

/**
 * Logs a simple enhanced message (not necessarily an error)
 */
export function logEnhanced(
	context: vscode.ExtensionContext,
	message: string,
	level: "INFO" | "WARNING" | "ERROR" | "DEBUG" = "INFO",
): void {
	const enhancedLoggingEnabled = context.globalState.get<boolean>("enhancedLoggingEnabled", false)

	if (!enhancedLoggingEnabled) {
		return
	}

	const channel = getOutputChannel()
	const timestamp = new Date().toISOString()

	channel.appendLine(`[${timestamp}] [${level}] ${message}`)
}

/**
 * Disposes the output channel if it exists
 */
export function disposeEnhancedLogging(): void {
	if (outputChannel) {
		outputChannel.dispose()
		outputChannel = undefined
	}
}
