/**
 * WeaveMergeDriverService
 *
 * Platform-agnostic service for detecting and configuring the weave semantic merge driver.
 * Weave uses tree-sitter to merge at the function/class level, reducing false conflicts
 * when parallel worktree tasks edit different functions in the same file.
 *
 * @see https://github.com/ataraxy-labs/weave
 */

import { exec } from "child_process"
import * as fs from "fs/promises"
import * as path from "path"
import { promisify } from "util"

const execAsync = promisify(exec)

/**
 * Supported file extensions for the weave merge driver.
 * These correspond to languages that weave/tree-sitter can parse semantically.
 */
export const WEAVE_SUPPORTED_EXTENSIONS = [
	"*.py",
	"*.js",
	"*.jsx",
	"*.ts",
	"*.tsx",
	"*.rs",
	"*.go",
	"*.java",
	"*.c",
	"*.cpp",
	"*.h",
	"*.hpp",
	"*.rb",
	"*.swift",
	"*.kt",
	"*.scala",
	"*.cs",
]

/**
 * The gitattributes lines that configure weave as the merge driver for supported file types.
 */
export function buildGitattributesLines(extensions: string[] = WEAVE_SUPPORTED_EXTENSIONS): string[] {
	return extensions.map((ext) => `${ext} merge=weave`)
}

/**
 * Status of the weave merge driver in a repository.
 */
export interface WeaveMergeDriverStatus {
	/** Whether the weave binary is found on PATH */
	isInstalled: boolean
	/** Version string if installed, undefined otherwise */
	version?: string
	/** Whether the merge driver is configured in the repo's git config */
	isConfiguredInGitConfig: boolean
	/** Whether .gitattributes contains weave merge driver entries */
	isConfiguredInGitattributes: boolean
	/** Whether setup is fully complete (both git config and gitattributes) */
	isFullyConfigured: boolean
}

/**
 * Service for managing the weave semantic merge driver configuration.
 * All methods are platform-agnostic and don't depend on VSCode APIs.
 */
export class WeaveMergeDriverService {
	/**
	 * Check if weave is installed and available on PATH.
	 */
	async isInstalled(): Promise<boolean> {
		try {
			await execAsync("weave --version")
			return true
		} catch {
			return false
		}
	}

	/**
	 * Get the weave version string.
	 */
	async getVersion(): Promise<string | undefined> {
		try {
			const { stdout } = await execAsync("weave --version")
			return stdout.trim()
		} catch {
			return undefined
		}
	}

	/**
	 * Check if the weave merge driver is configured in the repo's local git config.
	 */
	async isConfiguredInGitConfig(cwd: string): Promise<boolean> {
		try {
			const { stdout } = await execAsync("git config --local merge.weave.driver", { cwd })
			return stdout.trim().length > 0
		} catch {
			return false
		}
	}

	/**
	 * Check if .gitattributes contains weave merge driver entries.
	 */
	async isConfiguredInGitattributes(cwd: string): Promise<boolean> {
		try {
			const gitRoot = await this.getGitRoot(cwd)
			if (!gitRoot) return false

			const gitattributesPath = path.join(gitRoot, ".gitattributes")
			const content = await fs.readFile(gitattributesPath, "utf-8")
			return content.includes("merge=weave")
		} catch {
			return false
		}
	}

	/**
	 * Get the full status of the weave merge driver for a repository.
	 */
	async getStatus(cwd: string): Promise<WeaveMergeDriverStatus> {
		const [isInstalled, version, isConfiguredInGitConfig, isConfiguredInGitattributes] = await Promise.all([
			this.isInstalled(),
			this.getVersion(),
			this.isConfiguredInGitConfig(cwd),
			this.isConfiguredInGitattributes(cwd),
		])

		return {
			isInstalled,
			version,
			isConfiguredInGitConfig,
			isConfiguredInGitattributes,
			isFullyConfigured: isConfiguredInGitConfig && isConfiguredInGitattributes,
		}
	}

	/**
	 * Configure the weave merge driver in the repo's local git config.
	 * Adds:
	 *   [merge "weave"]
	 *     name = Weave semantic merge driver
	 *     driver = weave merge %O %A %B %P
	 */
	async configureGitConfig(cwd: string): Promise<void> {
		await execAsync('git config --local merge.weave.name "Weave semantic merge driver"', { cwd })
		await execAsync('git config --local merge.weave.driver "weave merge %O %A %B %P"', { cwd })
	}

