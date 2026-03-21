import type { PluginManifest } from "@roo-code/types"
import { pluginManifestSchema } from "@roo-code/types"

/**
 * Parsed plugin source reference.
 */
export interface PluginSourceRef {
	owner: string
	repo: string
	ref: string // branch, tag, or commit - defaults to "main"
}

/**
 * Parse a plugin source string in the format "owner/repo" or "owner/repo@ref".
 */
export function parsePluginSource(source: string): PluginSourceRef {
	const atIndex = source.indexOf("@")
	let repoPath: string
	let ref: string

	if (atIndex !== -1) {
		repoPath = source.slice(0, atIndex)
		ref = source.slice(atIndex + 1)
		if (!ref) {
			ref = "main"
		}
	} else {
		repoPath = source
		ref = "main"
	}

	const parts = repoPath.split("/")
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		throw new Error(`Invalid plugin source format: "${source}". Expected "owner/repo" or "owner/repo@ref".`)
	}

	return { owner: parts[0], repo: parts[1], ref }
}

/**
 * Build a raw GitHub content URL for a specific file in a repository.
 */
export function buildRawUrl(sourceRef: PluginSourceRef, filePath: string): string {
	return `https://raw.githubusercontent.com/${sourceRef.owner}/${sourceRef.repo}/${sourceRef.ref}/${filePath}`
}

/**
 * Fetch a file's text content from a GitHub repository.
 */
export async function fetchFileFromGitHub(sourceRef: PluginSourceRef, filePath: string): Promise<string> {
	const url = buildRawUrl(sourceRef, filePath)
	const response = await fetch(url)

	if (!response.ok) {
		if (response.status === 404) {
			throw new Error(`File not found: ${filePath} in ${sourceRef.owner}/${sourceRef.repo}@${sourceRef.ref}`)
		}
		throw new Error(`Failed to fetch ${filePath}: HTTP ${response.status} ${response.statusText}`)
	}

	return response.text()
}

/**
 * Fetch and validate the plugin manifest (plugin.json) from a GitHub repository.
 */
export async function fetchPluginManifest(sourceRef: PluginSourceRef): Promise<PluginManifest> {
	const content = await fetchFileFromGitHub(sourceRef, "plugin.json")

	let parsed: unknown
	try {
		parsed = JSON.parse(content)
	} catch {
		throw new Error(`Invalid JSON in plugin.json from ${sourceRef.owner}/${sourceRef.repo}@${sourceRef.ref}`)
	}

	const result = pluginManifestSchema.safeParse(parsed)
	if (!result.success) {
		const errors = result.error.issues
			.map(
				(issue: { path: (string | number)[]; message: string }) =>
					`  - ${issue.path.join(".")}: ${issue.message}`,
			)
			.join("\n")
		throw new Error(
			`Invalid plugin manifest from ${sourceRef.owner}/${sourceRef.repo}@${sourceRef.ref}:\n${errors}`,
		)
	}

	return result.data
}
