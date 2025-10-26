import * as path from "path"
import * as os from "os"
import fs from "fs/promises"

/**
 * Gets the global .roo directory path based on the current platform
 *
 * @returns The absolute path to the global .roo directory
 *
 * @example Platform-specific paths:
 * ```
 * // macOS/Linux: ~/.roo/
 * // Example: /Users/john/.roo
 *
 * // Windows: %USERPROFILE%\.roo\
 * // Example: C:\Users\john\.roo
 * ```
 *
 * @example Usage:
 * ```typescript
 * const globalDir = getGlobalRooDirectory()
 * // Returns: "/Users/john/.roo" (on macOS/Linux)
 * // Returns: "C:\\Users\\john\\.roo" (on Windows)
 * ```
 */
export function getGlobalRooDirectory(): string {
	const homeDir = os.homedir()
	// Preserve POSIX-style paths when the homedir is expressed as POSIX (e.g., in tests on Windows)
	if (homeDir.startsWith("/")) {
		return path.posix.join(homeDir, ".roo")
	}
	return path.join(homeDir, ".roo")
}

/**
 * Gets the project-local .roo directory path for a given cwd
 *
 * @param cwd - Current working directory (project path)
 * @returns The absolute path to the project-local .roo directory
 *
 * @example
 * ```typescript
 * const projectDir = getProjectRooDirectoryForCwd('/Users/john/my-project')
 * // Returns: "/Users/john/my-project/.roo"
 *
 * const windowsProjectDir = getProjectRooDirectoryForCwd('C:\\Users\\john\\my-project')
 * // Returns: "C:\\Users\\john\\my-project\\.roo"
 * ```
 *
 * @example Directory structure:
 * ```
 * /Users/john/my-project/
 * ├── .roo/                    # Project-local configuration directory
 * │   ├── rules/
 * │   │   └── rules.md
 * │   ├── custom-instructions.md
 * │   └── config/
 * │       └── settings.json
 * ├── src/
 * │   └── index.ts
 * └── package.json
 * ```
 */
export function getProjectRooDirectoryForCwd(cwd: string): string {
	// If the provided cwd is POSIX-like (starts with "/"), keep POSIX semantics cross-platform
	return cwd.startsWith("/") ? path.posix.join(cwd, ".roo") : path.join(cwd, ".roo")
}

/**
 * Checks if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
	try {
		const stat = await fs.stat(dirPath)
		return stat.isDirectory()
	} catch (error: any) {
		// Only catch expected "not found" errors
		if (error.code === "ENOENT" || error.code === "ENOTDIR") {
			return false
		}
		// Re-throw unexpected errors (permission, I/O, etc.)
		throw error
	}
}

/**
 * Checks if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
	try {
		const stat = await fs.stat(filePath)
		return stat.isFile()
	} catch (error: any) {
		// Only catch expected "not found" errors
		if (error.code === "ENOENT" || error.code === "ENOTDIR") {
			return false
		}
		// Re-throw unexpected errors (permission, I/O, etc.)
		throw error
	}
}

/**
 * Reads a file safely, returning null if it doesn't exist
 */
export async function readFileIfExists(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, "utf-8")
	} catch (error: any) {
		// Only catch expected "not found" errors
		if (error.code === "ENOENT" || error.code === "ENOTDIR" || error.code === "EISDIR") {
			return null
		}
		// Re-throw unexpected errors (permission, I/O, etc.)
		throw error
	}
}

/**
 * Gets the ordered list of .roo directories to check hierarchically
 * Walking from global to most specific (current directory)
 *
 * @param cwd - Current working directory (project path)
 * @param enableHierarchical - Whether to enable hierarchical resolution (default: true)
 * @returns Array of directory paths to check in order [global, ...parent directories, project-local]
 *
 * @example
 * ```typescript
 * // For a project at /Users/john/mono-repo/packages/frontend
 * const directories = getRooDirectoriesForCwd('/Users/john/mono-repo/packages/frontend')
 * // Returns:
 * // [
 * //   '/Users/john/.roo',                           // Global directory
 * //   '/Users/john/mono-repo/.roo',                 // Repository root
 * //   '/Users/john/mono-repo/packages/.roo',        // Packages folder
 * //   '/Users/john/mono-repo/packages/frontend/.roo' // Project-local directory
 * // ]
 * ```
 *
 * @example Directory structure:
 * ```
 * /Users/john/
 * ├── .roo/                    # Global configuration
 * │   ├── rules/
 * │   │   └── rules.md
 * │   └── custom-instructions.md
 * └── mono-repo/
 *     ├── .roo/                # Repository-wide configuration
 *     │   └── rules/
 *     │       └── repo-rules.md
 *     └── packages/
 *         ├── .roo/            # Packages-specific configuration
 *         │   └── rules/
 *         │       └── packages-rules.md
 *         └── frontend/
 *             ├── .roo/        # Frontend-specific configuration
 *             │   └── rules/
 *             │       └── frontend-rules.md
 *             └── src/
 *                 └── index.ts
 * ```
 */
