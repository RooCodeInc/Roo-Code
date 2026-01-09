/**
 * WorktreeIncludeService
 *
 * Platform-agnostic service for handling .worktreeinclude files.
 * Used to copy untracked files (like node_modules) when creating worktrees.
 */

import { execFile } from "child_process"
import * as fs from "fs/promises"
import * as path from "path"
import { promisify } from "util"

import ignore, { type Ignore } from "ignore"

import type { WorktreeIncludeStatus } from "./types.js"

const execFileAsync = promisify(execFile)

/**
 * Service for managing .worktreeinclude files and copying files to new worktrees.
 * All methods are platform-agnostic and don't depend on VSCode APIs.
 */
export class WorktreeIncludeService {
	/**
	 * Check if .worktreeinclude exists in a directory
	 */
	async hasWorktreeInclude(dir: string): Promise<boolean> {
		try {
			await fs.access(path.join(dir, ".worktreeinclude"))
			return true
		} catch {
			return false
		}
	}

	/**
	 * Check if a specific branch has .worktreeinclude file (in git, not local filesystem)
	 * @param cwd - Current working directory (git repo)
	 * @param branch - Branch name to check
	 */
	async branchHasWorktreeInclude(cwd: string, branch: string): Promise<boolean> {
		try {
			const ref = `${branch}:.worktreeinclude`
			// Use git cat-file -e to check if the file exists on the branch (without printing contents)
			await execFileAsync("git", ["cat-file", "-e", "--", ref], { cwd })
			return true
		} catch {
			// File doesn't exist on this branch
			return false
		}
	}

	/**
	 * Get the status of .worktreeinclude and .gitignore
	 */
	async getStatus(dir: string): Promise<WorktreeIncludeStatus> {
		const worktreeIncludePath = path.join(dir, ".worktreeinclude")
		const gitignorePath = path.join(dir, ".gitignore")

		let exists = false
		let hasGitignore = false
		let gitignoreContent: string | undefined

		try {
			await fs.access(worktreeIncludePath)
			exists = true
		} catch {
			exists = false
		}

		try {
			gitignoreContent = await fs.readFile(gitignorePath, "utf-8")
			hasGitignore = true
		} catch {
			hasGitignore = false
		}

		return {
			exists,
			hasGitignore,
			gitignoreContent,
		}
	}

	/**
	 * Create a .worktreeinclude file with the specified content
	 */
	async createWorktreeInclude(dir: string, content: string): Promise<void> {
		await fs.writeFile(path.join(dir, ".worktreeinclude"), content, "utf-8")
	}

	/**
	 * Copy files matching .worktreeinclude patterns from source to target.
	 * Only copies files that are ALSO in .gitignore (to avoid copying tracked files).
	 *
	 * @returns Array of copied file/directory paths
	 */
	async copyWorktreeIncludeFiles(sourceDir: string, targetDir: string): Promise<string[]> {
		const worktreeIncludePath = path.join(sourceDir, ".worktreeinclude")
		const gitignorePath = path.join(sourceDir, ".gitignore")

		// Check if both files exist
		let hasWorktreeInclude = false
		let hasGitignore = false

		try {
			await fs.access(worktreeIncludePath)
			hasWorktreeInclude = true
		} catch {
			hasWorktreeInclude = false
		}

		try {
			await fs.access(gitignorePath)
			hasGitignore = true
		} catch {
			hasGitignore = false
		}

		if (!hasWorktreeInclude || !hasGitignore) {
			return []
		}

		// Parse both files
		const worktreeIncludePatterns = await this.parseIgnoreFile(worktreeIncludePath)
		const gitignorePatterns = await this.parseIgnoreFile(gitignorePath)

		if (worktreeIncludePatterns.length === 0 || gitignorePatterns.length === 0) {
			return []
		}

		// Create ignore matchers
		const worktreeIncludeMatcher = ignore().add(worktreeIncludePatterns)
		const gitignoreMatcher = ignore().add(gitignorePatterns)

		// Find items that match BOTH patterns (intersection)
		const itemsToCopy = await this.findMatchingItems(sourceDir, worktreeIncludeMatcher, gitignoreMatcher)

		// Copy the items
		const copiedItems: string[] = []
		for (const item of itemsToCopy) {
			const sourcePath = path.join(sourceDir, item)
			const targetPath = path.join(targetDir, item)

			try {
				const stats = await fs.stat(sourcePath)

				if (stats.isDirectory()) {
					// Use native cp for directories (much faster)
					await this.copyDirectoryNative(sourcePath, targetPath)
				} else {
					// Ensure parent directory exists
					await fs.mkdir(path.dirname(targetPath), { recursive: true })
					await fs.copyFile(sourcePath, targetPath)
				}
				copiedItems.push(item)
			} catch (error) {
				// Log but don't fail on individual copy errors
				console.error(`Failed to copy ${item}:`, error)
			}
		}

		return copiedItems
	}

	/**
	 * Parse a .gitignore-style file and return the patterns
	 */
	private async parseIgnoreFile(filePath: string): Promise<string[]> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			return content
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith("#"))
		} catch {
			return []
		}
	}

	/**
	 * Find items in sourceDir that match both matchers
	 */
	private async findMatchingItems(
		sourceDir: string,
		includeMatcher: Ignore,
		gitignoreMatcher: Ignore,
	): Promise<string[]> {
		const matchingItems: string[] = []

		try {
			const entries = await fs.readdir(sourceDir, { withFileTypes: true })

			for (const entry of entries) {
				const relativePath = entry.name

				// Skip .git directory
				if (relativePath === ".git") continue

				// Check if this path matches both patterns
				// For .worktreeinclude, we want items that are "ignored" (matched)
				// For .gitignore, we want items that are "ignored" (matched)
				const matchesWorktreeInclude = includeMatcher.ignores(relativePath)
				const matchesGitignore = gitignoreMatcher.ignores(relativePath)

				if (matchesWorktreeInclude && matchesGitignore) {
					matchingItems.push(relativePath)
				}
			}
		} catch {
			return []
		}

		return matchingItems
	}

	/**
	 * Copy directory using native cp command for performance.
	 * This is 10-20x faster than Node.js fs.cp for large directories like node_modules.
	 */
	private async copyDirectoryNative(source: string, target: string): Promise<void> {
		// Ensure parent directory exists
		await fs.mkdir(path.dirname(target), { recursive: true })

		// Use platform-appropriate copy command
		const isWindows = process.platform === "win32"

		if (isWindows) {
			// Use robocopy on Windows (more reliable than xcopy)
			// robocopy returns non-zero for success, so we check the exit code
			try {
				await execFileAsync(
					"robocopy",
					[source, target, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"],
					{ windowsHide: true },
				)
			} catch (error) {
				// robocopy returns non-zero for success (values < 8)
				const exitCode =
					typeof (error as { code?: unknown }).code === "number"
						? (error as { code: number }).code
						: undefined
				if (exitCode !== undefined && exitCode < 8) {
					return // Success
				}
				throw error
			}
		} else {
			// Use cp -r on Unix-like systems
			await execFileAsync("cp", ["-r", "--", source, target])
		}
	}
}

// Export singleton instance for convenience
export const worktreeIncludeService = new WorktreeIncludeService()
