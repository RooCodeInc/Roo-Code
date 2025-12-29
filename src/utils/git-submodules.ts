import * as fs from "fs/promises"
import * as path from "path"

import { fileExistsAtPath } from "./fs"

/**
 * Information about a git submodule
 */
export interface SubmoduleInfo {
	/**
	 * The name of the submodule (from the [submodule "name"] section)
	 */
	name: string

	/**
	 * The relative path to the submodule from the parent repository root
	 */
	relativePath: string

	/**
	 * The absolute path to the submodule
	 */
	absolutePath: string

	/**
	 * For nested submodules, this is the full relative path from the workspace root
	 * through all parent submodules (e.g., "parent-submodule/nested-submodule")
	 */
	fullRelativePath: string
}

/**
 * Parses a .gitmodules file and extracts submodule information
 *
 * @param gitmodulesPath - Path to the .gitmodules file
 * @param repoRoot - The root directory of the repository containing the .gitmodules file
 * @param pathPrefix - Prefix to add to relative paths (for nested submodules)
 * @returns Array of SubmoduleInfo objects
 */
async function parseGitmodules(
	gitmodulesPath: string,
	repoRoot: string,
	pathPrefix: string = "",
): Promise<SubmoduleInfo[]> {
	const submodules: SubmoduleInfo[] = []

	try {
		const content = await fs.readFile(gitmodulesPath, "utf-8")
		const lines = content.split("\n")

		let currentSubmodule: { name?: string; path?: string } = {}

		for (const line of lines) {
			const trimmedLine = line.trim()

			// Match [submodule "name"] sections
			const submoduleMatch = trimmedLine.match(/^\[submodule\s+"([^"]+)"\]$/)
			if (submoduleMatch) {
				// Save previous submodule if it has all required fields
				if (currentSubmodule.name && currentSubmodule.path) {
					const relativePath = currentSubmodule.path
					const absolutePath = path.join(repoRoot, relativePath)
					const fullRelativePath = pathPrefix ? path.join(pathPrefix, relativePath) : relativePath

					submodules.push({
						name: currentSubmodule.name,
						relativePath,
						absolutePath,
						fullRelativePath,
					})
				}

				// Start a new submodule
				currentSubmodule = { name: submoduleMatch[1] }
				continue
			}

			// Match path = value lines
			const pathMatch = trimmedLine.match(/^path\s*=\s*(.+)$/)
			if (pathMatch && currentSubmodule.name) {
				currentSubmodule.path = pathMatch[1].trim()
			}
		}

		// Don't forget the last submodule
		if (currentSubmodule.name && currentSubmodule.path) {
			const relativePath = currentSubmodule.path
			const absolutePath = path.join(repoRoot, relativePath)
			const fullRelativePath = pathPrefix ? path.join(pathPrefix, relativePath) : relativePath

			submodules.push({
				name: currentSubmodule.name,
				relativePath,
				absolutePath,
				fullRelativePath,
			})
		}
	} catch (error) {
		// File doesn't exist or can't be read - return empty array
		console.error(`[git-submodules] Failed to parse ${gitmodulesPath}:`, error)
	}

	return submodules
}

/**
 * Gets all git submodules from a repository root, including nested submodules.
 *
 * This function recursively searches for .gitmodules files in the repository
 * and all its submodules to find nested submodules as well.
 *
 * @param workspaceRoot - The root directory of the workspace
 * @param recursive - Whether to recursively search for nested submodules (default: true)
 * @param maxDepth - Maximum depth for recursive search (default: 10)
 * @returns Array of SubmoduleInfo objects for all found submodules
 */
export async function getGitSubmodules(
	workspaceRoot: string,
	recursive: boolean = true,
	maxDepth: number = 10,
): Promise<SubmoduleInfo[]> {
	const allSubmodules: SubmoduleInfo[] = []
	const visited = new Set<string>()

	async function searchSubmodules(repoRoot: string, pathPrefix: string, depth: number): Promise<void> {
		if (depth > maxDepth) {
			console.warn(`[git-submodules] Max depth (${maxDepth}) reached, stopping recursive search`)
			return
		}

		// Avoid infinite loops with circular submodule references
		const normalizedRoot = path.normalize(repoRoot)
		if (visited.has(normalizedRoot)) {
			return
		}
		visited.add(normalizedRoot)

		const gitmodulesPath = path.join(repoRoot, ".gitmodules")

		// Check if .gitmodules exists
		if (!(await fileExistsAtPath(gitmodulesPath))) {
			return
		}

		const submodules = await parseGitmodules(gitmodulesPath, repoRoot, pathPrefix)
		allSubmodules.push(...submodules)

		// Recursively search nested submodules
		if (recursive) {
			for (const submodule of submodules) {
				// Verify the submodule directory exists before searching
				if (await fileExistsAtPath(submodule.absolutePath)) {
					await searchSubmodules(submodule.absolutePath, submodule.fullRelativePath, depth + 1)
				}
			}
		}
	}

	await searchSubmodules(workspaceRoot, "", 0)

	return allSubmodules
}

/**
 * Checks if a given path is inside a git submodule
 *
 * @param filePath - The file path to check
 * @param workspaceRoot - The root directory of the workspace
 * @returns The SubmoduleInfo if the path is inside a submodule, undefined otherwise
 */
export async function getSubmoduleForPath(
	filePath: string,
	workspaceRoot: string,
): Promise<SubmoduleInfo | undefined> {
	const submodules = await getGitSubmodules(workspaceRoot)

	// Normalize the file path for comparison
	const normalizedFilePath = path.normalize(filePath)

	// Find the most specific submodule (longest matching path)
	let matchingSubmodule: SubmoduleInfo | undefined

	for (const submodule of submodules) {
		const normalizedSubmodulePath = path.normalize(submodule.absolutePath)

		if (
			normalizedFilePath.startsWith(normalizedSubmodulePath + path.sep) ||
			normalizedFilePath === normalizedSubmodulePath
		) {
			// Choose the more specific (longer path) submodule
			if (!matchingSubmodule || submodule.fullRelativePath.length > matchingSubmodule.fullRelativePath.length) {
				matchingSubmodule = submodule
			}
		}
	}

	return matchingSubmodule
}