export function getRooDirectoriesForCwd(cwd: string, enableHierarchical: boolean = true): string[] {
	const directories: string[] = []
	const posixInput = cwd.startsWith("/")
	const ops = posixInput ? path.posix : path

	// Resolve global directory first and normalize for POSIX-like inputs
	const globalDir = getGlobalRooDirectory()
	const normalizedGlobalDir =
		posixInput && !globalDir.startsWith("/")
			? ops.join(os.homedir().replace(/\\/g, "/"), ".roo")
			: posixInput
				? globalDir.replace(/\\/g, "/")
				: globalDir

	// Add global directory first
	directories.push(normalizedGlobalDir)

	if (!enableHierarchical) {
		// Legacy behavior: only global and project-local
		directories.push(getProjectRooDirectoryForCwd(cwd))
		return directories
	}

	// Hierarchical resolution: walk up from cwd to find all .roo directories
	const visitedPaths = new Set<string>()
	// Resolve current path using the chosen ops
	let currentPath = posixInput ? path.posix.resolve(cwd) : path.resolve(cwd)
	const hierarchicalDirs: string[] = []

	// Normalize homeDir for comparison
	let homeDir = os.homedir()
	if (posixInput) homeDir = homeDir.replace(/\\/g, "/")
	const homeResolved = posixInput ? path.posix.resolve(homeDir) : path.resolve(homeDir)

	// Walk up the directory tree
	while (currentPath && currentPath !== ops.dirname(currentPath)) {
		// Avoid infinite loops
		if (visitedPaths.has(currentPath)) {
			break
		}
		visitedPaths.add(currentPath)

		// Skip if we've reached the home directory (global .roo is already added)
		if (currentPath === homeResolved) {
			break
		}

		// Add .roo directory for this level
		const rooDir = ops.join(currentPath, ".roo")
		hierarchicalDirs.push(rooDir)

		// Move to parent directory
		const parentPath = ops.dirname(currentPath)

		// Stop if we've reached the root or if parent is the same as current
		if (
			parentPath === currentPath ||
			(!posixInput && (parentPath === "/" || parentPath === path.parse(currentPath).root)) ||
			(posixInput && parentPath === "/")
		) {
			break
		}

		currentPath = parentPath
	}

	// Add hierarchical directories in reverse order (from root to most specific)
	// This ensures more specific configurations override general ones
	directories.push(...hierarchicalDirs.reverse())

	return directories
}

/**
 * Loads configuration from multiple .roo directories with project overriding global
 *
 * @param relativePath - The relative path within each .roo directory (e.g., 'rules/rules.md')
 * @param cwd - Current working directory (project path)
 * @returns Object with global and project content, plus merged content
 *
 * @example
 * ```typescript
 * // Load rules configuration for a project
 * const config = await loadConfiguration('rules/rules.md', '/Users/john/my-project')
 *
 * // Returns:
 * // {
 * //   global: "Global rules content...",     // From ~/.roo/rules/rules.md
 * //   project: "Project rules content...",   // From /Users/john/my-project/.roo/rules/rules.md
 * //   merged: "Global rules content...\n\n# Project-specific rules (override global):\n\nProject rules content..."
 * // }
 * ```
 *
 * @example File paths resolved:
 * ```
 * relativePath: 'rules/rules.md'
 * cwd: '/Users/john/my-project'
 *
 * Reads from:
 * - Global: /Users/john/.roo/rules/rules.md
 * - Project: /Users/john/my-project/.roo/rules/rules.md
 *
 * Other common relativePath examples:
 * - 'custom-instructions.md'
 * - 'config/settings.json'
 * - 'templates/component.tsx'
 * ```
 *
 * @example Merging behavior:
 * ```
 * // If only global exists:
 * { global: "content", project: null, merged: "content" }
 *
 * // If only project exists:
 * { global: null, project: "content", merged: "content" }
 *
 * // If both exist:
 * {
 *   global: "global content",
 *   project: "project content",
 *   merged: "global content\n\n# Project-specific rules (override global):\n\nproject content"
 * }
 * ```
 */
export async function loadConfiguration(
	relativePath: string,
	cwd: string,
): Promise<{
	global: string | null
	project: string | null
	merged: string
}> {
	const globalDir = getGlobalRooDirectory()
	const projectDir = getProjectRooDirectoryForCwd(cwd)

	const globalFilePath = path.join(globalDir, relativePath)
	const projectFilePath = path.join(projectDir, relativePath)

	// Read global configuration
	const globalContent = await readFileIfExists(globalFilePath)

	// Read project-local configuration
	const projectContent = await readFileIfExists(projectFilePath)

	// Merge configurations - project overrides global
	let merged = ""

	if (globalContent) {
		merged += globalContent
	}

	if (projectContent) {
		if (merged) {
			merged += "\n\n# Project-specific rules (override global):\n\n"
		}
		merged += projectContent
	}

	return {
		global: globalContent,
		project: projectContent,
		merged: merged || "",
	}
}

// Export with backward compatibility alias
export const loadRooConfiguration: typeof loadConfiguration = loadConfiguration
