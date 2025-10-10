import path from "path"
import fsSync from "fs"
import ignore, { Ignore } from "ignore"
import * as vscode from "vscode"

/**
 * Base class for ignore controllers that provides common functionality
 * for handling ignore patterns and file validation.
 */
export abstract class BaseIgnoreController {
	protected cwd: string
	protected ignoreInstance: Ignore
	protected disposables: vscode.Disposable[] = []

	constructor(cwd: string) {
		this.cwd = cwd
		this.ignoreInstance = ignore()
	}

	/**
	 * Initialize the controller - must be implemented by subclasses
	 */
	abstract initialize(): Promise<void>

	/**
	 * Check if a file should be accessible (not ignored by patterns)
	 * Automatically resolves symlinks
	 * @param filePath - Path to check (relative to cwd)
	 * @returns true if file is accessible, false if ignored
	 */
	validateAccess(filePath: string): boolean {
		// Allow subclasses to override the "no patterns" check
		if (!this.hasPatterns()) {
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

			// Convert real path to relative for ignore checking
			const relativePath = path.relative(this.cwd, realPath).toPosix()

			// Check if the real path is ignored
			return !this.ignoreInstance.ignores(relativePath)
		} catch (error) {
			// Allow access to files outside cwd or on errors (backward compatibility)
			return true
		}
	}

	/**
	 * Filter an array of paths, removing those that should be ignored
	 * @param paths - Array of paths to filter (relative to cwd)
	 * @returns Array of allowed paths
	 */
	filterPaths(paths: string[]): string[] {
		try {
			return paths
				.map((p) => ({
					path: p,
					allowed: this.validateAccess(p),
				}))
				.filter((x) => x.allowed)
				.map((x) => x.path)
		} catch (error) {
			console.error("Error filtering paths:", error)
			return [] // Fail closed for security
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
	 * Check if the controller has any patterns loaded
	 * Must be implemented by subclasses
	 */
	protected abstract hasPatterns(): boolean

	/**
	 * Set up file watchers with debouncing to avoid rapid reloads
	 * @param pattern - VSCode RelativePattern for the files to watch
	 * @param reloadCallback - Function to call when files change
	 */
	protected setupFileWatcher(pattern: vscode.RelativePattern, reloadCallback: () => void): void {
		const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern)

		// Debounce rapid changes
		let reloadTimeout: NodeJS.Timeout | undefined
		const debouncedReload = () => {
			if (reloadTimeout) {
				clearTimeout(reloadTimeout)
			}
			reloadTimeout = setTimeout(reloadCallback, 100)
		}

		// Watch for changes, creation, and deletion
		this.disposables.push(
			fileWatcher.onDidChange(debouncedReload),
			fileWatcher.onDidCreate(debouncedReload),
			fileWatcher.onDidDelete(debouncedReload),
		)

		// Add fileWatcher itself to disposables
		this.disposables.push(fileWatcher)
	}
}
