import path from "path"
import { fileExistsAtPath } from "../../../utils/fs"
import fs from "fs/promises"
import ignore, { Ignore } from "ignore"
import * as vscode from "vscode"

export const LOCK_TEXT_SYMBOL = "\u{1F512}"

/**
 * Controls LLM access to files by enforcing ignore patterns.
 * Designed to be instantiated once in Cline.ts and passed to file manipulation services.
 * Uses the 'ignore' library to support standard .gitignore syntax in .coignore files.
 */
export class CoIgnoreController {
	protected cwd: string
	protected ignoreInstance: Ignore
	protected disposables: vscode.Disposable[] = []
	coignoreContentInitialized: boolean
	ignoreFilenames = [".coignore", ".gitignore", ".rooignore"]

	constructor(cwd: string) {
		this.cwd = cwd
		this.ignoreInstance = ignore()
		this.coignoreContentInitialized = false
		// Set up file watcher for .coignore
		this.setupFileWatcher()
	}

	/**
	 * Initialize the controller by loading custom patterns
	 * Must be called after construction and before using the controller
	 */
	async initialize(): Promise<void> {
		await this.loadRooIgnore()
	}

	/**
	 * Set up the file watcher for .coignore changes
	 */
	protected setupFileWatcher(): void {
		this.ignoreFilenames.forEach((filename) => {
			try {
				const rooignorePattern = new vscode.RelativePattern(this.cwd, filename)
				const fileWatcher = vscode.workspace.createFileSystemWatcher(rooignorePattern)

				// Watch for changes and updates
				this.disposables.push(
					fileWatcher.onDidChange(() => {
						this.loadRooIgnore()
					}),
					fileWatcher.onDidCreate(() => {
						this.loadRooIgnore()
					}),
					fileWatcher.onDidDelete(() => {
						this.loadRooIgnore()
					}),
				)

				// Add fileWatcher itself to disposables
				this.disposables.push(fileWatcher)
			} catch (error) {
				// ".coignore", ".gitignore", ".rooignore" doesn't exist at this level, continue
			}
		})
	}

	/**
	 * Load custom patterns from .coignore if it exists
	 */
	protected async loadRooIgnore(): Promise<void> {
		this.ignoreInstance = ignore()

		const rules = this.ignoreFilenames.map(async (filename) => {
			try {
				const ignorePath = path.join(this.cwd, filename)
				if (await fileExistsAtPath(ignorePath)) {
					return await fs.readFile(ignorePath, "utf8")
				}
				return ""
			} catch (error) {
				console.error(`Unexpected error loading ${filename}:`, error)
				return ""
			}
		})
		const content = (await Promise.all(rules)).join("\n")
		if (content.trim().length > 0) {
			this.ignoreInstance.add(content)
			this.ignoreInstance.add(".coignore")
			this.coignoreContentInitialized = true
		} else {
			this.coignoreContentInitialized = false
		}
	}

	/**
	 * Check if a file should be accessible to the LLM
	 * @param filePath - Path to check (relative to cwd)
	 * @returns true if file is accessible, false if ignored
	 */
	validateAccess(filePath: string): boolean {
		// Always allow access if .coignore does not exist
		if (!this.coignoreContentInitialized) {
			return true
		}
		try {
			// Normalize path to be relative to cwd and use forward slashes
			const absolutePath = path.resolve(this.cwd, filePath)
			const relativePath = path.relative(this.cwd, absolutePath).toPosix()

			// Ignore expects paths to be path.relative()'d
			return !this.ignoreInstance.ignores(relativePath)
		} catch (error) {
			// console.error(`Error validating access for ${filePath}:`, error)
			// Ignore is designed to work with relative file paths, so will throw error for paths outside cwd. We are allowing access to all files outside cwd.
			return true
		}
	}

	/**
	 * Clean up resources when the controller is no longer needed
	 */
	dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}
}
