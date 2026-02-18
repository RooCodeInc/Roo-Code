/**
 * Scope Enforcer - Validates file paths against intent's owned_scope
 * Prevents agents from modifying files outside their declared scope
 */

import * as path from "path"
import { minimatch } from "minimatch"
import { IntentMetadata } from "./types"

export class ScopeEnforcer {
	/**
	 * Check if a file path is within the allowed scope
	 * @param filePath Absolute or relative file path
	 * @param intent The active intent with owned_scope patterns
	 * @param workspaceRoot Workspace root directory
	 * @returns Object with allowed flag and error message if blocked
	 */
	static checkScope(
		filePath: string,
		intent: IntentMetadata,
		workspaceRoot: string,
	): { allowed: boolean; error?: string } {
		// Convert to relative path if absolute
		let relativePath = filePath
		if (path.isAbsolute(filePath)) {
			relativePath = path.relative(workspaceRoot, filePath)
		}

		// Normalize path separators
		relativePath = relativePath.replace(/\\/g, "/")

		// Check against each owned_scope pattern
		const isInScope = intent.owned_scope.some((pattern) => {
			return minimatch(relativePath, pattern, { dot: true })
		})

		if (!isInScope) {
			const scopeList = intent.owned_scope.map((s) => `  - ${s}`).join("\n")
			return {
				allowed: false,
				error: `Scope Violation: Intent "${intent.id}" (${intent.name}) is not authorized to edit "${relativePath}".\n\nAllowed scope:\n${scopeList}\n\nTo edit this file, you must either:\n1. Request scope expansion for this intent\n2. Select a different intent that owns this file\n3. Create a new intent that includes this file in its scope`,
			}
		}

		return { allowed: true }
	}

	/**
	 * Get all files that match the intent's owned_scope patterns
	 * @param intent The intent with owned_scope patterns
	 * @param workspaceRoot Workspace root directory
	 * @returns Array of matching file paths
	 */
	static async getOwnedFiles(intent: IntentMetadata, workspaceRoot: string): Promise<string[]> {
		const glob = await import("glob")
		const ownedFiles: string[] = []

		for (const pattern of intent.owned_scope) {
			const files = await glob.glob(pattern, {
				cwd: workspaceRoot,
				absolute: false,
				dot: true,
			})
			ownedFiles.push(...files)
		}

		// Remove duplicates
		return [...new Set(ownedFiles)]
	}

	/**
	 * Check if a pattern is valid glob syntax
	 * @param pattern The glob pattern to validate
	 * @returns true if valid
	 */
	static isValidPattern(pattern: string): boolean {
		try {
			minimatch("test.ts", pattern)
			return true
		} catch {
			return false
		}
	}
}
