import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import ignore from "ignore"

/**
 * Checks if a file path is outside all workspace folders
 * @param filePath The file path to check
 * @returns true if the path is outside all workspace folders, false otherwise
 */
export function isPathOutsideWorkspace(filePath: string): boolean {
	// If there are no workspace folders, consider everything outside workspace for safety
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		return true
	}

	// Normalize and resolve the path to handle .. and . components correctly
	const absolutePath = path.resolve(filePath)

	// Check if the path is within any workspace folder
	return !vscode.workspace.workspaceFolders.some((folder) => {
		const folderPath = folder.uri.fsPath
		// Path is inside a workspace if it equals the workspace path or is a subfolder
		return absolutePath === folderPath || absolutePath.startsWith(folderPath + path.sep)
	})
}

/**
 * Checks if a file path matches any of the allowed directories patterns.
 * Uses the same pattern matching as .rooignore (gitignore-style patterns).
 * @param filePath The file path to check
 * @param allowedDirectories List of allowed directory patterns
 * @returns true if the path matches any allowed directory pattern, false otherwise
 */
export function isPathInAllowedDirectories(filePath: string, allowedDirectories: string[] | undefined): boolean {
	if (!allowedDirectories || allowedDirectories.length === 0) {
		return false
	}

	// Normalize and resolve the file path
	const absoluteFilePath = path.resolve(filePath)

	for (const pattern of allowedDirectories) {
		// Expand tilde to home directory if pattern starts with ~
		let expandedPattern = pattern
		if (pattern.startsWith("~")) {
			expandedPattern = pattern.replace(/^~/, os.homedir())
		}

		// Convert to absolute path if not already
		const absolutePattern = path.isAbsolute(expandedPattern) ? expandedPattern : path.resolve(expandedPattern)

		// Create an ignore instance for this pattern
		const ig = ignore()

		// For directory patterns, we need to check if the file is under a matching directory
		// We'll check the file's path relative to the pattern's parent directory
		const patternDir = path.dirname(absolutePattern)
		const patternBase = path.basename(absolutePattern)

		// Get the relative path from the pattern's parent directory to the file
		const relativeToPatternDir = path.relative(patternDir, absoluteFilePath)

		// If the file is not under the pattern's parent directory, skip
		if (relativeToPatternDir.startsWith("..")) {
			continue
		}

		// Add the pattern to the ignore instance
		// For directory patterns, we want to match the directory and everything under it
		ig.add(patternBase)
		ig.add(patternBase + "/**")

		// Convert to POSIX-style path for ignore library
		const posixPath = relativeToPatternDir.split(path.sep).join("/")

		// Check if the path is NOT ignored (we're using ignore library in reverse)
		// If the pattern matches, the path should be "ignored" by our pattern
		if (ig.ignores(posixPath)) {
			return true
		}
	}

	return false
}
