import * as path from "path"
import { getGlobalCommandsDir } from "../wiki-prompts/subtasks/constants"

/**
 * Check if the path is the .roo/commands directory or its subdirectory
 * @param filePath The file path to check
 * @returns Returns true if the path is the .roo/commands directory or its subdirectory
 */
export function isRooGlobalCommandsDirectory(filePath: string): boolean {
	if (!filePath || filePath.trim() === "") {
		return false
	}
	
	const absolutePath = path.resolve(filePath)
	const globalCommandsDir = getGlobalCommandsDir()

	// Normalize paths to ensure consistent comparison
	const normalizedAbsolutePath = absolutePath.replace(/\/+$/, '') // Remove trailing slashes
	const normalizedGlobalCommandsDir = globalCommandsDir.replace(/\/+$/, '') // Remove trailing slashes
	const separator = path.sep

	// Check if the path starts with the .roo/commands directory
	return normalizedAbsolutePath === normalizedGlobalCommandsDir ||
	       normalizedAbsolutePath.startsWith(normalizedGlobalCommandsDir + separator)
}

/**
 * Handle approval skip logic for .roo/commands directory files
 * @param fileResult The file result object
 * @param relPath The relative path
 * @param cline The cline instance
 * @param updateFileResult The function to update file result
 * @returns Returns true if approval was skipped, otherwise returns false
 */
export function handleRooCommandsApprovalSkip(
	fileResult: any,
	relPath: string,
	cline: any,
	updateFileResult: (relPath: string, result: any) => void,
): boolean {
	if (!fileResult || !fileResult.status || fileResult.status !== "pending") {
		return false
	}
	
	const fullPath = path.resolve(cline.cwd, relPath)
	if (isRooGlobalCommandsDirectory(fullPath)) {
		// Auto-approve .roo/commands files
		updateFileResult(relPath, {
			status: "approved",
		})
		return true
	}
	
	return false
}