	/**
	 * Add weave merge driver entries to .gitattributes.
	 * If .gitattributes already exists, appends the entries (avoiding duplicates).
	 * If it doesn't exist, creates it.
	 *
	 * @param cwd - Current working directory (must be in a git repo)
	 * @param extensions - File extensions to configure (defaults to WEAVE_SUPPORTED_EXTENSIONS)
	 * @returns The list of extensions that were actually added (excludes already-configured ones)
	 */
	async configureGitattributes(cwd: string, extensions: string[] = WEAVE_SUPPORTED_EXTENSIONS): Promise<string[]> {
		const gitRoot = await this.getGitRoot(cwd)
		if (!gitRoot) {
			throw new Error("Not a git repository")
		}

		const gitattributesPath = path.join(gitRoot, ".gitattributes")
		let existingContent = ""

		try {
			existingContent = await fs.readFile(gitattributesPath, "utf-8")
		} catch {
			// File doesn't exist yet, that's fine
		}

		const existingLines = new Set(existingContent.split("\n").map((line) => line.trim()))
		const newLines = buildGitattributesLines(extensions)
		const addedExtensions: string[] = []

		const linesToAdd: string[] = []
		for (let i = 0; i < newLines.length; i++) {
			const line = newLines[i]!
			const ext = extensions[i]!
			if (!existingLines.has(line)) {
				linesToAdd.push(line)
				addedExtensions.push(ext)
			}
		}

		if (linesToAdd.length > 0) {
			const separator =
				existingContent.length > 0 && !existingContent.endsWith("\n")
					? "\n\n# Weave semantic merge driver\n"
					: existingContent.length > 0
						? "\n# Weave semantic merge driver\n"
						: "# Weave semantic merge driver\n"

			const newContent = existingContent + separator + linesToAdd.join("\n") + "\n"
			await fs.writeFile(gitattributesPath, newContent, "utf-8")
		}

		return addedExtensions
	}

	/**
	 * Fully configure the weave merge driver for a repository.
	 * Sets up both the git config and .gitattributes entries.
	 *
	 * @param cwd - Current working directory (must be in a git repo)
	 * @param extensions - File extensions to configure (defaults to WEAVE_SUPPORTED_EXTENSIONS)
	 * @returns Status after configuration
	 */
	async configure(
		cwd: string,
		extensions: string[] = WEAVE_SUPPORTED_EXTENSIONS,
	): Promise<{ success: boolean; message: string; addedExtensions: string[] }> {
		const isInstalled = await this.isInstalled()
		if (!isInstalled) {
			return {
				success: false,
				message:
					"weave is not installed. Install it with: brew install ataraxy-labs/tap/weave (macOS) or cargo install weave-merge (other platforms). See https://github.com/ataraxy-labs/weave",
				addedExtensions: [],
			}
		}

		try {
			await this.configureGitConfig(cwd)
			const addedExtensions = await this.configureGitattributes(cwd, extensions)

			const extMsg =
				addedExtensions.length > 0
					? `Added ${addedExtensions.length} file pattern(s) to .gitattributes.`
					: ".gitattributes already configured."

			return {
				success: true,
				message: `Weave semantic merge driver configured. ${extMsg}`,
				addedExtensions,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return {
				success: false,
				message: `Failed to configure weave merge driver: ${errorMessage}`,
				addedExtensions: [],
			}
		}
	}

	/**
	 * Remove weave merge driver configuration from a repository.
	 * Removes the git config entries and weave lines from .gitattributes.
	 */
	async unconfigure(cwd: string): Promise<{ success: boolean; message: string }> {
		try {
			// Remove git config entries
			try {
				await execAsync("git config --local --remove-section merge.weave", { cwd })
			} catch {
				// Section may not exist
			}

			// Remove weave lines from .gitattributes
			const gitRoot = await this.getGitRoot(cwd)
			if (gitRoot) {
				const gitattributesPath = path.join(gitRoot, ".gitattributes")
				try {
					const content = await fs.readFile(gitattributesPath, "utf-8")
					const lines = content.split("\n")
					const filteredLines = lines.filter(
						(line) => !line.includes("merge=weave") && line.trim() !== "# Weave semantic merge driver",
					)

					// Clean up double blank lines
					const cleanedContent = filteredLines.join("\n").replace(/\n{3,}/g, "\n\n")
					await fs.writeFile(gitattributesPath, cleanedContent, "utf-8")
				} catch {
					// .gitattributes may not exist
				}
			}

			return {
				success: true,
				message: "Weave merge driver configuration removed.",
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return {
				success: false,
				message: `Failed to remove weave configuration: ${errorMessage}`,
			}
		}
	}

	/**
	 * Get the git repository root path.
	 */
	private async getGitRoot(cwd: string): Promise<string | null> {
		try {
			const { stdout } = await execAsync("git rev-parse --show-toplevel", { cwd })
			return stdout.trim()
		} catch {
			return null
		}
	}
}

// Export singleton instance for convenience
export const weaveMergeDriverService = new WeaveMergeDriverService()
