import path from "path"
import { fileExistsAtPath } from "../../utils/fs"
import fs from "fs/promises"
import ignore from "ignore"
import * as vscode from "vscode"
import { BaseIgnoreController } from "./BaseIgnoreController"

/**
 * Controls file access by enforcing nested .gitignore patterns.
 * Handles multiple .gitignore files throughout the directory tree, unlike ripgrep which only honors top-level .gitignore.
 * Designed to be instantiated once and passed to file manipulation services.
 * Uses the 'ignore' library to support standard .gitignore syntax.
 */
export class GitIgnoreController extends BaseIgnoreController {
	private gitignoreFiles: string[] = []
	private gitignoreContents: Map<string, string> = new Map()

	constructor(cwd: string) {
		super(cwd)
		this.gitignoreFiles = []
		this.gitignoreContents = new Map()
	}

	/**
	 * Initialize the controller by discovering and loading all .gitignore files
	 * Must be called after construction and before using the controller
	 */
	async initialize(): Promise<void> {
		await this.discoverAndLoadGitignoreFiles()
		this.setupGitIgnoreWatchers()
	}

	/**
	 * Discover and load .gitignore files (root + common subdirectories)
	 */
	private async discoverAndLoadGitignoreFiles(): Promise<void> {
		try {
			// Reset state
			this.ignoreInstance = ignore()
			this.gitignoreFiles = []
			this.gitignoreContents.clear()

			// Check for common .gitignore file locations (manually defined for simplicity)
			const commonGitignorePaths = [
				path.join(this.cwd, ".gitignore"), // Root
				path.join(this.cwd, "src", ".gitignore"), // src/
				path.join(this.cwd, "lib", ".gitignore"), // lib/
				path.join(this.cwd, "test", ".gitignore"), // test/
				path.join(this.cwd, "tests", ".gitignore"), // tests/
			]

			// Check each location and load if it exists
			for (const gitignorePath of commonGitignorePaths) {
				const exists = await fileExistsAtPath(gitignorePath)

				if (exists) {
					this.gitignoreFiles.push(gitignorePath)
					await this.loadGitignoreFile(gitignorePath)
				}
			}

			// Also discover arbitrary nested .gitignore files across the workspace
			await this.findGitignoreFilesRecursively(this.cwd)

			// Load any files discovered by recursion that weren't loaded yet
			for (const p of this.gitignoreFiles) {
				if (!this.gitignoreContents.has(p)) {
					await this.loadGitignoreFile(p)
				}
			}

			// Always ignore .gitignore files themselves
			this.ignoreInstance.add(".gitignore")
		} catch (error) {
			console.error("Error discovering .gitignore files:", error)
		}
	}

	/**
	 * Recursively find all .gitignore files in the directory tree
	 */
	private async findGitignoreFilesRecursively(dirPath: string): Promise<void> {
		try {
			// Skip the root directory since we already checked it in discoverAndLoadGitignoreFiles
			if (dirPath === this.cwd) {
				// Get all subdirectories
				const entries = await fs.readdir(dirPath, { withFileTypes: true })
				const subdirs = entries
					.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
					.map((entry) => path.join(dirPath, entry.name))

				// Recursively search subdirectories
				for (const subdir of subdirs) {
					await this.findGitignoreFilesRecursively(subdir)
				}
			} else {
				// For subdirectories, check for .gitignore and continue recursively
				const gitignorePath = path.join(dirPath, ".gitignore")

				// Check if .gitignore exists in current directory
				if (await fileExistsAtPath(gitignorePath)) {
					this.gitignoreFiles.push(gitignorePath)
				}

				// Get all subdirectories
				const entries = await fs.readdir(dirPath, { withFileTypes: true })
				const subdirs = entries
					.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
					.map((entry) => path.join(dirPath, entry.name))

				// Recursively search subdirectories
				for (const subdir of subdirs) {
					await this.findGitignoreFilesRecursively(subdir)
				}
			}
		} catch (error) {
			// Skip directories we can't read
			console.debug(`Could not read directory ${dirPath}:`, error)
		}
	}

