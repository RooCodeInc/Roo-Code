import path from "path"
import { fileExistsAtPath } from "../../utils/fs"
import fs from "fs/promises"
import fsSync from "fs"
import ignore, { Ignore } from "ignore"
import * as vscode from "vscode"

/**
 * Controls code indexing exclusions by enforcing ignore patterns from .rooindexignore.
 * This allows users to exclude files/folders from code indexing while still allowing
 * Roo to access them for other operations (unlike .rooignore which blocks all access).
 *
 * Designed to be used by the code indexing services (DirectoryScanner and FileWatcher).
 * Uses the 'ignore' library to support standard .gitignore syntax in .rooindexignore files.
 */
export class RooIndexIgnoreController {
	private cwd: string
	private ignoreInstance: Ignore
	private disposables: vscode.Disposable[] = []
	rooIndexIgnoreContent: string | undefined

	constructor(cwd: string) {
		this.cwd = cwd
		this.ignoreInstance = ignore()
		this.rooIndexIgnoreContent = undefined
		// Set up file watcher for .rooindexignore
		this.setupFileWatcher()
	}

	/**
	 * Initialize the controller by loading custom patterns
	 * Must be called after construction and before using the controller
	 */
	async initialize(): Promise<void> {
		await this.loadRooIndexIgnore()
	}

	/**
	 * Set up the file watcher for .rooindexignore changes
	 */
	private setupFileWatcher(): void {
		const rooindexignorePattern = new vscode.RelativePattern(this.cwd, ".rooindexignore")
		const fileWatcher = vscode.workspace.createFileSystemWatcher(rooindexignorePattern)

		// Watch for changes and updates
		this.disposables.push(
			fileWatcher.onDidChange(() => {
				this.loadRooIndexIgnore()
			}),
			fileWatcher.onDidCreate(() => {
				this.loadRooIndexIgnore()
			}),
			fileWatcher.onDidDelete(() => {
				this.loadRooIndexIgnore()
			}),
		)

		// Add fileWatcher itself to disposables
		this.disposables.push(fileWatcher)
	}

	/**
	 * Load custom patterns from .rooindexignore if it exists
	 */
	private async loadRooIndexIgnore(): Promise<void> {
		try {
			// Reset ignore instance to prevent duplicate patterns
			this.ignoreInstance = ignore()
			const ignorePath = path.join(this.cwd, ".rooindexignore")
			if (await fileExistsAtPath(ignorePath)) {
				const content = await fs.readFile(ignorePath, "utf8")
				this.rooIndexIgnoreContent = content
				this.ignoreInstance.add(content)
				// Note: We don't add .rooindexignore itself to the ignore list
				// as it's not typically something that would be indexed anyway
			} else {
				this.rooIndexIgnoreContent = undefined
			}
		} catch (error) {
			// Should never happen: reading file failed even though it exists
			console.error("Unexpected error loading .rooindexignore:", error)
		}
	}

	/**
	 * Check if a file should be included in code indexing
	 * Automatically resolves symlinks
	 * @param filePath - Path to check (relative to cwd)
	 * @returns true if file should be indexed, false if ignored
	 */
	shouldIndex(filePath: string): boolean {
		// Always allow indexing if .rooindexignore does not exist
		if (!this.rooIndexIgnoreContent) {
			return true
		}
		try {
			const absolutePath = path.resolve(this.cwd, filePath)

			// Follow symlinks to get the real path
			let realPath: string
			try {
				realPath = fsSync.realpathSync(absolutePath)
			} catch {
				// If realpath fails (file doesn't exist, broken symlink, etc.),
				// use the original path
				realPath = absolutePath
			}

			// Convert real path to relative for .rooindexignore checking
			const relativePath = path.relative(this.cwd, realPath).toPosix()

			// Check if the real path is ignored for indexing
			return !this.ignoreInstance.ignores(relativePath)
		} catch (error) {
			// Allow indexing on errors (backward compatibility)
			return true
		}
	}

	/**
	 * Filter an array of paths, removing those that should not be indexed
	 * @param paths - Array of paths to filter (relative to cwd)
	 * @returns Array of paths that should be indexed
	 */
	filterPaths(paths: string[]): string[] {
		try {
			return paths
				.map((p) => ({
					path: p,
					shouldIndex: this.shouldIndex(p),
				}))
				.filter((x) => x.shouldIndex)
				.map((x) => x.path)
		} catch (error) {
			console.error("Error filtering paths for indexing:", error)
			return paths // Return all paths on error (fail open for indexing)
		}
	}

	/**
	 * Clean up resources when the controller is no longer needed
	 */
	dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}

	/**
	 * Check if .rooindexignore file exists
	 * @returns true if .rooindexignore exists, false otherwise
	 */
	hasIndexIgnoreFile(): boolean {
		return this.rooIndexIgnoreContent !== undefined
	}
}
