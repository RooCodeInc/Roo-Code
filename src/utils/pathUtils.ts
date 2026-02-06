import * as vscode from "vscode"
import * as path from "path"

/**
 * Result of path normalization for tool operations.
 */
export interface PathNormalizationResult {
	/** The normalized relative path (if valid) */
	relPath: string
	/** Whether the path is valid for tool operations */
	isValid: boolean
	/** Error message if invalid */
	error?: string
}

/**
 * Normalize a tool path to workspace-relative, with security validation.
 *
 * This function:
 * 1. Converts absolute paths to workspace-relative using VS Code's API
 * 2. Validates the result is safe (no traversal, stays within workspace)
 * 3. Returns a consistent result for both execute() and handlePartial()
 *
 * @param rawPath - The path from the LLM (may be absolute or relative)
 * @param cwd - The task's current working directory (workspace folder)
 * @returns Normalization result with validity status
 */
export function normalizeToolPath(rawPath: string, cwd: string): PathNormalizationResult {
	let relPath = rawPath

	// Step 1: Convert absolute paths to workspace-relative
	if (path.isAbsolute(rawPath)) {
		// Use VS Code's API for multi-root workspace support and separator handling
		relPath = vscode.workspace.asRelativePath(rawPath, false)

		// asRelativePath may return the absolute path unchanged if it's outside
		// all workspace folders. Fall back to path.relative in that case.
		if (path.isAbsolute(relPath)) {
			relPath = path.relative(cwd, rawPath)
		}
	}

	// Step 2: Normalize to remove redundant segments (./foo/../bar -> bar)
	relPath = path.normalize(relPath)

	// Step 3: Security validation - reject paths that escape workspace via ../
	if (relPath.startsWith("..") || relPath.startsWith(path.sep + "..")) {
		return {
			relPath,
			isValid: false,
			error: `Path "${rawPath}" resolves outside the workspace`,
		}
	}

	// Step 4: Reject paths that are still absolute after normalization
	if (path.isAbsolute(relPath)) {
		return {
			relPath,
			isValid: false,
			error: `Path "${rawPath}" could not be resolved relative to workspace`,
		}
	}

	// Step 5: Final check - resolve and verify it's within cwd
	const absoluteResolved = path.resolve(cwd, relPath)
	const cwdNormalized = path.normalize(cwd)
	if (!absoluteResolved.startsWith(cwdNormalized + path.sep) && absoluteResolved !== cwdNormalized) {
		return {
			relPath,
			isValid: false,
			error: `Path "${rawPath}" resolves outside the workspace`,
		}
	}

	return { relPath, isValid: true }
}

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