	/**
	 * Load content from a specific .gitignore file
	 */
	private async loadGitignoreFile(gitignoreFile: string): Promise<void> {
		try {
			const content = await fs.readFile(gitignoreFile, "utf8")
			this.gitignoreContents.set(gitignoreFile, content)

			// Add patterns to ignore instance with proper context
			// For nested .gitignore files, we need to adjust patterns relative to the workspace root
			const relativeDir = path.relative(this.cwd, path.dirname(gitignoreFile))

			if (relativeDir) {
				// For nested .gitignore files, we need to create patterns that match files within that directory
				const lines = content.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"))
				// Convert Windows paths to POSIX for consistent pattern matching
				const normalizedRelativeDir = relativeDir.split(path.sep).join("/")

				const adjustedPatterns = lines.flatMap((pattern) => {
					const trimmed = pattern.trim()

					if (trimmed.startsWith("/")) {
						// Absolute patterns (starting with /) are relative to the .gitignore location
						return [normalizedRelativeDir + trimmed]
					} else if (trimmed.startsWith("!")) {
						// Negation patterns
						const negatedPattern = trimmed.slice(1)
						if (negatedPattern.startsWith("/")) {
							return ["!" + normalizedRelativeDir + negatedPattern]
						} else {
							// For relative negation patterns, match in the directory and subdirectories
							return [
								"!" + normalizedRelativeDir + "/" + negatedPattern,
								"!" + normalizedRelativeDir + "/**/" + negatedPattern,
							]
						}
					} else {
						// Relative patterns - match files in the directory and all subdirectories
						// For "*.tmp" in src/.gitignore, we need TWO patterns:
						// - src/*.tmp (matches direct children like src/temp.tmp)
						// - src/**/*.tmp (matches descendants like src/subdir/temp.tmp)
						const patterns = [
							normalizedRelativeDir + "/" + trimmed,
							normalizedRelativeDir + "/**/" + trimmed,
						]
						return patterns
					}
				})

				this.ignoreInstance.add(adjustedPatterns)
			} else {
				// Root .gitignore file - add patterns as-is (like RooIgnoreController)
				this.ignoreInstance.add(content)
			}
		} catch (error) {
			console.warn(`Could not read .gitignore at ${gitignoreFile}:`, error)
		}
	}

	/**
	 * Set up file watchers for all .gitignore files in the workspace
	 */
	private setupGitIgnoreWatchers(): void {
		// Create a watcher for .gitignore files throughout the workspace
		const gitignorePattern = new vscode.RelativePattern(this.cwd, "**/.gitignore")
		this.setupFileWatcher(gitignorePattern, () => this.discoverAndLoadGitignoreFiles())
	}

	/**
	 * Check if the controller has any patterns loaded
	 */
	protected hasPatterns(): boolean {
		return this.gitignoreFiles.length > 0
	}

	/**
	 * Get all discovered .gitignore file paths
	 * @returns Array of absolute paths to .gitignore files
	 */
	getGitignoreFiles(): string[] {
		return [...this.gitignoreFiles]
	}

	/**
	 * Get the content of a specific .gitignore file
	 * @param gitignoreFile - Absolute path to the .gitignore file
	 * @returns Content of the file or undefined if not found
	 */
	getGitignoreContent(gitignoreFile: string): string | undefined {
		return this.gitignoreContents.get(gitignoreFile)
	}

	/**
	 * Check if any .gitignore files exist in the workspace
	 * @returns true if at least one .gitignore file exists
	 */
	hasGitignoreFiles(): boolean {
		return this.gitignoreFiles.length > 0
	}

	/**
	 * Clean up resources when the controller is no longer needed
	 */
	override dispose(): void {
		super.dispose()
		this.gitignoreContents.clear()
		this.gitignoreFiles = []
	}
}
