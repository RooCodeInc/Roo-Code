import * as vscode from "vscode"
import { Package } from "../shared/package"

/**
 * Check if debug logging for native tool calls is enabled
 */
export function isNativeToolCallDebugEnabled(): boolean {
	try {
		return vscode.workspace.getConfiguration(Package.name).get<boolean>("debugNativeToolCalls", false)
	} catch {
		// If there's any error accessing configuration, default to false
		return false
	}
}

/**
 * Log debug information for native tool calls if debugging is enabled
 */
export function debugNativeToolCall(message: string, data?: any): void {
	if (isNativeToolCallDebugEnabled()) {
		if (data !== undefined) {
			console.debug(message, data)
		} else {
			console.debug(message)
		}
	}
}
